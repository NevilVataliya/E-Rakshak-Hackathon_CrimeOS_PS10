"""
SMART CONTEXTUAL REPLY CLASSIFIER
==================================
Module 4 — Workflow Automator Intelligence Layer

A two-phase Gemini AI classifier that:
  Phase 1 -> Classifies the authority's reply into one of 7 types
  Phase 2 -> Generates a perfectly contextual, human-sounding response

Key design principles:
- NEVER fire a generic "comply or face Section 223" notice blindly
- Read and respond to what the authority ACTUALLY said
- Avoid communication mismatch (e.g., threatening someone who asked a legitimate question)
- Detect case completion -- if they complied fully, mark COMPLETE, generate no reply
"""

import os
import json
import logging
import re
from typing import Dict, Any, List, Optional
import requests

logger = logging.getLogger(__name__)

CLASSIFICATION_TYPES = {
    "CASE_COMPLETE": (
        "Authority has fully complied -- account frozen, documents sent, all requested "
        "data provided. No further follow-up needed."
    ),
    "PARTIAL_DATA_RECEIVED": (
        "Authority sent some but not all requested data or documents. "
        "Acknowledge what was received and request only what is still missing."
    ),
    "CLARIFICATION_ASKED": (
        "Authority is asking us a specific question before they can comply "
        "(e.g., 'which court order?', 'please confirm the account holder name', "
        "'we need the FIR copy'). They are NOT refusing -- they are co-operating."
    ),
    "DECLINED": (
        "Authority is refusing or citing legal/procedural barriers "
        "(e.g., 'we need a High Court order', 'outside our jurisdiction', "
        "'our legal team requires a subpoena'). Firm escalation needed."
    ),
    "BOUNCED_TECHNICAL": (
        "This is a MAILER-DAEMON delivery failure, postmaster bounce, "
        "or automated out-of-office/vacation responder. Not a human reply."
    ),
    "ACKNOWLEDGEMENT_ONLY": (
        "Authority only acknowledged receipt ('noted', 'received', 'under process') "
        "without providing any data or firm compliance confirmation. "
        "Needs a soft follow-up asking for action/timeline."
    ),
    "UNRELATED": (
        "Email has no connection to the case or the original directive. "
        "Could be spam, wrong thread, or internal communication."
    ),
}

NO_REPLY_CLASSIFICATIONS = {"CASE_COMPLETE", "BOUNCED_TECHNICAL", "UNRELATED"}


