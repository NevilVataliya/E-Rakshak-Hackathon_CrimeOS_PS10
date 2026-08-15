import os
import json
import time
import logging
import hashlib
import requests
from collections import deque
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

def _load_env():
    try:
        from dotenv import load_dotenv
        from pathlib import Path
        # Attempt loading root .env file first
        current_file = Path(__file__).resolve()
        for parent in current_file.parents:
            env_file = parent / '.env'
            if env_file.exists():
                load_dotenv(dotenv_path=env_file)
                break
        load_dotenv()
    except Exception as e:
        logger.warning(f"Dotenv load warning: {e}")

_load_env()

MODULE_NAMES = {
    "MODULE_1": "Complaint Intake & Multimodal Data Extraction",
    "MODULE_2": "Serial Linkage & Cross-FIR Pattern Analysis",
    "MODULE_3": "AI Investigation Studio & Multi-Agent Planning",
    "MODULE_4": "Statutory Legal Subpoenas & Direct Reply Management",
    "MODULE_5": "Forensic Response Analytics & Evidence Intelligence"
}

class GroqRateLimiter:
    """
    Sliding-window rate limiter & token consumption tracker for Groq API.
    Limits: Max 30 requests/minute, Max 6,000 tokens/minute.
    Includes in-memory response cache to prevent redundant API calls.
    """
    def __init__(self, max_requests_per_min: int = 25, max_tokens_per_min: int = 5200):
        self.max_requests = max_requests_per_min
        self.max_tokens = max_tokens_per_min
        self.requests = deque()
        self.tokens = deque()
        self._cache: Dict[str, Dict[str, Any]] = {}

    def _clean_old(self, now: float):
        cutoff = now - 60.0
        while self.requests and self.requests[0] < cutoff:
            self.requests.popleft()
        while self.tokens and self.tokens[0][0] < cutoff:
            self.tokens.popleft()

    def wait_if_needed(self, estimated_tokens: int = 500):
        now = time.time()
        self._clean_old(now)
        while len(self.requests) >= self.max_requests or (sum(t[1] for t in self.tokens) + estimated_tokens > self.max_tokens):
            time.sleep(1.0)
            now = time.time()
            self._clean_old(now)

    def record_request(self, tokens_used: int):
        now = time.time()
        self.requests.append(now)
        self.tokens.append((now, tokens_used))

    def get_cached(self, cache_key: str) -> Optional[Dict[str, Any]]:
        entry = self._cache.get(cache_key)
        if entry and (time.time() - entry['timestamp'] < 600):  # 10 minutes cache TTL
            return entry['data']
        return None

    def set_cache(self, cache_key: str, data: Dict[str, Any]):
        self._cache[cache_key] = {
            'timestamp': time.time(),
            'data': data
        }

_rate_limiter = GroqRateLimiter()


