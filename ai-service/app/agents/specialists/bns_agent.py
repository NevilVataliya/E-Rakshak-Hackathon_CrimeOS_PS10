import json
from app.agents.state import AgentState
from app.rag.qdrant_client import search_legal_sops
from app.utils.json_helper import parse_llm_json
from app.models.schemas import BNSDraftSchema
from config import get_agent_llm, ENABLE_DEMO_FALLBACKS
from app.ingestion.smart_router import _invoke_llm_with_timeout

def bns_agent_node(state: AgentState) -> dict:
    """
    BNS Substantive Legal Specialist Agent.
    Retrieves penal code sections (Bharatiya Nyaya Sanhita, 2023 & IT Act, 2000) from Qdrant.
    Grounds legal sections specifically against case facts universally without bias or fake chunk fallbacks.
    """
    crime_sub_type = state.get('crime_sub_type') or 'General Offence'
    complaint_text = state.get('translated_text') or state.get('complaint_text') or ''
    feedback = state.get('evaluation_feedback') or []
    entities = state.get('entities') or {}
    iteration = state.get('iteration_count') or 0
    
    semantic_query = complaint_text[:1000].strip()
    keyword_query = f"{crime_sub_type} penal section punishment statute BNS IT Act".strip()
    qdrant_docs = search_legal_sops(semantic_query=semantic_query, keyword_query=keyword_query, target_specialist="bns_specialist", top_k=6)
    
    formatted_chunks = []
    for d in qdrant_docs:
        formatted_chunks.append(f"[SOURCE: {d['source']} | PAGE: {d['page']}]:\n{d['text']}")
        
    rag_context = "\n\n---\n\n".join(formatted_chunks) if formatted_chunks else "No specific text chunks retrieved. Base recommendations strictly on standard statutory provisions of Bharatiya Nyaya Sanhita (BNS), 2023 and IT Act, 2000."

    llm = get_agent_llm("auto", temperature=0.1)
    if llm is None:
        return {"bns_draft": BNSDraftSchema().model_dump()}
    
    # Build retry instruction block — injected only on re-runs
    retry_block = ""
    if feedback and iteration > 0:
        issues = "\n".join(f"  - {f}" for f in feedback)
        retry_block = f"""
⚠️  CRITICAL RETRY INSTRUCTION (Attempt {iteration + 1}):
Your previous output was REJECTED by the Evaluator for the following specific reasons:
{issues}

You MUST directly address and fix each of the above failures in this response.
Do NOT return an empty 'bns_sections' list. You MUST identify and list at least one applicable BNS/IPC/IT Act section.
"""

    # Sections identified during ingestion (if any) — used for cross-stage reconciliation
    ingestion_sections = state.get('bns_sections_identified') or []
    ingestion_sections_str = ", ".join(ingestion_sections) if ingestion_sections else "None identified at ingestion stage"

    prompt = f"""
You are the Substantive Legal Specialist Agent for Indian Law Enforcement.
Ground your legal section recommendations on the RETRIEVED QDRANT TEXT CHUNKS provided below.
{retry_block}
CRIME TYPE: {crime_sub_type}
COMPLAINT NARRATIVE: {complaint_text[:3000]}
EXTRACTED ENTITIES: {json.dumps(entities)}
SECTIONS IDENTIFIED AT INGESTION STAGE: {ingestion_sections_str}

=== RETRIEVED QDRANT CHUNKS ===
{rag_context}
================================

Task:
Analyze the COMPLAINT NARRATIVE for ALL distinct statutory offences committed under Indian Penal Statutes (Bharatiya Nyaya Sanhita, 2023, Information Technology Act, 2000, or relevant Special & Local Laws).

INSTRUCTIONS:
1. Identify and list ALL applicable penal sections that match the complaint narrative facts.
2. Ground rationale strictly on the actual COMPLAINT NARRATIVE provided.
3. Cite the exact source document name and page number found in the RETRIEVED QDRANT CHUNKS. If no chunk is retrieved, specify the relevant statute name.
4. RAG-GROUNDED OPEN-SET RECOGNITION: Identify sections UNIVERSALLY by matching the complaint facts against the legal offense elements found in the RETRIEVED QDRANT CHUNKS. Consider ANY statute present in the corpus — Bharatiya Nyaya Sanhita (BNS) 2023, Bharatiya Sakshya Adhiniyam (BSA) 2023, Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023, Information Technology Act 2000, POCSO, NDPS, or any Special & Local Law — based on what the FACTS support. Do NOT limit yourself to a pre-defined list of crimes. If the facts describe deception/fraud with monetary loss, identify the cheating section (e.g. BNS 318) from the retrieved chunks. If the facts describe threats/intimidation, identify the criminal intimidation section (e.g. BNS 351) from the retrieved chunks. If the facts describe identity theft/personation, identify the corresponding IT Act section. The retrieved chunks are your source of truth for which sections exist and apply.
5. NEVER INVENT SECTIONS NOT IN RETRIEVED CHUNKS: Only output sections whose text is actually present in the RETRIEVED QDRANT CHUNKS or that are explicitly named in the COMPLAINT NARRATIVE. If the relevant statute text is not in the retrieved chunks, note in 'legal_note' that the grounding chunk was not retrieved and recommend retrieval of the specific statute.
6. TREAT INGESTION SECTIONS AS OLD-LAW LEADS ONLY: The sections identified at the ingestion stage (see SECTIONS IDENTIFIED AT INGESTION STAGE above) may be OLD IPC sections (e.g. "IPC 388", "IPC 170", "IPC 420") or IT Act sections. These are historical leads recorded from the complaint document — they are NOT the current law. The Bharatiya Nyaya Sanhita (BNS) 2023 is structurally different from the Indian Penal Code (IPC) and sections CANNOT be mapped 1:1. You MUST independently identify the CURRENT BNS/BSA/BNSS/IT Act sections that match the case FACTS by grounding them in the RETRIEVED QDRANT CHUNKS. Do NOT copy IPC sections as-is into your output. For example, if ingestion cited "IPC 388" (extortion), find the current BNS extortion section from the retrieved chunks. If the relevant statute text is not in the retrieved chunks, state so in 'legal_note' — do NOT guess or invent a section number.
7. GROUND EVERY SECTION IN RETRIEVED CHUNKS: Every section you output MUST be grounded in the RETRIEVED QDRANT CHUNKS (BNS 2023, BSA 2023, BNSS 2023, IT Act 2000, or Special & Local Laws present in the corpus). Cite the exact source document name and page number. If a section was identified at ingestion but you cannot find its current-law grounding in the retrieved chunks, do NOT include it — instead note it in 'legal_note' as needing retrieval.
8. Include the section number AND a short description in brackets, e.g. "BNS 318 (Cheating)".

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
        resp = _invoke_llm_with_timeout(llm, prompt)
        text = resp.content if hasattr(resp, 'content') else str(resp)
        data = parse_llm_json(text, schema_model=BNSDraftSchema)
        return {"bns_draft": data}
    except Exception as e:
        print(f"[-] BNS Agent Node Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return {"bns_draft": BNSDraftSchema().model_dump()}
