import os
import json
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

# Analytics parse-response endpoint defined at line 479


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

    # If no structured search queries, attempt to extract entities from case record
    if not search_queries and req.case_number:
        try:
            conn_temp = psycopg2.connect(DATABASE_URL)
            cur_temp = conn_temp.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur_temp.execute("SELECT summary, investigation_plan FROM cases WHERE case_number = %s", (req.case_number,))
            c_row = cur_temp.fetchone()
            cur_temp.close()
            conn_temp.close()
            if c_row:
                plan = c_row.get("investigation_plan") or {}
                if isinstance(plan, str):
                    import json as _j
                    plan = _j.loads(plan)
                text = f"{c_row.get('summary') or ''} {plan.get('manual_text') or ''} {plan.get('complaint_text') or ''}"
                import re
                for p in re.findall(r'\+?\d{10,12}', text):
                    search_queries.append({"type": "phone", "value": p})
                for v in re.findall(r'[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}', text):
                    search_queries.append({"type": "vpa", "value": v})
                for a in re.findall(r'\b\d{9,18}\b', text):
                    search_queries.append({"type": "bank_account", "value": a})
        except Exception as ex:
            print(f"[!] Case text entity extraction error: {ex}")

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

    # ── PRIMARY: PostgreSQL exact-match across complaints AND cases ───────────
    pg_error = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Fetch complaints
        cur.execute(
            """
            SELECT complaint_number as case_ref, complaint_number as fir_ref, extracted_entities, crime_category
            FROM   complaints
            WHERE  complaint_number IS NOT NULL
            """)
        comp_rows = cur.fetchall()

        # Fetch other cases
        cur.execute(
            """
            SELECT case_number as case_ref, fir_number as fir_ref, investigation_plan as extracted_entities, crime_category
            FROM   cases
            WHERE  case_number IS NOT NULL
            """)
        case_rows = cur.fetchall()

        rows = comp_rows + case_rows
        cur.close()
        conn.close()

        for row in rows:
            cmp_num = row["case_ref"]
            if cmp_num == req.case_number:
                continue

            try:
                ent = row["extracted_entities"]
                if isinstance(ent, str):
                    import json as _json
                    ent = _json.loads(ent)
                if isinstance(ent, dict) and "entities" in ent:
                    ent = ent["entities"]
                elif isinstance(ent, dict) and "extracted_result" in ent and isinstance(ent["extracted_result"], dict):
                    ent = ent["extracted_result"].get("entities", {})
            except Exception:
                ent = {}

            if not isinstance(ent, dict):
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
                    fir_label = row.get("fir_ref") or cmp_num.replace("CMP-", "FIR-").replace("CR-", "FIR-")
                    matches.append({
                        "entity_type":         entity_type,
                        "entity_value":        entity_value,
                        "match_type":          MATCH_TYPE.get(entity_type, "CROSS_CASE_RECURRENCE"),
                        "matched_case":        cmp_num,
                        "matched_fir":         fir_label,
                        "police_station":      "Surat Cyber Crime PS",
                        "confidence":          confidence,
                        "description":         (
                            f"Entity '{entity_value}' ({entity_type}) matched with registered case "
                            f"{cmp_num} (crime category: {row.get('crime_category','CYBER')})."
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

class NoticeGenerateRequest(BaseModel):
    case_number: str
    notice_type: Optional[str] = "SECTION_94_BNSS"
    provider_name: Optional[str] = "State Bank of India Fraud Nodal Cell"
    provider_email: Optional[str] = "cgc.fraud@sbi.co.in"
    target_identifier: Optional[str] = None
    details: Optional[str] = None

class EmailDispatchRequest(BaseModel):
    case_number: str
    receiver_name: str
    receiver_email: str
    receiver_type: Optional[str] = "bank"
    objective: Optional[str] = "Statutory Requisition Directive"
    body_text: Optional[str] = None

@app.post("/api/requests/generate-notice")
async def generate_notice_endpoint(req: NoticeGenerateRequest):
    from app.pdf_generator.legal_notices import generate_section_94_bnss_pdf
    filename = f"Notice_{req.notice_type}_{req.case_number}.pdf"
    output_path = os.path.join(PDF_DIR, filename)
    generate_section_94_bnss_pdf(
        output_path=output_path,
        case_data={"case_number": req.case_number, "fir_number": req.case_number.replace("CR-", "FIR-"), "crime_sub_type": "Cyber Fraud / Financial Investigation"},
        request_details={"target_provider": req.provider_name, "items": [f"Target: {req.target_identifier or req.details or 'Requisition Data'}"]}
    )
    return {
        "status": "success",
        "notice_id": f"REQ-{req.case_number}-{int(os.path.getmtime(output_path))}",
        "case_number": req.case_number,
        "filename": filename,
        "pdf_url": f"/api/requests/download/{filename}"
    }

@app.post("/api/requests/dispatch-email")
async def dispatch_email_endpoint(req: EmailDispatchRequest):
    from app.workflow_automator.smtp_mailer import SMTPMailer
    mailer = SMTPMailer()
    res = mailer.send_email(
        to_email=req.receiver_email,
        to_name=req.receiver_name,
        subject=f"OFFICIAL STATUTORY DIRECTIVE: {req.objective} [CrimeOS-REF: {req.case_number}]",
        body_text=req.body_text or f"Requisition directive for case {req.case_number}.",
        case_number=req.case_number
    )
    return {
        "status": "success",
        "dispatch": res
    }

@app.get("/api/analytics/inbox-status")
async def get_inbox_status(case_number: Optional[str] = None):
    from app.workflow_automator.inbox_monitor import InboxMonitorAgent
    monitor = InboxMonitorAgent()
    results = monitor.check_inbox_once(target_case_number=case_number)
    return {
        "status": "online",
        "inbox_active": True,
        "processed_count": len(results),
        "results": results
    }

class ParseAnalyticsRequest(BaseModel):
    case_number: Optional[str] = "CR-2026-9910"
    response_type: Optional[str] = "BANK_STATEMENT"
    reply_id: Optional[str] = None
    file_path: Optional[str] = None
    file_content: Optional[str] = None
    case_entities: Optional[Dict[str, Any]] = None

@app.post("/api/analytics/parse-response")
async def parse_response_endpoint(req: ParseAnalyticsRequest):
    from app.workflow_automator.analytics_agent import AnalyticsAgent
    agent = AnalyticsAgent()
    
    p_name = "Nodal Compliance Authority"
    if req.response_type == "BANK_STATEMENT":
        p_name = "IndusInd Bank / Union Bank"
    elif req.response_type == "CDR":
        p_name = "Reliance Jio Telecom"
    elif req.response_type == "IP_LOGS":
        p_name = "Google LERT / Telegram"

    case_no = req.case_number or "CR-2026-9910"
    content = req.file_path or req.file_content or f"Simulated forensic payload for {req.response_type} case {case_no}"
    res = agent.analyze_response(
        provider_name=p_name,
        response_type=req.response_type or "BANK_STATEMENT",
        file_path_or_content=content,
        case_number=case_no,
        case_entities=req.case_entities
    )
    return res

@app.post("/api/analytics/upload-and-parse")
async def upload_and_parse_response_file(
    file: UploadFile = File(...),
    case_number: str = Form("CR-2026-9910"),
    response_type: str = Form("BANK_STATEMENT"),
    case_entities: Optional[str] = Form(None)
):
    from app.workflow_automator.analytics_agent import AnalyticsAgent
    from app.workflow_automator.certificate_generator import generate_section_63_bsa_certificate

    agent = AnalyticsAgent()

    # Save uploaded file
    file_bytes = await file.read()
    file_name = file.filename or f"response_{response_type.lower()}.csv"
    save_path = os.path.join(UPLOAD_DIR, f"{case_number.replace('/', '_')}_{file_name}")
    with open(save_path, "wb") as f:
        f.write(file_bytes)

    parsed_entities = None
    if case_entities:
        try:
            parsed_entities = json.loads(case_entities)
        except Exception:
            pass

    # Process and parse
    res = agent.analyze_response(
        provider_name=file_name,
        response_type=response_type,
        file_path_or_content=save_path,
        case_number=case_number,
        case_entities=parsed_entities
    )

    # Attach Section 63 BSA certificate automatically
    cert = generate_section_63_bsa_certificate(
        case_number=case_number,
        evidence_type=response_type,
        file_name=file_name,
        file_content_or_bytes=file_bytes,
        summary_findings=res.get("executive_summary", "")
    )
    res["section_63_certificate"] = cert
    return res

class CertificateRequest(BaseModel):
    case_number: str
    evidence_type: str = "BANK_STATEMENT"
    file_name: Optional[str] = None
    file_content: Optional[str] = None
    officer_name: Optional[str] = "PSI Inspector V. K. Patel"
    police_station: Optional[str] = "Surat Cyber Crime Police Station, Gujarat"
    summary_findings: Optional[str] = None

@app.post("/api/analytics/generate-certificate")
async def generate_certificate_endpoint(req: CertificateRequest):
    from app.workflow_automator.certificate_generator import generate_section_63_bsa_certificate
    content = req.file_content or f"Electronic Evidence Record for Case {req.case_number} Type {req.evidence_type}"
    cert = generate_section_63_bsa_certificate(
        case_number=req.case_number,
        evidence_type=req.evidence_type,
        file_name=req.file_name or f"{req.evidence_type.lower()}_evidence.csv",
        file_content_or_bytes=content,
        officer_name=req.officer_name or "PSI Inspector V. K. Patel",
        police_station=req.police_station or "Surat Cyber Crime Police Station, Gujarat",
        summary_findings=req.summary_findings or ""
    )
    return cert

# ── HIERARCHICAL SUMMARIZER AGENT ENDPOINTS ───────────────────────────────────

class ModuleSummaryRequest(BaseModel):
    case_number: str
    module_id: str
    module_payload: Optional[Dict[str, Any]] = None

class GlobalSummaryRequest(BaseModel):
    case_number: str
    module_summaries: Dict[str, Dict[str, Any]]

@app.post("/api/summary/module")
async def summarize_module_endpoint(req: ModuleSummaryRequest):
    from app.workflow_automator.summarizer_agent import SummarizerAgent
    agent = SummarizerAgent()
    return agent.summarize_module(
        case_number=req.case_number,
        module_id=req.module_id,
        module_payload=req.module_payload or {}
    )

@app.post("/api/summary/global")
async def summarize_global_endpoint(req: GlobalSummaryRequest):
    from app.workflow_automator.summarizer_agent import SummarizerAgent
    agent = SummarizerAgent()
    return agent.summarize_global(
        case_number=req.case_number,
        module_summaries=req.module_summaries
    )

# ── EMAIL RESPONSE MANAGER & FOLLOWBACK SYSTEM ENDPOINTS ───────────────────

class CheckInboxRequest(BaseModel):
    case_number: Optional[str] = None
    since_timestamp: Optional[Any] = None
    smtp_credentials: Optional[Dict[str, Any]] = None

class IngestReplyRequest(BaseModel):
    case_number: str
    sender_email: str
    subject: str
    body_text: str
    attachments: Optional[List[Dict[str, Any]]] = None

class SendFollowbackRequest(BaseModel):
    case_number: str
    recipient_email: str
    subject: str
    body: str
    smtp_credentials: Optional[Dict[str, Any]] = None

class WorkflowDispatchNoticeRequest(BaseModel):
    case_number: str
    objective: str
    receiver_name: str
    receiver_email: str
    receiver_type: Optional[str] = "financial_fraud"
    context_data: Optional[Dict[str, Any]] = None
    smtp_credentials: Optional[Dict[str, Any]] = None

class CustomTemplateRequest(BaseModel):
    template_id: str
    title: str
    category: Optional[str] = "third_party_intermediary"
    subject_template: str
    body_template: str
    legal_statute_ref: Optional[str] = "Section 94 BNSS"




@app.post("/api/email/check-inbox")
async def check_inbox_endpoint(req: CheckInboxRequest):
    """
    Polls IMAP / simulated inbox for authority replies, runs Groq LLM classification,
    saves evidence to case database, and returns processed replies with followback drafts.
    """
    from app.workflow_automator.inbox_monitor import InboxMonitorAgent
    from app.workflow_automator.email_response_manager import classify_reply_with_groq

    creds = req.smtp_credentials or {}
    user = creds.get("imap_user") or creds.get("smtp_user") or os.environ.get("IMAP_USERNAME") or os.environ.get("SMTP_USER") or os.environ.get("SENDER_EMAIL")
    pwd = creds.get("imap_pass") or creds.get("smtp_pass") or os.environ.get("IMAP_PASSWORD") or os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD")
    raw_host = creds.get("imap_host") or creds.get("smtp_host") or os.environ.get("IMAP_HOST") or "imap.gmail.com"
    host = raw_host.replace("smtp.", "imap.")
    port = int(creds.get("imap_port") or creds.get("smtp_port") or os.environ.get("IMAP_PORT") or 993)

    processed_replies = []
    if user and pwd:
        try:
            inbox_agent = InboxMonitorAgent(imap_host=host, imap_port=port if port != 587 else 993, username=user, password=pwd)
            raw_mails = inbox_agent.check_inbox_once(
                target_case_number=req.case_number,
                since_timestamp=req.since_timestamp
            )

            # Deduplicate incoming mails by sender + subject, keeping top 5 most recent
            seen_keys = set()
            unique_mails = []
            for mail in reversed(raw_mails):
                key = (mail.get("sender_email") or mail.get("sender"), mail.get("subject"))
                if key not in seen_keys:
                    seen_keys.add(key)
                    unique_mails.append(mail)
                if len(unique_mails) >= 5:
                    break

            from concurrent.futures import ThreadPoolExecutor
            def _proc(mail):
                c_num = mail.get("case_number") or req.case_number or "CR-2026-9914"
                sender = mail.get("sender") or mail.get("sender_email") or "authority@provider.com"
                subj = mail.get("subject") or "Re: Legal Directive"
                body = mail.get("body_text") or mail.get("body") or ""
                atts = mail.get("attachments", [])
                return classify_reply_with_groq(
                    case_number=c_num,
                    sender_email=sender,
                    subject=subj,
                    body_text=body,
                    attachments=atts
                )

            if unique_mails:
                with ThreadPoolExecutor(max_workers=min(5, len(unique_mails))) as executor:
                    processed_replies = list(executor.map(_proc, unique_mails))
        except Exception as e:
            import traceback
            print(f"[Check Inbox Endpoint Warning]: {e}")
            traceback.print_exc()

    return {
        "status": "success",
        "case_number": req.case_number,
        "replies_count": len(processed_replies),
        "replies": processed_replies
    }


@app.post("/api/email/ingest-reply")
async def ingest_reply_endpoint(req: IngestReplyRequest):
    """
    Ingests simulated or manual incoming reply payload, classifies via Groq LLM,
    and returns structured reply with followback draft (if data is partial).
    """
    from app.workflow_automator.email_response_manager import classify_reply_with_groq

    reply_obj = classify_reply_with_groq(
        case_number=req.case_number,
        sender_email=req.sender_email,
        subject=req.subject,
        body_text=req.body_text,
        attachments=req.attachments
    )
    return {
        "status": "success",
        "reply": reply_obj
    }


@app.post("/api/email/send-followback")
async def send_followback_endpoint(req: SendFollowbackRequest):
    """
    Sends the human-approved followback email via SMTP ONLY when explicitly triggered by officer.
    """
    from app.workflow_automator.smtp_mailer import SMTPMailer

    creds = req.smtp_credentials or {}
    smtp_host = creds.get("smtp_host") or os.environ.get("SMTP_HOST") or "smtp.gmail.com"
    smtp_port = int(creds.get("smtp_port") or os.environ.get("SMTP_PORT") or 587)
    smtp_user = creds.get("smtp_user") or os.environ.get("SMTP_USER") or os.environ.get("SENDER_EMAIL")
    smtp_pass = creds.get("smtp_pass") or os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD")

    if not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=400,
            detail="Real SMTP Credentials Missing: Please set SMTP_USER and SMTP_PASS in .env or configure credentials in UI."
        )

    mailer = SMTPMailer(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_username=smtp_user,
        smtp_password=smtp_pass,
        sender_email=smtp_user,
        sender_name="Surat Cyber Crime Police Station",
        simulation_mode=False
    )

    res = mailer.send_email(
        to_email=req.recipient_email,
        to_name="Nodal Officer",
        subject=req.subject,
        body_text=req.body,
        case_number=req.case_number
    )

    if not res.get("success"):
        raise HTTPException(status_code=500, detail=f"Followback SMTP Email Dispatch Failed: {res.get('error')}")

    return {
        "status": "success",
        "case_number": req.case_number,
        "recipient": req.recipient_email,
        "dispatch": res
    }


@app.post("/api/workflow/dispatch-notice")
async def workflow_dispatch_notice(req: WorkflowDispatchNoticeRequest):
    from app.workflow_automator.smtp_mailer import SMTPMailer

    creds = req.smtp_credentials or {}
    smtp_host = creds.get("smtp_host") or os.environ.get("SMTP_HOST") or os.environ.get("SMTP_SERVER") or "smtp.gmail.com"
    smtp_port = int(creds.get("smtp_port") or os.environ.get("SMTP_PORT") or 587)
    smtp_user = creds.get("smtp_user") or os.environ.get("SMTP_USER") or os.environ.get("SMTP_USERNAME") or os.environ.get("SENDER_EMAIL")
    smtp_pass = creds.get("smtp_pass") or os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD") or os.environ.get("EMAIL_PASSWORD")

    if not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=400,
            detail="Real SMTP Credentials Missing: Could not find SMTP_USER or SMTP_PASS in environment (.env). Please set SMTP_USER and SMTP_PASS in .env file."
        )

    mailer = SMTPMailer(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_username=smtp_user,
        smtp_password=smtp_pass,
        sender_email=os.environ.get("SENDER_EMAIL", smtp_user),
        sender_name=os.environ.get("SENDER_NAME", "Surat Cyber Crime Police Station"),
        simulation_mode=False
    )

    body = f"STATUTORY DIRECTIVE UNDER SECTION 94 BNSS\n\nCase FIR / Ref: {req.case_number}\nTarget Identifier: {req.context_data.get('target_identifier') if req.context_data else 'N/A'}\n\nObjective: {req.objective}\n\nPlease acknowledge receipt and process immediately.\n\nPSI Inspector V. K. Patel\nSurat Cyber Crime Station\nEmail: {smtp_user}"

    sent_subject = f"URGENT STATUTORY DIRECTIVE: {req.objective} - Target {req.context_data.get('target_identifier') if req.context_data else ''} [Case: {req.case_number}] [CrimeOS-REF: {req.case_number}]"

    res = mailer.send_email(
        to_email=req.receiver_email,
        to_name=req.receiver_name,
        subject=sent_subject,
        body_text=body,
        case_number=req.case_number
    )

    if not res.get("success"):
        raise HTTPException(status_code=500, detail=f"Real SMTP Email Dispatch Failed: {res.get('error')}")

    return {
        "status": "success",
        "case_number": req.case_number,
        "recipient": req.receiver_email,
        "dispatch": res
    }

@app.post("/api/workflow/templates/custom")
async def register_custom_template(req: CustomTemplateRequest):
    from app.workflow_automator.template_engine import TemplateEngine
    engine = TemplateEngine()
    engine.register_template(req.template_id, req.dict())
    return {
        "status": "success",
        "template_id": req.template_id,
        "message": f"Custom notice template '{req.title}' registered successfully."
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


