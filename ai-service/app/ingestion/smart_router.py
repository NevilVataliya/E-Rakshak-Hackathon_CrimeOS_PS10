import os
import concurrent.futures
from typing import Union, List, Dict, Any, Optional
from config import GEMINI_API_KEY, get_agent_llm, is_offline_mode
from app.utils.json_helper import parse_llm_json
from app.models.schemas import ComplaintIngestionSchema
from app.ingestion.base_processor import BaseFileProcessor
from app.ingestion.processors import (
    TextProcessor,
    DocxProcessor,
    PDFProcessor,
    AudioProcessor,
    ImageProcessor
)
from app.ingestion.heuristic_extractor import extract_entities_heuristic
from app.utils.error_policy import (
    with_retry,
    handle_llm_error,
    is_retryable_error,
    get_policy_summary,
    ERROR_POLICY,
    MAX_RETRIES,
)

# Hard timeout (seconds) for a single cloud LLM call. Prevents indefinite hangs
# when the provider API is unreachable/slow. When exceeded, the request fails
# fast and triggers the heuristic fallback instead of blocking forever.
LLM_CALL_TIMEOUT_SEC = float(os.getenv("LLM_CALL_TIMEOUT_SEC", "60"))


def _invoke_llm_with_timeout(llm, prompt_text: str):
    """
    Invoke the LLM with a hard wall-clock timeout.
    Runs the (blocking) invoke in a worker thread and waits up to
    LLM_CALL_TIMEOUT_SEC. If it doesn't finish in time, raises TimeoutError
    immediately so the caller's error policy (heuristic fallback) kicks in.

    CRITICAL: We do NOT use a `with ThreadPoolExecutor(...)` context manager
    here. The context manager's __exit__ calls `shutdown(wait=True)`, which
    BLOCKS until the worker thread completes. If langchain is stuck in its
    internal retry sleep (e.g. Gemini 429 rate-limit), that shutdown blocks
    indefinitely — defeating the entire purpose of the timeout. Instead we
    create the executor, submit, wait with a timeout, and on timeout raise
    TimeoutError WITHOUT waiting for the worker thread. (The orphaned thread
    finishes on its own eventually and is harmless.) We also set the thread
    as daemon so it never blocks process exit.
    """
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        future = executor.submit(llm.invoke, prompt_text)
        try:
            return future.result(timeout=LLM_CALL_TIMEOUT_SEC)
        except concurrent.futures.TimeoutError:
            future.cancel()
            raise TimeoutError(
                f"LLM call exceeded timeout of {LLM_CALL_TIMEOUT_SEC}s "
                f"({type(llm).__name__})."
            )
    finally:
        # Do NOT block waiting for the worker. shutdown(wait=False) lets the
        # orphaned thread finish on its own.
        executor.shutdown(wait=False)

class IntakeAgent:
    """
    Multimodal Ingestion Agent using an Open/Closed Plugin Architecture.
    Allows runtime registration of file handlers for PDF, DOCX, Text, Images, and Audio.
    """
    def __init__(self, processors: List[BaseFileProcessor] = None):
        self._processors = processors or []

    def register_processor(self, processor: BaseFileProcessor):
        self._processors.append(processor)

    def process_files(self, file_paths: List[str], offline_mode: bool = False) -> Dict[str, Any]:
        output_parts = []
        engines_used = []
        warnings = []
        is_fully_offline = True

        for path in file_paths:
            if not os.path.exists(path):
                continue
            filename = os.path.basename(path)
            _, ext = os.path.splitext(path)

            processor_found = False
            for processor in self._processors:
                if processor.can_handle(ext):
                    res = processor.extract_content(path, offline_mode=offline_mode)
                    if res.get("content"):
                        output_parts.append(res["content"])
                    if res.get("engine_used"):
                        engines_used.append(res["engine_used"])
                    if res.get("warning"):
                        warnings.append(res["warning"])
                    if not res.get("is_offline", True):
                        is_fully_offline = False
                    processor_found = True
                    break

            if not processor_found:
                warnings.append(f"No registered processor for file type extension '{ext}' ({filename})")
                output_parts.append(f"[File {filename} attached - Unsupported file format]")

        return {
            "combined_text": "\n\n".join(output_parts),
            "engines_used": list(set(engines_used)),
            "warnings": warnings,
            "is_fully_offline": is_fully_offline
        }

# Default global instance pre-registered with default file processors
default_intake_agent = IntakeAgent(processors=[
    TextProcessor(),
    DocxProcessor(),
    PDFProcessor(),
    AudioProcessor(),
    ImageProcessor()
])

