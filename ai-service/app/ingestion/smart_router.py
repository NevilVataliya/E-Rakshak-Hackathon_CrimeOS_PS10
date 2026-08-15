import os
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
Record ONLY sections of Bharatiya Nyaya Sanhita (BNS) 2023, Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023, Bharatiya Sakshya Adhiniyam (BSA) 2023, and Information Technology Act (IT Act) 2000 that correspond directly to the alleged criminal acts. Include the section number AND a short description in brackets.

Respond ONLY in valid JSON matching this exact structure:
{{
  "original_language": "gu|hi|en",
  "translated_text": "<FULL ENGLISH TRANSLATION covering all facts>",
  "crime_category": "CYBER|CONVENTIONAL|HYBRID",
  "crime_sub_type": "<SPECIFIC SUB TYPE BASED ON FACTS>",
  "severity_score": 7.5,
  "bns_sections_identified": [],
  "entities": {{
    "persons": [
      {{
        "name": "<FULL NAME OR NULL>",
        "alias": "<ALIAS OR IMPERSONATED IDENTITY IF STATED, OTHERWISE NULL>",
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
        
        resp = llm.invoke(prompt_text)
        response_text = resp.content if hasattr(resp, 'content') else str(resp)

        data = parse_llm_json(response_text, schema_model=ComplaintIngestionSchema)
        data['raw_text'] = extracted_text
        data['processing_mode'] = "HYBRID_ONLINE"
        data['engines_used'] = file_results["engines_used"] + ["cloud_agent_llm"]
        data['warnings'] = file_results["warnings"]
        data['is_offline'] = False
        data['fallback_used'] = False

        # STAGE 2: CRITIC / DUAL-AGENT VERIFIER & HARVESTER
        # Cross-checks candidate entities against the raw text with a focused verification pass
        # to ensure ZERO false positives, 100% true entity capture (multi-hop banks, @handles),
        # and non-destructive loss calculation.
        try:
            import re as _re
            from app.ingestion.heuristic_extractor import _normalize_indic_digits, extract_monetary_amounts

            candidate_entities = data.get("entities", {})

            # 1. Non-Destructive Monetary Loss Harvester (Union approach using comprehensive MONEY_REGEX)
            _all_amounts = extract_monetary_amounts(extracted_text)
            existing_loss = float(candidate_entities.get("monetary_loss") or 0)
            if _all_amounts:
                candidate_entities["monetary_loss"] = max(existing_loss, max(_all_amounts))

            # 2. Non-Destructive Handle & URL Harvester
            raw_handles = _re.findall(r'(?:@|t\.me/)([A-Za-z0-9_]{3,})', extracted_text)
            raw_urls = _re.findall(r'https?://[^\s<>"\'\)]+', extracted_text)
            current_h_set = set()
            for h in candidate_entities.get("online_handles", []):
                h_str = h if isinstance(h, str) else (h.get("handle") or str(h))
                current_h_set.add(h_str.lower())

            for h in raw_handles:
                clean_h = f"@{h}"
                if clean_h.lower() not in current_h_set:
                    candidate_entities.setdefault("online_handles", []).append(clean_h)
                    current_h_set.add(clean_h.lower())
            for u in raw_urls:
                clean_u = u.rstrip('.,;:)')
                if clean_u.lower() not in current_h_set:
                    candidate_entities.setdefault("online_handles", []).append(clean_u)
                    current_h_set.add(clean_u.lower())

            # 3. Critic / Verifier LLM Pass
            critic_prompt = f"""You are the Lead Forensic Verification & Entity Auditor for CrimeOS (Law Enforcement OS).

TASK: Audit and verify the CANDIDATE ENTITIES against the RAW COMPLAINT TEXT with 100% precision.

RAW COMPLAINT TEXT:
\"\"\"{extracted_text[:6000]}\"\"\"

CANDIDATE ENTITIES:
{json.dumps(candidate_entities, indent=2)}

AUDIT & GROUNDING RULES:
1. ZERO FALSE POSITIVES: Remove any candidate entity not explicitly supported by the raw complaint text.
2. ZERO OMISSIONS (CATCH ALL HOPS & HANDLES):
   - Check if ALL bank accounts mentioned in text are included (e.g. Layer-1, Layer-2, Layer-3 mule accounts, IFSC codes).
   - Check if ALL online handles/IDs are included (e.g. Telegram @handles, URLs).
   - Check if ALL suspects, aliases (urfé / ઉર્ફે), or fake impersonated identities are included.
   - Resolve Bank Names from Indic text (e.g. 'યુનિયન બેન્ક' -> 'Union Bank of India', 'ઇન્ડસઇન્ડ' -> 'IndusInd Bank', 'આઇડીબીઆઇ' -> 'IDBI Bank', 'એસબીઆઇ' -> 'State Bank of India') and from 4-letter IFSC prefixes.
   - Ensure monetary_loss reflects the total defrauded amount.
   - Ensure money_trail records every transfer step sequentially.

Return ONLY a valid JSON object for "entities" matching the schema:
{{
  "persons": [
    {{
      "name": "...",
      "alias": null,
      "role": "victim|accused|suspect|witness|mule|fake_identity",
      "father_name": null,
      "age": null,
      "address": null,
      "status": null
    }}
  ],
  "phone_numbers": ["..."],
  "email_addresses": ["..."],
  "online_handles": ["..."],
  "bank_accounts": [
    {{
      "account_number": "...",
      "ifsc": "...",
      "bank": "...",
      "account_name": "...",
      "account_role": "victim|accused",
      "is_victim_account": true|false
    }}
  ],
  "vpas_upis": ["..."],
  "monetary_loss": 0,
  "money_trail": [
    {{
      "step": 1,
      "from_account": "...",
      "from_bank": "...",
      "to_account": "...",
      "to_bank": "...",
      "amount": 0,
      "method": "...",
      "date": "...",
      "notes": "..."
    }}
  ],
  "crime_locations": ["..."],
  "date_time_of_incident": "..."
}}"""

            critic_resp = llm.invoke(critic_prompt)
            critic_text = critic_resp.content if hasattr(critic_resp, 'content') else str(critic_resp)
            verified_entities = parse_llm_json(critic_text)

            if isinstance(verified_entities, dict) and "bank_accounts" in verified_entities:
                # Normalize online_handles to list of strings
                norm_handles = []
                for h in verified_entities.get("online_handles", []):
                    if isinstance(h, dict):
                        norm_handles.append(h.get("handle") or str(h))
                    elif isinstance(h, str):
                        norm_handles.append(h)
                verified_entities["online_handles"] = norm_handles

                # Map bank accounts and IFSC codes
                ifsc_map = {
                    "UBIN": "Union Bank of India",
                    "INDB": "IndusInd Bank",
                    "IBKL": "IDBI Bank",
                    "SBIN": "State Bank of India",
                    "HDFC": "HDFC Bank",
                    "ICIC": "ICICI Bank",
                    "UTIB": "Axis Bank",
                    "PUNB": "Punjab National Bank",
                    "BARB": "Bank of Baroda",
                    "CNRB": "Canara Bank",
                    "KKBK": "Kotak Mahindra Bank",
                    "YESB": "Yes Bank"
                }
                for b in verified_entities.get("bank_accounts", []):
                    if isinstance(b, dict):
                        ifsc = (b.get("ifsc") or "").strip().upper()
                        if ifsc and len(ifsc) >= 4 and not b.get("bank"):
                            b["bank"] = ifsc_map.get(ifsc[:4], b.get("bank"))
                        elif ifsc and len(ifsc) >= 4 and ifsc[:4] in ifsc_map:
                            b["bank"] = ifsc_map[ifsc[:4]]

                data["entities"] = verified_entities

        except Exception as critic_err:
            print(f"⚠️ [Critic Verifier Pass Note]: {critic_err}")

        # DETERMINISTIC LEGAL SECTION PRESERVATION OVERRIDE
        try:
            from app.ingestion.heuristic_extractor import _extract_legal_sections_heuristic
            preserved_sections = _extract_legal_sections_heuristic(extracted_text)
            data['bns_sections_identified'] = preserved_sections
        except Exception:
            pass

        return data

    except Exception as e:
        reason_msg = f"{type(e).__name__}: {str(e)}"
        print(f"⚠️ [INGESTION WARNING] LLM Exception: {reason_msg}. Falling back to Heuristic Extractor.")
        res = extract_entities_heuristic(extracted_text, fallback_reason=reason_msg)
        res["processing_mode"] = "HYBRID_ONLINE_FALLBACK"
        res["engines_used"] = file_results["engines_used"] + ["local_heuristic_fallback"]
        res["warnings"] = file_results["warnings"] + [f"LLM API Error: {reason_msg}"]
        res["is_offline"] = False
        return res
