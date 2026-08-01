import json
from app.agents.state import AgentState
from app.rag.qdrant_client import search_legal_sops
from app.utils.json_helper import parse_llm_json
from app.models.schemas import BSADraftSchema
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS

def bsa_agent_node(state: AgentState) -> dict:
    """
    BSA Evidence Specialist Agent.
    Retrieves evidence admissibility rules (Bharatiya Sakshya Adhiniyam, 2023) from Qdrant.
    Formulates universal, unbiased evidence admissibility requirements without fake chunk fallbacks.
    """
    crime_sub_type = state.get('crime_sub_type') or 'General Offence'
    complaint_text = state.get('translated_text') or state.get('complaint_text') or ''
    feedback = state.get('evaluation_feedback') or []
    
    semantic_query = complaint_text[:500].strip()
    keyword_query = f"BSA evidence certificate electronic records section 63 BSA hash calculation panchnama physical evidence chain of custody".strip()
    qdrant_docs = search_legal_sops(semantic_query=semantic_query, keyword_query=keyword_query, target_specialist="bsa_specialist", top_k=4)
    
    formatted_chunks = []
    for d in qdrant_docs:
        formatted_chunks.append(f"[SOURCE: {d['source']} | PAGE: {d['page']}]:\n{d['text']}")
        
    rag_context = "\n\n---\n\n".join(formatted_chunks) if formatted_chunks else "No specific text chunks retrieved. Base requirements strictly on Bharatiya Sakshya Adhiniyam (BSA), 2023 evidence admissibility rules."

    llm = get_agent_llm("auto", temperature=0.1)
    
    prompt = f"""
You are the BSA Evidence Specialist Agent for Indian Law Enforcement.
Ground your requirements on the RETRIEVED QDRANT TEXT CHUNKS provided below (Bharatiya Sakshya Adhiniyam, 2023).

CRIME TYPE: {crime_sub_type}
COMPLAINT NARRATIVE: {complaint_text[:1000]}
EVALUATOR FEEDBACK: {feedback if feedback else "None"}

=== RETRIEVED QDRANT CHUNKS ===
{rag_context}
================================

Task:
Formulate required evidence admissibility collection steps, mandatory Section 63 BSA electronic evidence certificate rules (if digital evidence exists), and physical forensic chain of custody requirements.

Respond ONLY in valid JSON matching this exact structure:
{{
  "bsa_requirements": [
    {{
      "rule": "<BSA_EVIDENCE_RULE_TITLE>",
      "description": "<SPECIFIC_BSA_EVIDENCE_ADMISSIBILITY_REQUIREMENT>",
      "source_document": "<CITED_SOURCE_DOCUMENT>",
      "page_number": "<PAGE_NUMBER>"
    }}
  ],
  "mandatory_checklists": [
    "<EVIDENCE_COLLECTION_CHECKLIST_ITEM_1>",
    "<EVIDENCE_COLLECTION_CHECKLIST_ITEM_2>"
  ]
}}
"""
    try:
        resp = llm.invoke(prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)
        data = parse_llm_json(text, schema_model=BSADraftSchema)
        return {"bsa_draft": data}
    except Exception as e:
        print(f"[-] BSA Agent Node Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return {"bsa_draft": BSADraftSchema().model_dump()}
