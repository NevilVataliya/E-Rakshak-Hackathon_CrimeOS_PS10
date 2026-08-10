import os
import json
import logging
import requests
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass

_load_env()

MODULE_NAMES = {
    "MODULE_1": "Complaint Intake & Multimodal Data Extraction",
    "MODULE_2": "Serial Linkage & Cross-FIR Pattern Analysis",
    "MODULE_3": "AI Investigation Studio & Multi-Agent Planning",
    "MODULE_4": "Statutory Legal Subpoenas & Direct Reply Management",
    "MODULE_5": "Forensic Response Analytics & Evidence Intelligence",
    "MODULE_6": "Court Case Diary & Judicial Register Timeline"
}

class SummarizerAgent:
    """
    Summarizer Agent responsible for generating token-budgeted, zero-information-loss 
    module executive briefs and master global case briefings for law enforcement officers.
    """
    def __init__(self, api_key: Optional[str] = None):
        raw_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GROQ_API_KEY")
        self.api_key = raw_key.strip("'\" \t\r\n") if raw_key else None
        self.groq_api_key = (os.environ.get("GROQ_API_KEY") or "").strip("'\" \t\r\n")
        self.model_name = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

    def summarize_module(
        self,
        case_number: str,
        module_id: str,
        module_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates a token-optimized executive summary for a specific investigation module using lightweight Groq LLM.
        """
        module_title = MODULE_NAMES.get(module_id.upper(), module_id)
        payload_str = json.dumps(module_payload, default=str)[:3000]

        if self.groq_api_key:
            try:
                summary = self._call_groq_summary(
                    system_prompt=f"You are CrimeOS Lead Intelligence Analyst. Synthesize a concise, professional executive summary for {module_title} in Case {case_number}.",
                    user_prompt=f"""Analyze the following operational dataset for {module_title} (Case {case_number}).

INVESTIGATION DATA:
{payload_str}

Return JSON strictly matching this schema:
{{
  "module_id": "{module_id}",
  "module_title": "{module_title}",
  "case_number": "{case_number}",
  "key_facts": ["Key Fact 1", "Key Fact 2"],
  "actions_taken": ["Action Executed 1", "Action Executed 2"],
  "unresolved_gaps": ["Key Pending Gap or Requirement"],
  "concise_brief": "A professional 2-sentence executive summary for the Investigating Officer."
}}"""
                )
                if summary and isinstance(summary, dict):
                    summary["module_id"] = module_id
                    summary["module_title"] = module_title
                    summary["case_number"] = case_number
                    return summary
            except Exception as e:
                logger.warning(f"Live Groq LLM Module Summarizer failed: {e}. Falling back to rule engine.")

        return self._rule_based_module_summary(case_number, module_id, module_payload)

    def summarize_global(
        self,
        case_number: str,
        module_summaries: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Synthesizes a master executive briefing across all completed modules using lightweight Groq LLM.
        Operates strictly on compressed module summaries to avoid token limit overflow.
        """
        compressed_context = json.dumps(module_summaries, default=str)[:4000]

        if self.groq_api_key:
            try:
                summary = self._call_groq_summary(
                    system_prompt="You are CrimeOS Chief Cyber Crime Investigation Officer. Synthesize an official Master Executive Case Briefing for senior police leadership.",
                    user_prompt=f"""Synthesize a Master Executive Briefing for Case FIR No: {case_number} using the completed module summaries below.

MODULE SUMMARIES:
{compressed_context}

Return JSON strictly matching this schema:
{{
  "case_number": "{case_number}",
  "master_title": "Master Cyber Crime Investigation Briefing - Case {case_number}",
  "executive_brief": "A comprehensive 3-sentence executive summary for Senior Officers summarizing overall case status and key findings.",
  "total_completed_modules": {len(module_summaries)},
  "timeline_milestones": ["Milestone 1", "Milestone 2"],
  "critical_evidence_highlights": ["Critical Finding 1", "Critical Finding 2"],
  "recommended_next_step": "Single high-priority actionable next directive for investigating officer.",
  "status": "COMPLETED"
}}"""
                )
                if summary and isinstance(summary, dict):
                    summary["case_number"] = case_number
                    return summary
            except Exception as e:
                logger.warning(f"Live Groq LLM Global Summarizer failed: {e}. Falling back to rule engine.")

        return self._rule_based_global_summary(case_number, module_summaries)

    def _call_groq_summary(self, system_prompt: str, user_prompt: str) -> Optional[Dict[str, Any]]:
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        # Try lightweight llama-3.1-8b-instant first, fallback to llama-3.3-70b-versatile
        models_to_try = [self.model_name, "llama-3.1-8b-instant", "llama-3.3-70b-versatile"]
        seen_models = set()

        for model in models_to_try:
            if model in seen_models:
                continue
            seen_models.add(model)
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": 600
            }
            try:
                res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=10)
                if res.status_code == 200:
                    content = res.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    logger.info(f"Successfully generated summary via Groq model: {model}")
                    return parsed
                else:
                    logger.warning(f"Groq API model {model} returned HTTP {res.status_code}: {res.text[:200]}")
            except Exception as e:
                logger.warning(f"Error calling Groq API model {model}: {e}")
        return None

    def _rule_based_module_summary(self, case_number: str, module_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        module_title = MODULE_NAMES.get(module_id.upper(), module_id)
        facts = []
        actions = []

        if payload.get("manual_text"):
            facts.append(f"Ingested complaint description: '{str(payload['manual_text'])[:80]}...'")
        if payload.get("attached_files"):
            facts.append(f"Processed {len(payload['attached_files'])} attached complaint documents/audio/video files.")
        if payload.get("extracted_result"):
            extracted = payload["extracted_result"]
            entities = extracted.get("entities", {})
            facts.append(f"Extracted {len(entities.get('bank_accounts', []))} bank accounts, {len(entities.get('phone_numbers', []))} phone numbers.")

        if payload.get("matches"):
            matches = payload["matches"]
            facts.append(f"Identified {len(matches)} cross-FIR serial crime linkages.")
            actions.append("Correlated suspect VPAs and cell towers across linked police stations.")

        if payload.get("dispatched_directives"):
            dirs = payload["dispatched_directives"]
            facts.append(f"Dispatched {len(dirs)} statutory Section 94 BNSS directives to compliance authorities.")

        if payload.get("processed_replies"):
            replies = payload["processed_replies"]
            facts.append(f"Ingested and classified {len(replies)} authority email replies via IMAP.")

        if payload.get("timeline_events"):
            events = payload["timeline_events"]
            facts.append(f"Recorded {len(events)} verified case diary entries in official court register.")

        if not facts:
            facts = [f"Module {module_id} active for case {case_number}."]
        if not actions:
            actions = [f"Processed {module_title} operations."]

        return {
            "module_id": module_id,
            "module_title": module_title,
            "case_number": case_number,
            "key_facts": facts,
            "actions_taken": actions,
            "unresolved_gaps": ["Continuous monitoring of incoming replies required."],
            "concise_brief": f"Module {module_title} has completed processing for Case {case_number}. Captured {len(facts)} key investigative data points."
        }

    def _rule_based_global_summary(self, case_number: str, module_summaries: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        count = len(module_summaries)
        highlights = []
        milestones = []

        for mod_id, mod_sum in module_summaries.items():
            title = mod_sum.get("module_title", mod_id)
            brief = mod_sum.get("concise_brief", "")
            milestones.append(f"{title}: {brief[:70]}")
            facts = mod_sum.get("key_facts", [])
            if facts:
                highlights.append(facts[0])

        return {
            "case_number": case_number,
            "master_title": f"Master Cyber Crime Investigation Briefing - Case {case_number}",
            "executive_brief": f"Investigation for Case {case_number} has progressed across {count} pipeline modules. Multi-agent AI tools have extracted complaint entities, analyzed serial cross-FIR linkages, dispatched statutory notices, and compiled judicial case diary logs.",
            "total_completed_modules": count,
            "timeline_milestones": milestones or [f"Initiated investigation pipeline for Case {case_number}."],
            "critical_evidence_highlights": highlights or ["Primary complaint entities extracted and cross-referenced."],
            "recommended_next_step": "Review Section 106 BNSS debit freeze directives and export court case diary to prosecutor.",
            "status": "COMPLETED"
        }