def _rule_based_fallback(
    case_number: str,
    sender_email: str,
    subject: str,
    body_text: str,
    attachments=None,
    reason: str = "Fallback rule-based mode"
) -> Dict[str, Any]:
    clean_body = (body_text or "").lower()
    clean_subj = (subject or "").lower()
    has_att = bool(attachments)
    
    clean_subject_base = re.sub(r"\s*\[CrimeOS-REF:[^\]]*\]", "", subject or "").strip()
    if not clean_subject_base.startswith("Re:"):
        clean_subject_base = f"Re: {clean_subject_base}"
    reply_subject = f"{clean_subject_base} [CrimeOS-REF: {case_number}]"

    if "mailer-daemon" in sender_email.lower() or "undeliverable" in clean_subj or "postmaster" in sender_email.lower():
        return {
            "classification": "BOUNCED_TECHNICAL",
            "classification_reason": f"System email bounce detected ({reason}).",
            "case_status": "NEEDS_FOLLOWUP",
            "should_generate_reply": False,
            "recommended_action": "Verify recipient email address and retry dispatch.",
            "draft_subject": reply_subject,
            "draft_body": "",
            "key_findings": ["Automated mail delivery failure notification"],
            "llm_provider": "Rule-Based Fallback"
        }
    
    if any(k in clean_body for k in ["fully complied", "account frozen", "debit freeze confirmed", "compliance report"]):
        return {
            "classification": "CASE_COMPLETE",
            "classification_reason": f"Authority indicated compliance ({reason}).",
            "case_status": "COMPLETE",
            "should_generate_reply": False,
            "recommended_action": "Case compliance verified. No further reply required.",
            "draft_subject": reply_subject,
            "draft_body": "",
            "key_findings": ["Authority confirmed full statutory compliance"],
            "llm_provider": "Rule-Based Fallback"
        }

    draft_body = (
        f"STATUTORY DIRECTIVE FOLLOW-UP\n\n"
        f"To Nodal / Compliance Officer ({sender_email}),\n\n"
        f"We acknowledge receipt of your response regarding Case FIR No. {case_number}.\n\n"
        f"Please supply the complete unredacted itemized transaction ledger / subscriber details / CDR logs as requested in our statutory directive under Section 94 BNSS within 48 HOURS.\n\n"
        f"Investigating Officer,\n"
        f"PSI Inspector V. K. Patel\n"
        f"Surat Cyber Crime Police Station"
    )
    
    return {
        "classification": "PARTIAL_DATA_RECEIVED" if (has_att or "attach" in clean_body) else "ACKNOWLEDGEMENT_ONLY",
        "classification_reason": f"Response ingested ({reason}). Statutory follow-up directive drafted.",
        "case_status": "NEEDS_FOLLOWUP",
        "should_generate_reply": True,
        "recommended_action": f"Review statutory follow-up directive for {sender_email}",
        "draft_subject": reply_subject,
        "draft_body": draft_body,
        "key_findings": [f"Parsed reply from {sender_email}", "Evidence attachments stored in case database" if has_att else "Awaiting complete data cure"],
        "llm_provider": "Rule-Based Fallback"
    }


def _call_groq_api(prompt: str, groq_key: str) -> Optional[Dict[str, Any]]:
    """Calls Groq API as Priority 1 LLM service."""
    clean_key = groq_key.strip("'\" \t\r\n")
    models_to_try = [
        os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "llama3-70b-8192",
        "mixtral-8x7b-32768"
    ]
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {clean_key}",
        "Content-Type": "application/json"
    }
    
    for m in models_to_try:
        try:
            payload = {
                "model": m,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "response_format": {"type": "json_object"}
            }
            res = requests.post(url, json=payload, headers=headers, timeout=25)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                if "classification" in parsed and "case_status" in parsed:
                    parsed["llm_provider"] = f"Groq AI ({m})"
                    return parsed
            else:
                logger.warning(f"[ReplyClassifier] Groq model {m} returned HTTP {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.warning(f"[ReplyClassifier] Groq call failed for model {m}: {e}")
    return None


def _call_gemini_api(prompt: str, gemini_key: str) -> Optional[Dict[str, Any]]:
    """Calls Gemini API as Priority 2 LLM service."""
    clean_key = gemini_key.strip("'\" \t\r\n")
    models_to_try = [
        os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]
    
    for m in models_to_try:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={clean_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.25, "response_mime_type": "application/json"},
            }
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=25)
            if res.status_code == 200:
                data = res.json()
                candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(candidate_text)
                if "classification" in parsed and "case_status" in parsed:
                    parsed["llm_provider"] = f"Gemini AI ({m})"
                    return parsed
            else:
                logger.warning(f"[ReplyClassifier] Gemini model {m} HTTP {res.status_code}: {res.text[:200]}")
        except Exception as e:
            logger.warning(f"[ReplyClassifier] Gemini model {m} failed: {e}")
    return None


