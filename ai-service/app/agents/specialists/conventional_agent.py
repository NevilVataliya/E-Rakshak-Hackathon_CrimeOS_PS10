import json
from app.agents.state import AgentState
from app.rag.query_optimizer import optimize_and_search
from app.utils.json_helper import parse_llm_json
from app.models.schemas import ConventionalDraftSchema
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS

def conventional_agent_node(state: AgentState) -> dict:
    """
    Conventional Crime Field Specialist Agent.
    Uses the Multi-Query RAG Pipeline (query decomposition + HyDE + RRF + reranking)
    to retrieve conventional police procedure SOPs from Qdrant.
    Formulates physical field investigation directives dynamically and unbiasedly.
    """
    crime_category = state.get('crime_category') or 'CONVENTIONAL'
    crime_sub = state.get('crime_sub_type') or 'Physical Crime'
    complaint_text = state.get('translated_text') or state.get('complaint_text') or ''
    feedback = state.get('evaluation_feedback') or []
    entities = state.get('entities') or {}

    # Use the new end-to-end optimized RAG pipeline
    qdrant_docs = optimize_and_search(
        complaint_text=complaint_text,
        crime_sub_type=crime_sub,
        crime_category=crime_category,
        entities=entities,
        target_specialist="conventional_field_specialist",
        top_k=4,
        enable_reranker=True
    )

    formatted_chunks = []
    for d in qdrant_docs:
        formatted_chunks.append(f"[SOURCE: {d['source']} | PAGE: {d['page']}]:\n{d['text']}")

    rag_context = "\n\n---\n\n".join(formatted_chunks) if formatted_chunks else "No specific SOP text chunks retrieved. Base field action directives on standard BNSS procedural provisions."

    llm = get_agent_llm("auto", temperature=0.1)

    prompt = f"""
You are the Conventional Field Crime Specialist Agent for Indian Law Enforcement.
Ground your recommendations on the RETRIEVED QDRANT POLICE PROCEDURE CHUNKS provided below.

CRIME CATEGORY: {crime_category}
SUB-TYPE: {crime_sub}
COMPLAINT NARRATIVE: {complaint_text[:1000]}
EXTRACTED ENTITIES: {json.dumps(entities)}
EVALUATOR FEEDBACK: {feedback if feedback else "None"}

=== RETRIEVED QDRANT CHUNKS ===
{rag_context}
================================

Task:
Provide step-by-step physical investigation instructions for investigating officers on the ground.

INSTRUCTIONS:
1. Formulate actionable field directives (crime scene preservation, victim/witness interviews u/s 191 BNSS, panchnama u/s 105 BNSS, evidence collection).
2. Ground field actions directly on the actual COMPLAINT NARRATIVE and EXTRACTED ENTITIES.
3. For 'sop_reference', cite the relevant procedural code authority (e.g. 'BNSS Section 105', 'BNSS Section 180', 'BNSS Section 191', or exact retrieved document title ONLY if directly applicable to {crime_sub}). Do not cite specialized SOP documents belonging to unrelated crime domains.

Respond ONLY in valid JSON matching this exact structure:
{{
  "field_steps": [
    {{
      "title": "<FIELD_ACTION_TITLE>",
      "description": "<DETAILED_FIELD_INVESTIGATION_DIRECTIVE_REFERENCING_ACTUAL_LOCATIONS_AND_EVIDENCE>",
      "category": "FIELD",
      "sop_reference": "<CITED_PROCEDURAL_AUTHORITY_OR_DOCUMENT_NAME>"
    }}
  ]
}}
"""
    try:
        resp = llm.invoke(prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)
        data = parse_llm_json(text, schema_model=ConventionalDraftSchema)
        return {"conventional_draft": data}
    except Exception as e:
        print(f"[-] Conventional Agent Node Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return {"conventional_draft": ConventionalDraftSchema().model_dump()}
