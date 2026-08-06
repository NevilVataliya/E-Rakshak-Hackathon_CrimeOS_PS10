import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union

from app.ingestion.smart_router import process_multimodal_complaint
from app.agents.orchestrator import investigation_graph
from app.rag.qdrant_client import search_legal_sops, get_qdrant_client, get_query_embedding, COLLECTION_NAME
from app.analytics.response_agent import analyze_large_provider_csv

app = FastAPI(
    title="Crime OS AI — Intelligence Backend Service",
    description="Agentic AI Platform for Intelligence-led Police Investigations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
PDF_DIR = os.path.join(os.getcwd(), "generated_pdfs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)

class ComplaintTextRequest(BaseModel):
    raw_text: str
    language: Optional[str] = "auto"
    officer_id: Optional[str] = "io_patel"

class InvestigationRequest(BaseModel):
    case_number: str
    complaint_text: str
    crime_category: Optional[str] = "CYBER"
    crime_sub_type: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None
    bns_sections_identified: Optional[List[str]] = None

class ResponseParseRequest(BaseModel):
    file_path: Optional[str] = None
    response_type: Optional[str] = "CDR"

class LinkageSearchRequest(BaseModel):
    case_number: str
    entities: Optional[Dict[str, Any]] = None
    search_query: Optional[str] = None
    search_type: Optional[str] = "auto"  # auto, phone, vpa, bank_account

@app.get("/health")
def health_check():
    return {"status": "online", "service": "Crime OS AI Backend", "engine": "FastAPI + LangGraph + Pandas Analytics"}

@app.get("/api/system/status")
def system_status():
    from config import is_offline_mode, OFFLINE_MODE, GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY, ENABLE_DEMO_FALLBACKS
    offline = is_offline_mode()
    has_keys = bool(GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY or ANTHROPIC_API_KEY)
    return {
        "offline_mode": offline,
        "config_mode": OFFLINE_MODE,
        "cloud_keys_configured": has_keys,
        "enable_demo_fallbacks": ENABLE_DEMO_FALLBACKS,
        "active_processors": ["TextProcessor (.txt,.md,.csv)", "DocxProcessor (.docx,.doc)", "PDFProcessor (.pdf)", "AudioProcessor (.wav,.mp3,.m4a,.ogg)", "ImageProcessor (.png,.jpg,.webp)"],
        "offline_capable_components": ["local_text_reader", "python_docx_extractor", "pymupdf_text", "tesseract_ocr", "faster_whisper", "heuristic_regex_extractor"],
        "warnings": ["Cloud API calls disabled in Standalone Offline Mode."] if offline else []
    }

@app.get("/api/config")
def get_config():
    from config import ENABLE_DEMO_FALLBACKS, is_offline_mode
    return {
        "enable_demo_fallbacks": ENABLE_DEMO_FALLBACKS,
        "offline_mode": is_offline_mode()
    }


@app.post("/api/ingest")
async def ingest_complaint(
    input_type: str = Form("multimodal"),
    raw_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    files: Union[List[UploadFile], UploadFile, None] = File(None)
):
    all_uploads = []
    if file:
        all_uploads.append(file)
    if files:
        if isinstance(files, list):
            all_uploads.extend(files)
        else:
            all_uploads.append(files)

    saved_paths = []
    for f in all_uploads:
        if f and f.filename:
            path = os.path.join(UPLOAD_DIR, f.filename)
            with open(path, "wb") as out:
                out.write(await f.read())
            saved_paths.append(path)

    result = process_multimodal_complaint(
        file_paths=saved_paths,
        raw_text=raw_text,
        input_type=input_type
    )
    return result

@app.post("/api/investigate")
async def run_investigation(req: InvestigationRequest):
    initial_state = {
        "case_id": req.case_number,
        "case_number": req.case_number,
        "complaint_text": req.complaint_text,
        "translated_text": req.complaint_text,
        "original_language": "en",
        "crime_category": req.crime_category or "CYBER",
        "crime_sub_type": req.crime_sub_type or "General Police Investigation",
        "entities": req.entities or {},
        "bns_sections_identified": req.bns_sections_identified or [],
        "active_specialists": [],
        "cross_case_matches": [],
        "bns_draft": None,
        "bsa_draft": None,
        "cyber_draft": None,
        "conventional_draft": None,
        "evaluation_status": "PENDING",
        "evaluation_feedback": [],
        "evaluation_degraded": False,
        "iteration_count": 0,
        "hitl_approved": False,
        "io_custom_notes": "",
        "master_fir_details": {},
        "investigation_steps": [],
        "legal_requests_to_generate": [],
        "summary": ""
    }

    try:
        final_state = investigation_graph.invoke(initial_state)
        return {
            "status": "success",
            "case_number": final_state.get("case_number"),
            "master_fir": final_state.get("master_fir_details"),
            "investigation_steps": final_state.get("investigation_steps"),
            "cross_case_matches": final_state.get("cross_case_matches"),
            "legal_requests": final_state.get("legal_requests_to_generate"),
            "summary": final_state.get("summary")
        }
    except Exception as e:
        print(f"[-] LangGraph Graph Execution Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/parse-response")
async def parse_provider_response(req: ResponseParseRequest):
    """
    Parses messy or large provider response files (CSV, Excel, PDF) using Hybrid Pandas + LLM Synthesizer.
    """
    result = analyze_large_provider_csv(file_path=req.file_path, response_type=req.response_type)
    return result

@app.post("/api/linkage/search")
async def search_entity_linkages(req: LinkageSearchRequest):
    """
    Cross-case criminal entity linkage search.

    Primary path  → PostgreSQL `complaints` table: exact entity overlap on
                    phone_numbers, vpas_upis, bank_accounts, email_addresses.
    Secondary path → Qdrant vector similarity (semantic) for any entity value
                    that returns fewer than 3 exact Postgres hits.

    Returns a fully-formed response with `matches` AND `stats` so the
    frontend always has data to render.
    """
    import psycopg2
    import psycopg2.extras
    from config import DATABASE_URL

    entities   = req.entities or {}
    search_queries: list[dict] = []

    # ── Build search query list ────────────────────────────────────────────
    if req.search_query and req.search_query.strip():
        search_queries.append({
            "type": req.search_type or "manual",
            "value": req.search_query.strip(),
        })

    for phone in entities.get("phone_numbers", []):
        v = str(phone).strip()
        if v:
            search_queries.append({"type": "phone", "value": v})

    for vpa in entities.get("vpas_upis", []):
        v = str(vpa).strip()
        if v:
            search_queries.append({"type": "vpa", "value": v})

    for acct in entities.get("bank_accounts", []):
        if isinstance(acct, dict):
            v = str(acct.get("account_number", "")).strip()
        else:
            v = str(acct).strip()
        if v:
            search_queries.append({"type": "bank_account", "value": v})

    for email in entities.get("email_addresses", []):
        v = str(email).strip()
        if v:
            search_queries.append({"type": "email", "value": v})

    matches: list[dict] = []
    seen_match_keys: set[str] = set()   # deduplicate (entity_value, case_number)

    # ── Confidence weights by entity type ─────────────────────────────────
    CONFIDENCE = {
        "phone":        0.95,
        "vpa":          0.92,
        "bank_account": 0.90,
        "email":        0.85,
        "manual":       0.80,
    }

    # ── Match type labels by entity ────────────────────────────────────────
    MATCH_TYPE = {
        "phone":        "CDR_RECURRENCE",
        "vpa":          "RECURRING_MULE",
        "bank_account": "BENEFICIARY_RECURRENCE",
        "email":        "EMAIL_OVERLAP",
        "manual":       "MANUAL_SEARCH_HIT",
    }

    ACTION = {
        "phone":        "Issue Section 94 BNSS Notice for CDR/IPDR from TSP. Check CCTNS for accused subscriber.",
        "vpa":          "Issue Section 94 BNSS Notice to UPI PSP Nodal Officer. Initiate 1930 CFCFRMS freeze.",
        "bank_account": "Issue Section 94 BNSS Notice to Bank Nodal Cell. Debit-freeze mule account immediately.",
        "email":        "Obtain subscriber details from e-mail provider via MLAT / Section 94 BNSS.",
        "manual":       "Cross-verify entity in CCTNS and ICJS portals.",
    }

    # ── PRIMARY: PostgreSQL exact-match ────────────────────────────────────
    pg_error = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch all OTHER complaints (already ingested) with their entities
        cur.execute(
            """
            SELECT complaint_number, extracted_entities, crime_category
            FROM   complaints
            WHERE  complaint_number IS NOT NULL
            """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        for row in rows:
            cmp_num = row["complaint_number"]
            # Skip the case we're analysing itself
            if cmp_num == req.case_number:
                continue

            try:
                ent = row["extracted_entities"]
                if isinstance(ent, str):
                    import json as _json
                    ent = _json.loads(ent)
            except Exception:
                ent = {}

            # Flatten stored entity values for fast lookup
            stored_phones  = {str(p).strip() for p in (ent.get("phone_numbers") or [])}
            stored_vpas    = {str(v).strip() for v in (ent.get("vpas_upis") or [])}
            stored_accts   = set()
            for a in (ent.get("bank_accounts") or []):
                stored_accts.add(str(a.get("account_number","")).strip() if isinstance(a, dict) else str(a).strip())
            stored_emails  = {str(e).strip() for e in (ent.get("email_addresses") or [])}

            STORED_MAP = {
                "phone":        stored_phones,
                "vpa":          stored_vpas,
                "bank_account": stored_accts,
                "email":        stored_emails,
            }

            for sq in search_queries:
                entity_type  = sq["type"]
                entity_value = sq["value"]
                stored_set   = STORED_MAP.get(entity_type, set())

                # Exact or substring match (normalise whitespace, case-insensitive)
                hit = any(
                    entity_value.lower().replace(" ", "") in s.lower().replace(" ", "")
                    or s.lower().replace(" ", "") in entity_value.lower().replace(" ", "")
                    for s in stored_set
                )

                if hit:
                    dedup_key = f"{entity_value}|{cmp_num}"
                    if dedup_key in seen_match_keys:
                        continue
                    seen_match_keys.add(dedup_key)

                    confidence = CONFIDENCE.get(entity_type, 0.80)
                    matches.append({
                        "entity_type":         entity_type,
                        "entity_value":        entity_value,
                        "match_type":          MATCH_TYPE.get(entity_type, "CROSS_CASE_RECURRENCE"),
                        "matched_case":        cmp_num,
                        "matched_fir":         cmp_num.replace("CMP-", "FIR-"),
                        "police_station":      "Cyber Crime PS (same station)",
                        "confidence":          confidence,
                        "description":         (
                            f"Entity '{entity_value}' ({entity_type}) found in complaint "
                            f"{cmp_num} (crime: {row.get('crime_category','CYBER')})."
                        ),
                        "recommended_action":  ACTION.get(entity_type, ACTION["manual"]),
                    })

    except Exception as e:
        pg_error = str(e)
        print(f"[!] Postgres linkage search error: {e}")

    # ── SECONDARY: Qdrant semantic similarity (for manual/vague queries) ───
    # Only runs for search queries that got < 3 Postgres hits, so the Qdrant
    # SOP collection can still surface related SOPs as investigative hints.
    pg_hit_values = {m["entity_value"] for m in matches}
    qdrant_queries = [sq for sq in search_queries if sq["value"] not in pg_hit_values]

    if qdrant_queries:
        client = get_qdrant_client()
        try:
            if client and client.collection_exists(COLLECTION_NAME):
                for sq in qdrant_queries[:3]:   # cap to avoid latency
                    val = sq["value"]
                    if not val:
                        continue
                    q_res = client.search(
                        collection_name=COLLECTION_NAME,
                        query_vector=get_query_embedding(str(val)),
                        limit=3
                    )
                    for pt in q_res:
                        if float(pt.score) >= 0.82:
                            p = pt.payload or {}
                            c_num = p.get("case_number")
                            if c_num and c_num != req.case_number:
                                dedup_key = f"{val}|{c_num}"
                                if dedup_key not in seen_match_keys:
                                    seen_match_keys.add(dedup_key)
                                    matches.append({
                                        "entity_type":        sq["type"],
                                        "entity_value":       val,
                                        "match_type":         "SEMANTIC_SIMILARITY",
                                        "matched_case":       c_num,
                                        "matched_fir":        p.get("fir_number", c_num),
                                        "police_station":     p.get("police_station", "Cyber Crime PS"),
                                        "confidence":         round(float(pt.score), 2),
                                        "description":        f"Semantic similarity match for '{val}' in case {c_num}.",
                                        "recommended_action": "Review matched case records and cross-check in CCTNS.",
                                    })
        except Exception as e:
            print(f"[*] Qdrant secondary linkage pass exception: {e}")

    # ── Build stats ────────────────────────────────────────────────────────
    stats = {
        "total_entities_searched":  len(search_queries),
        "total_matches":            len(matches),
        "high_confidence":          sum(1 for m in matches if m["confidence"] >= 0.85),
        "medium_confidence":        sum(1 for m in matches if 0.70 <= m["confidence"] < 0.85),
        "low_confidence":           sum(1 for m in matches if m["confidence"] < 0.70),
        "unique_linked_cases":      len({m["matched_case"] for m in matches}),
        "unique_police_stations":   len({m["police_station"] for m in matches}),
    }

    return {
        "status":       "success",
        "case_number":  req.case_number,
        "total_queries": len(search_queries),
        "matches":      matches,
        "stats":        stats,
        **({"pg_error": pg_error} if pg_error else {}),
    }


@app.get("/api/search-sops")
def search_sops_endpoint(query: str, specialist: Optional[str] = None):
    results = search_legal_sops(query=query, target_specialist=specialist, top_k=5)
    return {"query": query, "results": results}

@app.get("/api/requests/download/{filename}")
def download_legal_pdf(filename: str):
    path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(path):
        from app.pdf_generator.legal_notices import generate_section_94_bnss_pdf
        generate_section_94_bnss_pdf(
            output_path=path,
            case_data={"case_number": "CR-2026-9910", "fir_number": "FIR-9910/2026", "crime_sub_type": "Cyber Fraud"},
            request_details={"target_provider": "Reliance Jio", "items": ["Target: +91 98765 43210"]}
        )

    return FileResponse(path=path, filename=filename, media_type="application/pdf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
