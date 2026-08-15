"""
CRIME OS AI — EMAIL RESPONSE MANAGER & GROQ LLM CLASSIFIER
===========================================================
Clean, high-precision module for law enforcement email reply processing:
1. Ingests incoming authority email replies & attachments (CSV, PDF, Text).
2. Classifies reply using Groq LLM (llama-3.3-70b-versatile) as Priority 1.
3. Detects if requested data is COMPLETE or PARTIAL.
4. Generates contextual followback directives (PSI V.K. Patel) when partial.
5. NO auto-sending: Followbacks are returned for explicit human review & dispatch.
"""

import os
import re
import time
import json
import hashlib
import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Global deterministic classification cache by email_hash
_CLASSIFICATION_CACHE: Dict[str, Dict[str, Any]] = {}

CLASSIFICATION_DESCRIPTIONS = {
    "CASE_COMPLETE": "Authority has fully complied -- account frozen, documents sent, or all requested data provided.",
    "PARTIAL_DATA_RECEIVED": "Authority sent partial data/documents. Missing required items.",
    "CLARIFICATION_ASKED": "Authority is asking a specific operational or legal question before complying.",
    "DECLINED": "Authority is refusing or citing legal/procedural barriers.",
    "BOUNCED": "Technical mailer-daemon bounce or auto-responder.",
    "ACKNOWLEDGEMENT_ONLY": "Authority only acknowledged receipt without providing data.",
}


def _rule_based_fallback(
    case_number: str,
    sender_email: str,
    subject: str,
    body_text: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    reason: str = "Rule-based fallback",
    email_hash: Optional[str] = None
) -> Dict[str, Any]:
    clean_body = (body_text or "").lower()
    clean_subj = (subject or "").lower()
    has_att = bool(attachments)
    e_hash = email_hash or hashlib.sha256(f"{case_number}_{sender_email}_{subject}_{body_text}".encode()).hexdigest()[:12]

    clean_subject_base = re.sub(r"\s*\[CrimeOS-REF:[^\]]*\]", "", subject or "").strip()
    if not clean_subject_base.startswith("Re:"):
        clean_subject_base = f"Re: {clean_subject_base}"
    reply_subject = f"{clean_subject_base} [CrimeOS-REF: {case_number}]"

    if any(k in sender_email.lower() for k in ["mailer-daemon", "postmaster"]) or "undeliverable" in clean_subj:
        return {
            "id": f"REPLY-{e_hash}",
            "case_number": case_number,
            "sender_email": sender_email,
            "subject": subject,
            "body_text": body_text,
            "attachments": attachments or [],
            "classification": "BOUNCED",
            "classification_reason": f"Automated mail delivery failure detected ({reason}).",
            "is_complete": False,
            "received_items": ["Mail delivery failure notification"],
            "missing_items": ["All requested case data"],
            "followback_draft": None,
            "llm_provider": "CrimeOS Intelligence AI",
            "status": "BOUNCED"
        }

    if any(k in clean_body for k in ["fully complied", "account frozen", "debit freeze confirmed", "compliance report", "all data attached"]):
        return {
            "id": f"REPLY-{e_hash}",
            "case_number": case_number,
            "sender_email": sender_email,
            "subject": subject,
            "body_text": body_text,
            "attachments": attachments or [],
            "classification": "CASE_COMPLETE",
            "classification_reason": f"Authority confirmed full compliance ({reason}).",
            "is_complete": True,
            "received_items": ["Full statutory compliance confirmation", "Requested evidence attachments" if has_att else "Direct compliance report"],
            "missing_items": [],
            "followback_draft": None,
            "llm_provider": "CrimeOS Intelligence AI",
            "status": "COMPLETED"
        }

    draft_body = (
        f"STATUTORY DIRECTIVE FOLLOW-UP\n\n"
        f"To Nodal / Compliance Officer ({sender_email}),\n\n"
        f"We acknowledge receipt of your response regarding FIR / Case Ref {case_number}.\n\n"
        f"Please supply the complete unredacted itemized transaction ledger / subscriber details / CDR logs as requested in our statutory directive under Section 94 BNSS within 48 HOURS.\n\n"
        f"Investigating Officer,\n"
        f"PSI Inspector V. K. Patel\n"
        f"Surat Cyber Crime Police Station"
    )

    return {
        "id": f"REPLY-{e_hash}",
        "case_number": case_number,
        "sender_email": sender_email,
        "subject": subject,
        "body_text": body_text,
        "attachments": attachments or [],
        "classification": "PARTIAL_DATA_RECEIVED" if (has_att or "attach" in clean_body) else "ACKNOWLEDGEMENT_ONLY",
        "classification_reason": f"Response ingested ({reason}). Statutory follow-up directive drafted.",
        "is_complete": False,
        "received_items": ["Partial email response" if not has_att else "Attached evidence files"],
        "missing_items": ["Complete itemized transaction ledger / CDR logs"],
        "followback_draft": {
            "subject": reply_subject,
            "body": draft_body
        },
        "llm_provider": "CrimeOS Intelligence AI",
        "status": "FOLLOWBACK_REQUIRED"
    }


