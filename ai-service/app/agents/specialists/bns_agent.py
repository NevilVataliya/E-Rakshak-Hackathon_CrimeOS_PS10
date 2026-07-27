import json
from app.agents.state import AgentState
from app.rag.query_optimizer import optimize_and_search
from app.utils.json_helper import parse_llm_json
from app.models.schemas import BNSDraftSchema
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS

def bns_agent_node(state: AgentState) -> dict:
    """
    BNS Substantive Legal Specialist Agent.
    Uses the Multi-Query RAG Pipeline (query decomposition + HyDE + RRF + reranking)
    to retrieve penal code sections (Bharatiya Nyaya Sanhita, 2023 & IT Act, 2000) from Qdrant.
    Grounds legal sections specifically against case facts universally without bias or fake chunk fallbacks.
    """
    crime_sub_type = state.get('crime_sub_type') or 'General Offence'
    crime_cat = state.get('crime_category') or 'CONVENTIONAL'
    complaint_text = state.get('translated_text') or state.get('complaint_text') or ''
    feedback = state.get('evaluation_feedback') or []
    entities = state.get('entities') or {}

    # Use the new end-to-end optimized RAG pipeline
    qdrant_docs = optimize_and_search(
        complaint_text=complaint_text,
        crime_sub_type=crime_sub_type,
        crime_category=crime_cat,
        entities=entities,
        target_specialist="bns_specialist",
        top_k=6,
        enable_reranker=True
    )

    formatted_chunks = []
    for d in qdrant_docs:
        formatted_chunks.append(f"[SOURCE: {d['source']} | PAGE: {d['page']}]:\n{d['text']}")

    rag_context = "\n\n---\n\n".join(formatted_chunks) if formatted_chunks else "No specific text chunks retrieved. Base recommendations strictly on standard statutory provisions of Bharatiya Nyaya Sanhita (BNS), 2023 and IT Act, 2000."

    llm = get_agent_llm("auto", temperature=0.1)

    prompt = f"""
You are the Substantive Legal Specialist Agent for Indian Law Enforcement.
Ground your legal section recommendations on the RETRIEVED QDRANT TEXT CHUNKS provided below.

CRIME TYPE: {crime_sub_type}
COMPLAINT NARRATIVE: {complaint_text[:1000]}
EXTRACTED ENTITIES: {json.dumps(entities)}
EVALUATOR FEEDBACK: {feedback if feedback else "None"}

=== RETRIEVED QDRANT CHUNKS ===
{rag_context}
================================

Task:
Analyze the COMPLAINT NARRATIVE for ALL distinct statutory offences committed under Indian Penal Statutes (Bharatiya Nyaya Sanhita, 2023, Information Technology Act, 2000, or relevant Special & Local Laws).

INSTRUCTIONS:
1. Identify and list ALL applicable penal sections that match the complaint narrative facts.
2. Ground rationale strictly on the actual COMPLAINT NARRATIVE provided.
3. Cite the exact source document name and page number found in the RETRIEVED QDRANT CHUNKS. If no chunk is retrieved, specify the relevant statute name.

Respond ONLY in valid JSON matching this exact structure:
{{
  "bns_sections": [
    {{
      "code": "<STATUTORY_SECTION_CODE>",
      "title": "<EXACT_LEGAL_SECTION_TITLE>",
      "rationale": "<SPECIFIC_FACTUAL_RATIONALE_CITING_ACTUAL_COMPLAINT_NARRATIVE>",
      "source_document": "<CITED_SOURCE_DOCUMENT_NAME>",
      "page_number": "<PAGE_NUMBER>"
    }}
  ],
  "punishment_duration": "<STATUTORY_PUNISHMENT_DURATION>",
  "cognizability": "<COGNIZABLE_OR_NON_COGNIZABLE_AND_BAILABLE_STATUS>",
  "legal_note": "<STATUTORY_GROUNDING_SUMMARY>"
}}
"""
    try:
        resp = llm.invoke(prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)
        data = parse_llm_json(text, schema_model=BNSDraftSchema)
        return {"bns_draft": data}
    except Exception as e:
        print(f"[-] BNS Agent Node Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return {"bns_draft": BNSDraftSchema().model_dump()}
