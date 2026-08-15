import os
import sys
import json
import logging
import datetime
from typing import Dict, Any, Optional, List
import requests

from .bank_statement_parser import parse_bank_statement_content
from .cdr_telecom_parser import parse_cdr_content
from .ip_forensics_parser import parse_ip_logs_content
from .certificate_generator import generate_section_63_bsa_certificate

logger = logging.getLogger(__name__)

class AnalyticsAgent:
    """
    Law Enforcement Forensic Response Analytics Agent.
    Ingests and parses real provider response files (Bank statements, CDR dumps, Cyber IP logs).
    Executes deterministic parsing and LLM forensic synthesis (Groq / Gemini) grounded strictly
    on the case FIR entities with zero hardcoding.
    """
    def __init__(self, api_key: Optional[str] = None):
        self.gemini_key = (api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip("'\" \t\r\n")
        self.groq_key = (os.environ.get("GROQ_API_KEY") or "").strip("'\" \t\r\n")

    def analyze_response(
        self,
        provider_name: str,
        response_type: str,
        file_path_or_content: str,
        case_number: str = "CR-2026-9910",
        case_entities: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Parses provider response file using specialized deterministic forensic engines,
        and enriches with grounded LLM analysis for Investigating Officers.
        """
        r_type = (response_type or "BANK_STATEMENT").upper()
        if "BANK" in r_type or "STATEMENT" in r_type or "CREDIT" in r_type or "DEBIT" in r_type:
            parsed_data = parse_bank_statement_content(file_path_or_content, case_number, case_entities)
        elif "CDR" in r_type or "CALL" in r_type or "TELECOM" in r_type:
            parsed_data = parse_cdr_content(file_path_or_content, case_number, case_entities)
        elif "IP" in r_type or "LOG" in r_type or "CYBER" in r_type:
            parsed_data = parse_ip_logs_content(file_path_or_content, case_number, case_entities)
        else:
            # Default to bank parser
            parsed_data = parse_bank_statement_content(file_path_or_content, case_number, case_entities)

        parsed_data["provider_name"] = provider_name

        # LLM Synthesis Node: Enrich summary using real Groq/Gemini if API keys are active
        llm_enrichment = self._synthesize_with_llm(parsed_data, case_number, case_entities)
        if llm_enrichment:
            if llm_enrichment.get("executive_summary"):
                parsed_data["executive_summary"] = llm_enrichment["executive_summary"]
            if llm_enrichment.get("recommended_next_action"):
                parsed_data["recommended_next_action"] = llm_enrichment["recommended_next_action"]
            if llm_enrichment.get("key_findings"):
                parsed_data["key_findings"] = llm_enrichment["key_findings"]

        return parsed_data

    def _synthesize_with_llm(
        self,
        parsed_data: Dict[str, Any],
        case_number: str,
        case_entities: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Enriches deterministic metrics with LLM reasoning using Groq (Priority 1) or Gemini (Priority 2).
        """
        prompt = f"""You are PSI V.K. Patel, Cyber Forensic Investigating Officer for FIR Case {case_number}.
Review the following deterministic evidence parsing results from the authority response:

EVIDENCE METRICS:
- Response Type: {parsed_data.get('response_type')}
- Total Records: {parsed_data.get('total_records')}
- Detected Pattern: {parsed_data.get('detected_fraud_pattern')}
- Confidence Score: {parsed_data.get('fraud_confidence_score')}%
- Discovered Secondary Account: {json.dumps(parsed_data.get('discovered_mule_account'))}
- Top Counterparties / Entities: {json.dumps(parsed_data.get('top_counterparties') or parsed_data.get('top_b_parties') or parsed_data.get('top_ip_addresses'))}
- Active Case FIR Entities: {json.dumps(case_entities or {})}

TASK:
1. Provide a concise, highly professional 2-3 sentence executive forensic summary.
2. Provide a single, immediate statutory next action for the police workflow (citing Section 106 BNSS for bank freezes or Section 94 BNSS for subscriber/CDR details).

Return ONLY valid JSON:
{{
  "executive_summary": "<summary>",
  "recommended_next_action": "<statutory action>",
  "key_findings": ["<finding 1>", "<finding 2>"]
}}"""

        # Try Groq API
        if self.groq_key:
            try:
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}
                payload = {
                    "model": os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
                res = requests.post(url, json=payload, headers=headers, timeout=12)
                if res.status_code == 200:
                    return json.loads(res.json()["choices"][0]["message"]["content"])
            except Exception as e:
                logger.warning(f"Groq LLM analytics synthesis failed: {e}")

        # Try Gemini API
        if self.gemini_key:
            try:
                model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.gemini_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.15, "response_mime_type": "application/json"}
                }
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=12)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(text)
            except Exception as e:
                logger.warning(f"Gemini LLM analytics synthesis failed: {e}")

        # Try Local Ollama (Sovereign Offline AI)
        use_ollama = os.environ.get("USE_OLLAMA", "true").lower() in ("true", "1", "yes")
        if use_ollama:
            try:
                ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip('/')
                ollama_model = os.environ.get("OLLAMA_MODEL", "llama3:latest")
                url = f"{ollama_url}/api/chat"
                payload = {
                    "model": ollama_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "format": "json",
                    "stream": False,
                    "options": {"temperature": 0.1}
                }
                res = requests.post(url, json=payload, timeout=20)
                if res.status_code == 200:
                    raw_content = res.json().get("message", {}).get("content", "{}")
                    return json.loads(raw_content)
            except Exception as oe:
                logger.warning(f"Ollama LLM analytics synthesis notice: {oe}")

        return None