def _call_ollama_api(prompt: str) -> Optional[Dict[str, Any]]:
    """Calls Local Ollama instance for sovereign offline reply classification."""
    use_ollama = os.environ.get("USE_OLLAMA", "true").lower() in ("true", "1", "yes")
    if not use_ollama:
        return None

    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip('/')
    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3:latest")
    try:
        url = f"{ollama_url}/api/chat"
        payload = {
            "model": ollama_model,
            "messages": [{"role": "user", "content": prompt}],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.2}
        }
        res = requests.post(url, json=payload, timeout=40)
        if res.status_code == 200:
            data = res.json()
            raw_content = data.get("message", {}).get("content", "{}")
            parsed = json.loads(raw_content)
            if "classification" in parsed and "case_status" in parsed:
                parsed["llm_provider"] = f"Local Ollama AI ({ollama_model})"
                return parsed
    except Exception as oe:
        logger.warning(f"[ReplyClassifier] Ollama execution notice: {oe}")
    return None


def classify_and_respond(
    case_number: str,
    sender_email: str,
    subject: str,
    body_text: str,
    attachments=None,
    original_notice_subject=None,
    original_notice_body=None,
    notice_history: Optional[List[Dict[str, Any]]] = None,
    api_key=None,
    groq_api_key=None,
) -> Dict[str, Any]:
    """
    Smart Reply Classifier & Response Generator (Groq 1st Priority -> Gemini 2nd Priority -> Local Ollama 3rd -> Rule-based 4th).
    Reads authority reply and multi-turn notice history, classifies compliance level, and generates contextual response.
    """
    groq_key = groq_api_key or os.environ.get("GROQ_API_KEY")
    gemini_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    clean_body = (body_text or "").strip()
    if not clean_body:
        clean_body = "[No plain text body -- email may have only HTML or attachment content]"

    att_names = [a.get("filename", "attachment") for a in (attachments or [])]
    att_summary = ", ".join(att_names) if att_names else "None"

    clean_subject = re.sub(r"\s*\[CrimeOS-REF:[^\]]*\]", "", subject or "").strip()
    if not clean_subject.startswith("Re:"):
        clean_subject = f"Re: {clean_subject}"
    reply_subject = f"{clean_subject} [CrimeOS-REF: {case_number}]"

    # Compile multi-turn history context for this authority
    history_lines = []
    if notice_history:
        for idx, item in enumerate(notice_history):
            h_subj = item.get("subject", "Directive")
            h_body = (item.get("body") or item.get("body_text") or "")[:500]
            h_type = item.get("type", "NOTICE_DISPATCH")
            h_date = item.get("sent_at") or item.get("timestamp") or "Prior"
            history_lines.append(f"Turn #{idx+1} [{h_type} at {h_date}]:\nSubject: {h_subj}\nBody excerpt: {h_body}\n")
    elif original_notice_subject or original_notice_body:
        history_lines.append(
            f"Original Notice Sent:\nSubject: {original_notice_subject or 'N/A'}\n"
            f"Body excerpt: {(original_notice_body or '')[:1500]}\n"
        )

    if history_lines:
        orig_ctx = "\nCOMMUNICATION THREAD & PREVIOUS DIRECTIVES SENT TO THIS AUTHORITY:\n" + "\n".join(history_lines) + "\n"
    else:
        orig_ctx = "\nCOMMUNICATION THREAD CONTEXT: First-contact reply (no prior history recorded).\n"

    class_list = "\n".join(f"  - {k}: {v}" for k, v in CLASSIFICATION_TYPES.items())

    prompt = f"""You are PSI V.K. Patel, Police Sub-Inspector, Surat Cyber Crime Police Station, Gujarat.

You sent statutory notices (under Section 94 BNSS / Section 91 CrPC) to an authority for FIR investigation {case_number}. They have replied. Your task is to analyze their reply, determine compliance, and generate a precise, contextual followback directive -- NOT a generic boilerplate template.

{orig_ctx}
THEIR LATEST REPLY EMAIL:
- From: {sender_email}
- Subject: {subject}
- Body: "{clean_body[:3500]}"
- Attachments Received: {att_summary}

TASK -- COMPLETE ALL THREE STEPS:

STEP 1 -- CLASSIFY their reply. Choose exactly ONE:
{class_list}

STEP 2 -- DECIDE response strategy based on classification:
  - CASE_COMPLETE: set case_status = "COMPLETE", should_generate_reply = false. No draft needed.
  - PARTIAL_DATA_RECEIVED: Acknowledge what was received specifically. Request ONLY what is still missing.
  - CLARIFICATION_ASKED: DIRECTLY answer their exact question(s). Do NOT threaten them -- they are cooperating.
  - DECLINED: Address their specific objection with legal basis. Firm 48-hour deadline. Cite Section 94 BNSS.
  - BOUNCED_TECHNICAL: set case_status = "NEEDS_FOLLOWUP", should_generate_reply = false.
  - ACKNOWLEDGEMENT_ONLY: Soft follow-up. Ask for specific action or timeline.
  - UNRELATED: set should_generate_reply = false.

STEP 3 -- Write the response email body (ONLY if should_generate_reply = true):

STRICT WRITING RULES:
1. DO NOT start with generic "Dear Sir/Madam" if you know the institution or sender name
2. DO NOT say "you have not complied" or issue Section 223 threat if they sent data or asked a question
3. Reference THEIR EXACT WORDS / missing data items from their email
4. Keep it 3-4 focused paragraphs -- concise, professional police officer tone
5. If case_status = COMPLETE, draft_body must be empty string ""

Return ONLY valid JSON:
{{
  "classification": "<one of the 7 types>",
  "classification_reason": "<1-2 sentence explanation>",
  "case_status": "<COMPLETE or NEEDS_FOLLOWUP>",
  "should_generate_reply": <true or false>,
  "recommended_action": "<short 1-line action>",
  "draft_subject": "{reply_subject}",
  "draft_body": "<full email body or empty string>",
  "key_findings": ["<finding 1>", "<finding 2>"]
}}"""

    # Priority 1: Groq API
    if groq_key:
        groq_res = _call_groq_api(prompt, groq_key)
        if groq_res:
            if groq_res["classification"] in NO_REPLY_CLASSIFICATIONS:
                groq_res["should_generate_reply"] = False
                groq_res["draft_body"] = ""
            logger.info(f"[ReplyClassifier] Groq matched {case_number} | {sender_email} | {groq_res['classification']}")
            return groq_res

    # Priority 2: Gemini API
    if gemini_key:
        gemini_res = _call_gemini_api(prompt, gemini_key)
        if gemini_res:
            if gemini_res["classification"] in NO_REPLY_CLASSIFICATIONS:
                gemini_res["should_generate_reply"] = False
                gemini_res["draft_body"] = ""
            logger.info(f"[ReplyClassifier] Gemini matched {case_number} | {sender_email} | {gemini_res['classification']}")
            return gemini_res

    # Priority 3: Local Ollama (Sovereign Offline AI)
    ollama_res = _call_ollama_api(prompt)
    if ollama_res:
        if ollama_res["classification"] in NO_REPLY_CLASSIFICATIONS:
            ollama_res["should_generate_reply"] = False
            ollama_res["draft_body"] = ""
        logger.info(f"[ReplyClassifier] Ollama matched {case_number} | {sender_email} | {ollama_res['classification']}")
        return ollama_res

    # Priority 4: Rule-Based Fallback
    logger.info("[ReplyClassifier] LLM services unavailable — using rule-based fallback classifier.")
    return _rule_based_fallback(case_number, sender_email, subject, body_text, attachments, reason="LLM services unconfigured or unreachable")


def classify_reply_simple(
    case_number: str,
    sender_email: str,
    subject: str,
    body_text: str,
    attachments=None,
    api_key=None,
    groq_api_key=None,
) -> Dict[str, Any]:
    """Simplified wrapper for callers without original notice context."""
    return classify_and_respond(
        case_number=case_number,
        sender_email=sender_email,
        subject=subject,
        body_text=body_text,
        attachments=attachments,
        api_key=api_key,
        groq_api_key=groq_api_key,
    )