def classify_reply_with_groq(
    case_number: str,
    sender_email: str,
    subject: str,
    body_text: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    groq_api_key: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    thread_history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Classifies authority email reply using Groq LLM (llama-3.3-70b-versatile) as Priority 1,
    Gemini Flash as Priority 2, and Rule-based as Priority 3.
    """
    email_hash = hashlib.sha256(f"{case_number}_{sender_email}_{subject}_{body_text}".encode()).hexdigest()[:12]
    if email_hash in _CLASSIFICATION_CACHE:
        return _CLASSIFICATION_CACHE[email_hash]

    groq_key = (groq_api_key or os.environ.get("GROQ_API_KEY", "")).strip("'\" \t\r\n")
    gemini_key = (gemini_api_key or os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")).strip("'\" \t\r\n")

    clean_body = (body_text or "").strip()
    if not clean_body:
        clean_body = "[No plain text body -- attachment or HTML content only]"

    att_names = [a.get("filename", "attachment") for a in (attachments or [])]
    att_summary = ", ".join(att_names) if att_names else "None"

    clean_subject = re.sub(r"\s*\[CrimeOS-REF:[^\]]*\]", "", subject or "").strip()
    if not clean_subject.startswith("Re:"):
        clean_subject = f"Re: {clean_subject}"
    reply_subject = f"{clean_subject} [CrimeOS-REF: {case_number}]"

    # Multi-turn thread history context
    history_str = ""
    if thread_history:
        history_lines = []
        for idx, item in enumerate(thread_history):
            h_subj = item.get("subject", "Directive")
            h_body = (item.get("body") or item.get("body_text") or "")[:400]
            history_lines.append(f"Turn #{idx+1}: Subject '{h_subj}' | Body: '{h_body}'")
        history_str = "\nPREVIOUS DIRECTIVES & THREAD HISTORY:\n" + "\n".join(history_lines) + "\n"

    prompt = f"""You are PSI V.K. Patel, Police Sub-Inspector, Surat Cyber Crime Police Station, Gujarat.

You issued statutory directives under Section 94 BNSS / Section 91 CrPC for FIR Case {case_number}. The authority has replied.
{history_str}
AUTHORITY REPLY EMAIL:
- From: {sender_email}
- Subject: {subject}
- Body: "{clean_body[:3500]}"
- Attachments Received: {att_summary}

TASK:
1. Classify the reply into ONE of:
   - CASE_COMPLETE: Authority fully complied (account frozen, requested data/logs sent, all info provided).
   - PARTIAL_DATA_RECEIVED: Authority sent some data but missing required items.
   - CLARIFICATION_ASKED: Authority asks a specific question before complying (NOT refusing).
   - DECLINED: Authority refuses or cites procedural barrier.
   - BOUNCED: Delivery failure or postmaster bounce.
   - ACKNOWLEDGEMENT_ONLY: Acknowledged receipt without data.

2. Determine if data is COMPLETE (is_complete = true) or PARTIAL (is_complete = false).

3. If is_complete = false, write a professional, non-generic followback email body from PSI V.K. Patel.
   - Address their exact words or missing items.
   - 3 short focused paragraphs under Section 94 BNSS.
   - If is_complete = true, set followback_subject = "" and followback_body = "".

Return ONLY valid JSON matching this exact structure:
{{
  "classification": "<one of the 6 types>",
  "classification_reason": "<1-2 sentences>",
  "is_complete": <true or false>,
  "received_items": ["<item 1>", "<item 2>"],
  "missing_items": ["<missing 1>"],
  "followback_subject": "{reply_subject}",
  "followback_body": "<email body string or empty string>"
}}"""

    # Priority 1: Groq API Call
    if groq_key:
        models = [os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"), "llama3-70b-8192", "mixtral-8x7b-32768"]
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        for m in models:
            try:
                payload = {
                    "model": m,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"}
                }
                res = requests.post(url, json=payload, headers=headers, timeout=25)
                if res.status_code == 200:
                    parsed = json.loads(res.json()["choices"][0]["message"]["content"])
                    is_comp = bool(parsed.get("is_complete") or parsed.get("classification") == "CASE_COMPLETE")
                    fb_draft = None
                    if not is_comp and parsed.get("followback_body"):
                        fb_draft = {
                            "subject": parsed.get("followback_subject") or reply_subject,
                            "body": parsed.get("followback_body")
                        }
                    result = {
                        "id": f"REPLY-{email_hash}",
                        "case_number": case_number,
                        "sender_email": sender_email,
                        "subject": subject,
                        "body_text": body_text,
                        "attachments": attachments or [],
                        "classification": parsed.get("classification", "PARTIAL_DATA_RECEIVED"),
                        "classification_reason": parsed.get("classification_reason", "Automated intelligence audit parsed authority reply."),
                        "is_complete": is_comp,
                        "received_items": parsed.get("received_items", ["Authority reply ingested"]),
                        "missing_items": parsed.get("missing_items", []),
                        "followback_draft": fb_draft,
                        "llm_provider": "CrimeOS Intelligence AI",
                        "status": "COMPLETED" if is_comp else "FOLLOWBACK_REQUIRED"
                    }
                    _CLASSIFICATION_CACHE[email_hash] = result
                    return result
            except Exception as e:
                logger.warning(f"[EmailResponseManager] Groq model {m} call error: {e}")

    # Priority 2: Gemini API Call
    if gemini_key:
        models = [os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"), "gemini-2.5-flash", "gemini-1.5-flash"]
        for m in models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.25, "response_mime_type": "application/json"}
                }
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=25)
                if res.status_code == 200:
                    candidate_text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(candidate_text)
                    is_comp = bool(parsed.get("is_complete") or parsed.get("classification") == "CASE_COMPLETE")
                    fb_draft = None
                    if not is_comp and parsed.get("followback_body"):
                        fb_draft = {
                            "subject": parsed.get("followback_subject") or reply_subject,
                            "body": parsed.get("followback_body")
                        }
                    result = {
                        "id": f"REPLY-{email_hash}",
                        "case_number": case_number,
                        "sender_email": sender_email,
                        "subject": subject,
                        "body_text": body_text,
                        "attachments": attachments or [],
                        "classification": parsed.get("classification", "PARTIAL_DATA_RECEIVED"),
                        "classification_reason": parsed.get("classification_reason", "Automated intelligence audit parsed authority reply."),
                        "is_complete": is_comp,
                        "received_items": parsed.get("received_items", ["Authority reply ingested"]),
                        "missing_items": parsed.get("missing_items", []),
                        "followback_draft": fb_draft,
                        "llm_provider": "CrimeOS Intelligence AI",
                        "status": "COMPLETED" if is_comp else "FOLLOWBACK_REQUIRED"
                    }
                    _CLASSIFICATION_CACHE[email_hash] = result
                    return result
            except Exception as e:
                logger.warning(f"[EmailResponseManager] Gemini model {m} call error: {e}")

    # Priority 3: Rule-based Fallback
    fallback_res = _rule_based_fallback(case_number, sender_email, subject, body_text, attachments, reason="LLM services unavailable", email_hash=email_hash)
    _CLASSIFICATION_CACHE[email_hash] = fallback_res
    return fallback_res