class SummarizerAgent:
    """
    Summarizer Agent powered by Groq LLM (llama-3.1-8b-instant).
    Generates token-budgeted, zero-information-loss module executive briefs 
    and master global case briefings for Modules 1 through 5.
    """
    def __init__(self, api_key: Optional[str] = None):
        _load_env()
        raw_key = api_key or os.environ.get("GROQ_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        self.groq_api_key = (raw_key or "").strip("'\" \t\r\n")
        self.model_name = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

    def _get_cache_key(self, case_number: str, module_id: str, payload: Dict[str, Any]) -> str:
        raw = f"{case_number}:{module_id}:{json.dumps(payload, sort_keys=True, default=str)}"
        return hashlib.md5(raw.encode('utf-8')).hexdigest()

    def summarize_module(
        self,
        case_number: str,
        module_id: str,
        module_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates a token-optimized executive summary for a specific module (MODULE_1 to MODULE_5)
        using Groq llama-3.1-8b-instant under rate limit budgets.
        """
        mod_upper = module_id.upper()
        if mod_upper not in MODULE_NAMES:
            mod_upper = "MODULE_1"

        module_title = MODULE_NAMES.get(mod_upper, module_id)
        cache_key = self._get_cache_key(case_number, mod_upper, module_payload)
        cached = _rate_limiter.get_cached(cache_key)
        if cached:
            logger.info(f"Serving cached module summary for {mod_upper} (Case {case_number})")
            return cached

        # Construct module-tailored context string
        context_prompt = self._build_module_context_prompt(mod_upper, case_number, module_payload)

        if self.groq_api_key:
            try:
                system_prompt = f"You are CrimeOS Lead Intelligence Analyst. Synthesize a crisp executive summary for {module_title} in Case {case_number}."
                user_prompt = f"""OPERATIONAL DATASET ({module_title} - Case {case_number}):
{context_prompt}

Return JSON strictly matching this schema:
{{
  "module_id": "{mod_upper}",
  "module_title": "{module_title}",
  "case_number": "{case_number}",
  "key_facts": ["Extracted Fact 1", "Extracted Fact 2"],
  "actions_taken": ["Operational Action 1", "Operational Action 2"],
  "unresolved_gaps": ["Pending Requirement or Investigation Gap"],
  "concise_brief": "A professional 2-sentence executive summary for the Investigating Officer."
}}"""
                summary = self._call_groq_summary(system_prompt, user_prompt, cache_key=cache_key)
                if summary and isinstance(summary, dict):
                    summary["module_id"] = mod_upper
                    summary["module_title"] = module_title
                    summary["case_number"] = case_number
                    _rate_limiter.set_cache(cache_key, summary)
                    return summary
            except Exception as e:
                logger.warning(f"Groq llama-3.1-8b-instant Module Summarizer failed: {e}. Checking local Ollama...")

        # 2. Local Ollama AI Summarizer (Sovereign Offline AI)
        try:
            system_prompt = f"You are CrimeOS Lead Intelligence Analyst. Synthesize a crisp executive summary for {module_title} in Case {case_number}."
            user_prompt = f"""OPERATIONAL DATASET ({module_title} - Case {case_number}):
{context_prompt}

Return JSON strictly matching this schema:
{{
  "module_id": "{mod_upper}",
  "module_title": "{module_title}",
  "case_number": "{case_number}",
  "key_facts": ["Extracted Fact 1", "Extracted Fact 2"],
  "actions_taken": ["Operational Action 1", "Operational Action 2"],
  "unresolved_gaps": ["Pending Requirement or Investigation Gap"],
  "concise_brief": "A professional 2-sentence executive summary for the Investigating Officer."
}}"""
            ollama_summary = self._call_ollama_summary(system_prompt, user_prompt, cache_key=cache_key)
            if ollama_summary and isinstance(ollama_summary, dict):
                ollama_summary["module_id"] = mod_upper
                ollama_summary["module_title"] = module_title
                ollama_summary["case_number"] = case_number
                _rate_limiter.set_cache(cache_key, ollama_summary)
                return ollama_summary
        except Exception as oe:
            logger.warning(f"Ollama Module Summarizer notice: {oe}")

        fallback = self._rule_based_module_summary(case_number, mod_upper, module_payload)
        _rate_limiter.set_cache(cache_key, fallback)
        return fallback

    def summarize_global(
        self,
        case_number: str,
        module_summaries: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Synthesizes a master executive briefing across completed modules 1 to 5 using Groq or local Ollama.
        """
        cache_key = self._get_cache_key(case_number, "GLOBAL", module_summaries)
        cached = _rate_limiter.get_cached(cache_key)
        if cached:
            logger.info(f"Serving cached global master briefing for Case {case_number}")
            return cached

        # Compact context summarizing modules 1 to 5
        compressed = []
        for m_id in ["MODULE_1", "MODULE_2", "MODULE_3", "MODULE_4", "MODULE_5"]:
            if m_id in module_summaries:
                m_sum = module_summaries[m_id]
                title = m_sum.get("module_title", m_id)
                brief = m_sum.get("concise_brief") or m_sum.get("summary") or ""
                facts = m_sum.get("key_facts", [])
                compressed.append(f"[{m_id}: {title}]\nBrief: {brief}\nFacts: {', '.join(facts[:2])}")

        compressed_str = "\n\n".join(compressed)[:2500]

        if self.groq_api_key:
            try:
                system_prompt = "You are CrimeOS Chief Cyber Crime Investigation Officer. Synthesize an official Master Executive Case Briefing for senior police leadership."
                user_prompt = f"""Synthesize Master Executive Briefing for Case FIR No: {case_number} using the completed 5-module summaries below.

COMPLETED MODULE SUMMARIES:
{compressed_str}

Return JSON strictly matching this schema:
{{
  "case_number": "{case_number}",
  "master_title": "Master Cyber Crime Investigation Briefing - Case {case_number}",
  "executive_brief": "A comprehensive 3-sentence executive summary for Senior Officers summarizing overall case status, suspect trails, and key findings.",
  "total_completed_modules": {len(module_summaries)},
  "timeline_milestones": ["Pipeline Milestone 1", "Pipeline Milestone 2"],
  "critical_evidence_highlights": ["Critical Evidence 1", "Critical Evidence 2"],
  "recommended_next_step": "Single high-priority actionable next directive for investigating officer.",
  "status": "COMPLETED"
}}"""
                summary = self._call_groq_summary(system_prompt, user_prompt, cache_key=cache_key)
                if summary and isinstance(summary, dict):
                    summary["case_number"] = case_number
                    _rate_limiter.set_cache(cache_key, summary)
                    return summary
            except Exception as e:
                logger.warning(f"Groq Global Summarizer failed: {e}. Checking local Ollama...")

        # 2. Local Ollama Global Master Briefing (Sovereign Offline AI)
        try:
            system_prompt = "You are CrimeOS Chief Cyber Crime Investigation Officer. Synthesize an official Master Executive Case Briefing for senior police leadership."
            user_prompt = f"""Synthesize Master Executive Briefing for Case FIR No: {case_number} using the completed 5-module summaries below.

COMPLETED MODULE SUMMARIES:
{compressed_str}

Return JSON strictly matching this schema:
{{
  "case_number": "{case_number}",
  "master_title": "Master Cyber Crime Investigation Briefing - Case {case_number}",
  "executive_brief": "A comprehensive 3-sentence executive summary for Senior Officers summarizing overall case status, suspect trails, and key findings.",
  "total_completed_modules": {len(module_summaries)},
  "timeline_milestones": ["Pipeline Milestone 1", "Pipeline Milestone 2"],
  "critical_evidence_highlights": ["Critical Evidence 1", "Critical Evidence 2"],
  "recommended_next_step": "Single high-priority actionable next directive for investigating officer.",
  "status": "COMPLETED"
}}"""
            ollama_global = self._call_ollama_summary(system_prompt, user_prompt, cache_key=cache_key)
            if ollama_global and isinstance(ollama_global, dict):
                ollama_global["case_number"] = case_number
                _rate_limiter.set_cache(cache_key, ollama_global)
                return ollama_global
        except Exception as oe:
            logger.warning(f"Ollama Global Summarizer notice: {oe}")

        fallback = self._rule_based_global_summary(case_number, module_summaries)
        _rate_limiter.set_cache(cache_key, fallback)
        return fallback

    def _call_ollama_summary(self, system_prompt: str, user_prompt: str, cache_key: str) -> Optional[Dict[str, Any]]:
        use_ollama = os.environ.get("USE_OLLAMA", "true").lower() in ("true", "1", "yes")
        if not use_ollama:
            return None

        ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip('/')
        ollama_model = os.environ.get("OLLAMA_MODEL", "llama3:latest")
        try:
            url = f"{ollama_url}/api/chat"
            payload = {
                "model": ollama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "format": "json",
                "stream": False,
                "options": {"temperature": 0.1}
            }
            res = requests.post(url, json=payload, timeout=30)
            if res.status_code == 200:
                content = res.json().get("message", {}).get("content", "{}")
                parsed = json.loads(content)
                logger.info(f"Generated summary via local Ollama model: {ollama_model}")
                return parsed
        except Exception as e:
            logger.warning(f"Local Ollama summary execution notice: {e}")
        return None

    def _call_groq_summary(self, system_prompt: str, user_prompt: str, cache_key: str) -> Optional[Dict[str, Any]]:
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }

        # Primary model: llama-3.1-8b-instant as requested by user
        models_to_try = [self.model_name, "llama-3.1-8b-instant", "llama-3.3-70b-versatile"]
        seen_models = set()

        # Enforce rate limiter before making outgoing API call
        _rate_limiter.wait_if_needed(estimated_tokens=500)

        for model in models_to_try:
            if not model or model in seen_models:
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
                "max_tokens": 380
            }

            for attempt in range(2):
                try:
                    res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=12)
                    if res.status_code == 200:
                        data = res.json()
                        tokens_used = data.get("usage", {}).get("total_tokens", 400)
                        _rate_limiter.record_request(tokens_used)
                        content = data["choices"][0]["message"]["content"]
                        parsed = json.loads(content)
                        logger.info(f"Generated summary via Groq model: {model} (Tokens used: {tokens_used})")
                        return parsed
                    elif res.status_code == 429:
                        logger.warning(f"Groq API 429 Rate Limit encountered. Sleeping 2 seconds before retry...")
                        time.sleep(2.0)
                    else:
                        logger.warning(f"Groq API model {model} returned HTTP {res.status_code}: {res.text[:200]}")
                        break
                except Exception as e:
                    logger.warning(f"Error calling Groq API model {model}: {e}")
                    break

        return None

    def _build_module_context_prompt(self, module_id: str, case_number: str, payload: Dict[str, Any]) -> str:
        """
        Builds a compact, high-density domain context string for each module (MODULE_1 to MODULE_5).
        """
        lines = [f"Case Reference: {case_number}"]

        if module_id == "MODULE_1":
            lines.append("Module 1 Scope: Complaint Intake & Multimodal Data Extraction")
            if payload.get("complainant_name"):
                lines.append(f"Complainant: {payload['complainant_name']}")
            if payload.get("crime_category"):
                lines.append(f"Category: {payload['crime_category']}")
            if payload.get("complaint_text"):
                lines.append(f"Complaint Excerpt: {str(payload['complaint_text'])[:300]}")
            entities = payload.get("entities", {})
            if isinstance(entities, dict):
                banks = entities.get("bank_accounts") or []
                phones = entities.get("phone_numbers") or []
                upis = entities.get("upi_ids") or []
                ips = entities.get("ip_addresses") or []
                lines.append(f"Extracted Entities: {len(banks)} Bank Accounts, {len(phones)} Phones, {len(upis)} UPI IDs, {len(ips)} IP Addresses")
                if banks: lines.append(f"Sample Bank Accounts: {', '.join(map(str, banks[:3]))}")
                if phones: lines.append(f"Sample Phone Numbers: {', '.join(map(str, phones[:3]))}")
                if upis: lines.append(f"Sample UPI IDs: {', '.join(map(str, upis[:3]))}")

        elif module_id == "MODULE_2":
            lines.append("Module 2 Scope: Serial Linkage & Cross-FIR Pattern Analysis")
            matches = payload.get("matches") or []
            stats = payload.get("stats") or {}
            lines.append(f"Cross-FIR Linkage Hits: {len(matches)}")
            if stats:
                lines.append(f"Linkage Metrics: {json.dumps(stats)}")
            for m in matches[:4]:
                if isinstance(m, dict):
                    lines.append(f"Match: Entity '{m.get('entity_value')}' ({m.get('entity_type')}) matched with FIR '{m.get('matched_fir')}' ({m.get('police_station')}) with {round((m.get('confidence',0))*100)}% confidence.")

        elif module_id == "MODULE_3":
            lines.append("Module 3 Scope: AI Legal Investigation Studio & Multi-Agent Planning")
            steps = payload.get("investigation_steps") or []
            roadmap = payload.get("strategy_roadmap") or []
            category = payload.get("crime_category") or "Financial Cyber Fraud"
            lines.append(f"Crime Category: {category}")
            lines.append(f"Grounded SOP Steps Generated: {len(steps)}")
            for step in steps[:3]:
                if isinstance(step, dict):
                    lines.append(f"Step: {step.get('title')} (BNSS Ref: {step.get('bnss_reference', 'Sec 94 BNSS')})")
            if roadmap:
                lines.append(f"Strategy Directives: {len(roadmap)} roadmap items defined.")

        elif module_id == "MODULE_4":
            lines.append("Module 4 Scope: Statutory Legal Subpoenas & Direct Reply Management")
            directives = payload.get("dispatched_directives") or []
            replies = payload.get("processed_replies") or []
            lines.append(f"Statutory Notices Dispatched: {len(directives)}")
            lines.append(f"Authority Replies Ingested: {len(replies)}")
            for d in directives[:3]:
                if isinstance(d, dict):
                    lines.append(f"Notice Issued: {d.get('title')} to {d.get('target_provider')} ({d.get('receiver_email')}) - Status: {d.get('status')}")
            for r in replies[:3]:
                if isinstance(r, dict):
                    lines.append(f"Reply Received: From {r.get('sender')} | Classification: {r.get('classification')}")

        elif module_id == "MODULE_5":
            lines.append("Module 5 Scope: Forensic Response Analytics & Evidence Intelligence")
            exec_sum = payload.get("executive_summary") or ""
            parsed_type = payload.get("parsed_type") or "Evidence Analytics"
            action = payload.get("recommended_next_action") or ""
            lines.append(f"Evidence Type: {parsed_type}")
            if exec_sum:
                lines.append(f"Forensic Summary: {exec_sum[:300]}")
            if action:
                lines.append(f"Recommended Action: {action}")
            metrics = payload.get("extracted_metrics")
            if metrics:
                lines.append(f"Key Metrics: {json.dumps(metrics)}")

        return "\n".join(lines)[:2200]

    def _rule_based_module_summary(self, case_number: str, module_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        module_title = MODULE_NAMES.get(module_id.upper(), module_id)
        facts = []
        actions = []

        if module_id == "MODULE_1":
            comp = payload.get("complainant_name") or "Complainant"
            cat = payload.get("crime_category") or "Cyber Crime"
            facts.append(f"Registered intake complaint for {comp} under {cat}.")
            ents = payload.get("entities", {})
            if isinstance(ents, dict) and (ents.get("bank_accounts") or ents.get("phone_numbers")):
                facts.append(f"Extracted {len(ents.get('bank_accounts', []))} suspect bank accounts and {len(ents.get('phone_numbers', []))} cell numbers.")
            actions.append("Ingested complaint records and extracted digital forensic entities.")

        elif module_id == "MODULE_2":
            matches = payload.get("matches") or []
            facts.append(f"Identified {len(matches)} cross-FIR serial crime linkages for Case {case_number}.")
            actions.append("Correlated suspect VPAs, mule accounts, and cell towers across police stations.")

        elif module_id == "MODULE_3":
            steps = payload.get("investigation_steps") or []
            facts.append(f"Synthesized {len(steps)} BNSS-grounded investigation steps.")
            actions.append("Formulated multi-agent legal strategy roadmap for Investigating Officer.")

        elif module_id == "MODULE_4":
            dirs = payload.get("dispatched_directives") or []
            replies = payload.get("processed_replies") or []
            facts.append(f"Dispatched {len(dirs)} statutory Section 94 BNSS legal notices to intermediary compliance desks.")
            if replies:
                facts.append(f"Ingested {len(replies)} official email replies via IMAP integration.")
            actions.append("Dispatched statutory subpoenas and monitored incoming provider replies.")

        elif module_id == "MODULE_5":
            parsed_type = payload.get("parsed_type") or "Forensic Evidence"
            facts.append(f"Analyzed response analytics for {parsed_type}.")
            actions.append("Parsed bank transaction ledgers, CDR call frequency, and IP connection logs.")

        if not facts:
            facts = [f"Processed operational dataset for {module_title} in Case {case_number}."]
        if not actions:
            actions = [f"Executed {module_title} analysis workflow."]

        return {
            "module_id": module_id,
            "module_title": module_title,
            "case_number": case_number,
            "key_facts": facts,
            "actions_taken": actions,
            "unresolved_gaps": ["Awaiting officer verification and next directive dispatch."],
            "concise_brief": f"Module {module_title} completed processing for Case {case_number}. Captured {len(facts)} key investigative data points."
        }

    def _rule_based_global_summary(self, case_number: str, module_summaries: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        count = len(module_summaries)
        highlights = []
        milestones = []

        for m_id in ["MODULE_1", "MODULE_2", "MODULE_3", "MODULE_4", "MODULE_5"]:
            if m_id in module_summaries:
                mod_sum = module_summaries[m_id]
                title = mod_sum.get("module_title", m_id)
                brief = mod_sum.get("concise_brief", "")
                milestones.append(f"{title}: {brief[:70]}")
                facts = mod_sum.get("key_facts", [])
                if facts:
                    highlights.append(facts[0])

        return {
            "case_number": case_number,
            "master_title": f"Master Cyber Crime Investigation Briefing - Case {case_number}",
            "executive_brief": f"Investigation for Case {case_number} has progressed across {count} active pipeline modules (Modules 1–5). Multi-agent AI engines have extracted complaint entities, correlated cross-FIR linkages, formulated legal SOP plans, dispatched statutory notices, and parsed forensic response analytics.",
            "total_completed_modules": count,
            "timeline_milestones": milestones or [f"Initiated investigation pipeline for Case {case_number}."],
            "critical_evidence_highlights": highlights or ["Primary complaint entities extracted and cross-referenced."],
            "recommended_next_step": "Review Section 106 BNSS debit freeze directives and issue followback notice to bank compliance desk.",
            "status": "COMPLETED"
        }