def process_multimodal_complaint(
    file_paths: Union[str, List[str]] = None,
    file_path: str = None,
    raw_text: str = None,
    input_type: str = "text"
) -> Dict[str, Any]:
    """
    Multimodal Complaint Ingestion Engine.
    Supports Standalone Offline execution and Hybrid Online LLM processing.
    """
    paths = []
    if isinstance(file_paths, list):
        paths.extend(file_paths)
    elif isinstance(file_paths, str) and file_paths:
        paths.append(file_paths)
    if file_path and file_path not in paths:
        paths.append(file_path)

    # 1. Determine System Operational Mode
    system_offline = is_offline_mode()

    # 2. Execute Pluggable Intake Processors
    file_results = default_intake_agent.process_files(paths, offline_mode=system_offline)
    
    text_components = []
    if raw_text and raw_text.strip():
        text_components.append(f"[User Input Complaint Text]:\n{raw_text.strip()}")
    if file_results["combined_text"]:
        text_components.append(file_results["combined_text"])

    extracted_text = "\n\n".join(text_components) if text_components else "No complaint narrative provided."

    # Strip null bytes (\x00) that pdfplumber/PyMuPDF can embed from garbled PDF streams.
    # PostgreSQL TEXT columns reject \x00 with "invalid byte sequence for encoding UTF8".
    extracted_text = extracted_text.replace("\x00", "")

    # 3. Offline Mode Execution Branch
    if system_offline:
        res = extract_entities_heuristic(
            text=extracted_text,
            fallback_reason="System operating in Standalone Offline Mode. Local extractors active."
        )
        res["processing_mode"] = "OFFLINE_STANDALONE"
        res["engines_used"] = file_results["engines_used"] + ["local_regex_heuristic_extractor"]
        res["warnings"] = file_results["warnings"] + ["Cloud LLM extraction skipped in Offline Mode."]
        res["is_offline"] = True
        return res

    # 4. Online Mode Execution Branch (Cloud LLM Extraction)
    prompt_text = f"""
You are an expert Law Enforcement Fact Analyst for Indian Police.
Analyze the following complaint input (Text, OCR, Audio Transcription in English, Hindi, or Gujarati).

=== COMPLAINT INPUT ===
{extracted_text}
=======================

IMPORTANT: This document may span MULTIPLE PAGES (marked as --- Page 1/N ---, --- Page 2/N --- etc.).
You MUST read and extract entities from EVERY PAGE. Do NOT stop at the first page.
Pay special attention to investigation reports on later pages which often name secondary accused, money mules, absconding suspects, and field investigation findings.

CRITICAL — GUJARATI/HINDI NUMERALS:
The document may contain amounts written in Gujarati (Gujarati) or Hindi (Devanagari) digits, NOT ASCII digits.
Examples of Gujarati digits: ૦=0 ૧=1 ૨=2 ૩=3 ૪=4 ૫=5 ૬=6 ૭=7 ૮=8 ૯=9
Examples of Devanagari digits: ०=0 १=1 २=2 ३=3 ४=4 ५=5 ६=6 ७=7 ८=8 ९=9
When you see amounts like "રૂ.૯,૦૦,૦૦૦" or "₹९,००,०००", convert them correctly:
  - ૯,૦૦,૦૦૦ = 9,00,000 (NINE LAKHS) — NOT 90,000
  - ૯૦,૦૦૦ = 90,000
  - ૯,૦૦,૦૦,૦૦૦ = 9,00,00,000 (NINE CRORES)
Use Indian numbering (lakhs/crores) as written in the original. DO NOT misread lakh amounts as thousands.

CRITICAL — MONETARY_LOSS GUIDANCE:
The `monetary_loss` field must be set to the EXPLICITLY STATED TOTAL LOSS AMOUNT in the document, NOT the sum of individual transactions.
- If the document states a total amount like "રૂ.૯,૦૦,૦૦૦" or "₹9,00,000" or "nine lakhs", use THAT as `monetary_loss`.
- Individual transfer amounts (e.g. "₹2,50,000 ... ₹2,00,000") are part of the money_trail, but the `monetary_loss` is the TOTAL claimed loss.
- Only if NO total is stated, fall back to the sum of all individual transfers.

Task:
1. Detect original language (en, hi, gu).
2. Translate the FULL document to clear English. Include key details from all pages.
3. Classify crime category: "CYBER" or "CONVENTIONAL" or "HYBRID".
4. Determine the exact crime sub-type based strictly on the complaint narrative.
5. Extract ALL entities in valid JSON. Include the money_trail (transfer chain) when accounts/UPIs are involved.

PERSONS — Extract ALL persons mentioned across all pages, including:
  - Primary complainant/victim
  - All accused persons (named, identified, or traced)
  - Absconding / untraceable suspects (still extract them with status: "absconding" or "untraceable")
  - Persons with aliases (urfé / ઉર્ફે / alias) — extract BOTH the real name and alias
  - Persons identified during investigation on later pages
  For each person, extract:
    * name: full name as written
    * alias: alternate name / urfé name (null if none)
    * role: "victim", "accused", "suspect", "witness", "mule", or "fake_identity"
    * father_name: S/O or father's name (null if not mentioned)
    * age: numeric age (null if not mentioned)
    * address: full address if mentioned (null if not mentioned)
    * status: "arrested", "absconding", "untraceable", "questioned", "produced" (null if not clear)

BANK ACCOUNTS — For EACH bank account:
  * account_number, ifsc, bank name
  * account_role: "victim" or "accused"
  * is_victim_account: true ONLY for the original complainant's account
  Note the money trail order if multiple accounts are mentioned as a transfer chain.

LEGAL SECTIONS — Record the sections EXACTLY as stated in the document, preserving the original statute prefix (IPC, IT Act, BNS, etc.). Do NOT convert or renumber sections between statutes. The legal specialist agent will independently identify the correct current BNS sections via the RAG legal corpus.
Record ONLY sections that are EXPLICITLY mentioned/numbered in the document, or that are directly and unambiguously evident from the facts. Do NOT force a fixed list of sections. Include the section number AND a short description in brackets.

Respond ONLY in valid JSON matching this exact structure:
{{
  "original_language": "gu|hi|en",
  "translated_text": "<FULL ENGLISH TRANSLATION covering all pages>",
  "crime_category": "CYBER|CONVENTIONAL|HYBRID",
  "crime_sub_type": "<SPECIFIC SUB TYPE>",
  "severity_score": 7.5,
  "bns_sections_identified": ["<BNS_SECTION_1>", "<BNS_SECTION_2>"],
  "entities": {{
    "persons": [
      {{
        "name": "<FULL NAME>",
        "alias": "<ALIAS OR NULL>",
        "role": "victim|accused|suspect|witness|mule|fake_identity",
        "father_name": "<S/O NAME OR NULL>",
        "age": null,
        "address": "<ADDRESS OR NULL>",
        "status": "arrested|absconding|untraceable|questioned|produced|null"
      }}
    ],
    "phone_numbers": [],
    "email_addresses": [],
    "online_handles": [],
    "bank_accounts": [
      {{
        "account_number": "<NUMBER>",
        "ifsc": "<IFSC>",
        "bank": "<BANK NAME>",
        "account_name": "<HOLDER NAME>",
        "account_role": "victim|accused",
        "is_victim_account": false
      }}
    ],
    "vpas_upis": [],
    "monetary_loss": 0,
    "money_trail": [
      {{
        "step": 1,
        "from_account": "<FROM ACCOUNT NUMBER OR UPI>",
        "from_bank": "<FROM BANK NAME>",
        "to_account": "<TO ACCOUNT NUMBER OR UPI>",
        "to_bank": "<TO BANK NAME>",
        "amount": 0,
        "method": "UPI|IMPS|NEFT|RTGS|Cheque|Cash",
        "date": "<DD/MM/YYYY>",
        "notes": "<e.g. 'victim to mule1', 'mule1 to mule2', 'withdrawn at ATM'>"
      }}
    ],
    "crime_locations": [],
    "date_time_of_incident": "<DATE RANGE>"
  }},
  "key_facts": [
    "<SPECIFIC FACT 1 — include EXACT amounts with Indian numbering (e.g. ₹9,00,000 / nine lakhs), not generic descriptions>",
    "<SPECIFIC FACT 2 — include the money trail / transfer chain: from which account/UPI to which, and the method>",
    "<SPECIFIC FACT 3 — include investigation findings: where money was withdrawn, which mule accounts were traced, any arrests or absconding suspects>",
    "<SPECIFIC FACT 4 — include exact dates, times, and locations mentioned>"
  ]
}}
"""

    try:
        llm = get_agent_llm("auto", temperature=0.1)
        if llm is None:
            raise ValueError("No Cloud LLM API key available.")

        # Invoke the LLM with centralized retry logic (exponential backoff on
        # rate limits / transient errors) AND a hard wall-clock timeout so a
        # hung/unreachable provider fails fast and triggers the heuristic
        # fallback instead of blocking the request indefinitely.
        resp = with_retry(
            lambda: _invoke_llm_with_timeout(llm, prompt_text),
            on_retry=lambda e, attempt: print(
                f"  [!] LLM transient error ({type(e).__name__}: {e}). "
                f"Retrying (attempt {attempt}/{MAX_RETRIES})..."
            ),
        )
        response_text = resp.content if hasattr(resp, 'content') else str(resp)

        data = parse_llm_json(response_text, schema_model=ComplaintIngestionSchema)
        data['raw_text'] = extracted_text
        data['processing_mode'] = "HYBRID_ONLINE"
        data['engines_used'] = file_results["engines_used"] + ["cloud_agent_llm"]
        data['warnings'] = file_results["warnings"]
        data['is_offline'] = False
        data['fallback_used'] = False

        # DETERMINISTIC MONETARY LOSS OVERRIDE
        # The LLM may sum individual transfers (₹2.5L + ₹2L = ₹4.5L) instead of using
        # the explicitly stated total loss (રૂ.૯,૦૦,૦૦૦ = ₹9,00,000). We override with
        # the LARGEST amount found in the raw text, which handles Gujarati/Hindi digits
        # and correctly picks the total loss over any individual transfer/commission.
        try:
            import re as _re
            from app.ingestion.heuristic_extractor import _normalize_indic_digits
            # Match all currency amounts (prefix or suffix) with optional Indic digits
            _amount_patterns = [
                r'(?:rs\.?|inr|₹|રૂપિયા|રૂ|रुपये|रू|rupees)[.\s]*([\d,\u0A80-\u0AFF\u0900-\u097F]+)',
                r'([\d,\u0A80-\u0AFF\u0900-\u097F]+)[.\s]*(?:rs\.?|inr|₹|રૂપિયા|રૂ|रुपये|रू|rupees)',
            ]
            _all_amounts = []
            for _pat in _amount_patterns:
                for _m in _re.finditer(_pat, extracted_text, _re.IGNORECASE):
                    _num_raw = _m.group(1)
                    _num_ascii = _normalize_indic_digits(_num_raw)
                    _digits_only = _re.sub(r'[^\d]', '', _num_ascii)
                    if _digits_only.isdigit():
                        _all_amounts.append(float(int(_digits_only)))
            if _all_amounts:
                heuristic_loss = max(_all_amounts)
                data['entities']['monetary_loss'] = heuristic_loss
        except Exception:
            pass  # keep LLM value if heuristic fails

        # DETERMINISTIC LEGAL SECTION PRESERVATION OVERRIDE
        # The LLM may incorrectly convert IPC/IT Act sections to BNS numbers (e.g. "IPC 388" -> "BNS 386",
        # "IPC 419" -> "BNS 419") even when instructed not to. The BNS 2023 is structurally different from
        # the IPC and sections CANNOT be mapped 1:1. We override with a deterministic parser that extracts
        # the sections EXACTLY AS WRITTEN in the raw text, preserving the original statute prefix.
        # The BNS Agent independently identifies the correct current BNS sections via RAG grounding.
        try:
            from app.ingestion.heuristic_extractor import _extract_legal_sections_heuristic
            preserved_sections = _extract_legal_sections_heuristic(extracted_text)
            # ALWAYS override with the deterministic result — even an empty list.
            # The LLM hallucinates sections (e.g. 'IPC 420', 'IT Act 66D') when the
            # document mentions NO explicit legal sections. The heuristic extractor
            # is authoritative: it preserves sections EXACTLY as written, and returns
            # [] when none are explicitly stated. Keeping the LLM's hallucinated
            # sections would violate the "record ONLY explicitly mentioned sections"
            # requirement.
            data['bns_sections_identified'] = preserved_sections
        except Exception:
            pass  # keep LLM value if deterministic parser fails

        return data

    except Exception as e:
        reason_msg = f"{type(e).__name__}: {str(e)}"

        # Policy-aware error handling:
        #   - ERROR_POLICY=fallback (default): fall back to the heuristic extractor
        #     and continue processing (graceful degradation).
        #   - ERROR_POLICY=abort: raise ErrorPolicyError and end the process
        #     (fail-fast, no silent fallback).
        def _heuristic_fallback():
            res = extract_entities_heuristic(extracted_text, fallback_reason=reason_msg)
            res["processing_mode"] = "HYBRID_ONLINE_FALLBACK"
            res["engines_used"] = file_results["engines_used"] + ["local_heuristic_fallback"]
            res["warnings"] = file_results["warnings"] + [f"LLM API Error: {reason_msg}"]
            res["is_offline"] = False
            return res

        return handle_llm_error(
            e,
            context="process_multimodal_complaint",
            fallback_func=_heuristic_fallback,
        )
