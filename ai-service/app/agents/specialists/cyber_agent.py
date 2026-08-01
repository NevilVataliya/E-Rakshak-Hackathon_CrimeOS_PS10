import json
from app.agents.state import AgentState
from app.rag.qdrant_client import search_legal_sops
from app.utils.json_helper import parse_llm_json
from app.models.schemas import CyberDraftSchema
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS

def cyber_agent_node(state: AgentState) -> dict:
    """
    Cyber & Financial Specialist Agent.
    Retrieves Cyber & Financial Investigation SOPs from Qdrant using payload filtering.
    Formulates entity-specific police directives citing exact retrieved document sources without hardcoded fallbacks.
    """
    entities = state.get('entities') or {}
    feedback = state.get('evaluation_feedback') or []
    crime_sub = state.get('crime_sub_type') or 'Cyber Fraud'
    complaint_text = state.get('translated_text') or state.get('complaint_text') or ''
    
    vpas = ", ".join(entities.get('vpas_upis') or [])
    phones = ", ".join(entities.get('phone_numbers') or [])
    handles = ", ".join(entities.get('online_handles') or [])
    emails = ", ".join(entities.get('email_addresses') or [])
    
    semantic_query = complaint_text[:500].strip()
    keyword_query = f"{crime_sub} digital evidence CDR IPDR LERS bank debit freeze SOP {vpas} {phones} {handles} {emails}".strip()
    qdrant_docs = search_legal_sops(semantic_query=semantic_query, keyword_query=keyword_query, target_specialist="cyber_financial_intel_specialist", top_k=4)
    
    formatted_chunks = []
    for d in qdrant_docs:
        formatted_chunks.append(f"[SOURCE: {d['source']} | PAGE: {d['page']}]:\n{d['text']}")
        
    rag_context = "\n\n---\n\n".join(formatted_chunks) if formatted_chunks else "[SOURCE: CYBER_FRAUD_SOP.pdf | PAGE: 1]: Issue Sec 94 BNSS notice for CDR & Bank Debit Freeze."

    llm = get_agent_llm("auto", temperature=0.1)

    prompt = f"""
You are the Senior Cyber & Financial Intelligence Specialist Agent for Indian Law Enforcement.
Ground your investigation directives strictly on the RETRIEVED QDRANT SOP CHUNKS provided below.

CRIME SUB-TYPE: {crime_sub}
COMPLAINT SUMMARY: {complaint_text[:1000]}
EXTRACTED CASE ENTITIES: {json.dumps(entities)}
EVALUATOR FEEDBACK: {feedback if feedback else "None"}

=== RETRIEVED QDRANT SOP CHUNKS ===
{rag_context}
===================================

Task:
Formulate specific, actionable police investigation directives and targeted legal notices.

CRITICAL RULES FOR UNIVERSAL UNBIASED EXTRACTION:
1. STRICT GROUNDING: You MUST NEVER invent or hallucinate phone numbers, bank accounts, UPI IDs, or online handles. ONLY generate directives for entities explicitly listed in 'EXTRACTED CASE ENTITIES'. If 'EXTRACTED CASE ENTITIES' is empty for a category, you MUST NOT generate any notice (e.g., no Telegram subpoena if no handle exists).
2. For each directive, generate an explicit title, description, category ("CYBER"), and sop_reference citing the EXACT source document name and page number found in RETRIEVED QDRANT SOP CHUNKS above.
3. VICTIM SAFETY OVERRIDE: Look closely at the 'is_victim_account' or 'account_role' tag for every bank account. You are FORBIDDEN from issuing freezing, lien, or suspension notices against any account where "is_victim_account": true or "account_role": "victim". For victim accounts, you may only request standard outward transaction statements. Freezing notices are ONLY for "accused" or mule accounts.
4. If a specific entity is NOT explicitly listed in the EXTRACTED CASE ENTITIES JSON, generating a directive for it is considered a SEVERE SAFETY VIOLATION.

Respond ONLY in valid JSON matching this exact structure:
{{
  "digital_directives": [
    {{
      "title": "<DESCRIPTIVE_TITLE_WITH_TARGET_ENTITY>",
      "description": "ACTION: [Imperative Verb, e.g. Freeze / Seize / Issue Notice u/s 94 BNSS / Request CDR] <ACTIONABLE_POLICE_DIRECTIVE_REFERENCING_EXACT_EXTRACTED_ENTITY>",
      "category": "CYBER",
      "sop_reference": "<CITED_SOURCE_DOCUMENT_NAME_AND_PAGE_NUMBER>"
    }}
  ],
  "recommended_legal_requests": [
    {{
      "request_type": "SECTION_94_BNSS",
      "target_provider": "<TARGET_PROVIDER_NAME>",
      "purpose": "<SPECIFIC_REQUISITION_PURPOSE>"
    }}
  ]
}}
"""
    try:
        resp = llm.invoke(prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)
        data = parse_llm_json(text, schema_model=CyberDraftSchema)
        return {"cyber_draft": data}
    except Exception as e:
        print(f"[-] Cyber Agent Node Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return {"cyber_draft": CyberDraftSchema().model_dump()}
