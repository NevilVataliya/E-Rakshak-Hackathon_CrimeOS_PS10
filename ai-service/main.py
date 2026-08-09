import os
import sys
import uuid
import datetime
import tempfile
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

ROOT_PATH = os.path.dirname(os.path.abspath(__file__))
PARENT_PATH = os.path.dirname(ROOT_PATH)
if PARENT_PATH not in sys.path:
    sys.path.insert(0, PARENT_PATH)

smtp_mailer_inst = None  # Initialized below after workflow_automator imports
try:
    from workflow_automator import (
        MasterWorkflowAutomatorAgent,
        TemplateEngine,
        SMTPMailer,
        AnalyticsAgent,
        InboxMonitorAgent
    )
    workflow_automator = MasterWorkflowAutomatorAgent()
    template_engine_inst = TemplateEngine()
    smtp_mailer_inst = SMTPMailer()  # Standalone SMTP mailer for autonomous dispatch
except Exception as _wa_err:
    print(f"[!] Workflow Automator Agent initialization warning: {_wa_err}")
    workflow_automator = None
    template_engine_inst = None
    smtp_mailer_inst = None

# Thread-safe in-memory registry for Mandatory Human-in-the-Loop Approval Drafts
pending_approval_drafts: Dict[str, Dict[str, Any]] = {}

# Configurable Governance Policy: 'MANDATORY_HUMAN_APPROVAL' | 'AUTONOMOUS_LLM_AUTO_DISPATCH' | 'HYBRID_RISK_THRESHOLD'
AUTOMATION_GOVERNANCE_POLICY = "MANDATORY_HUMAN_APPROVAL"
AUTOMATION_RISK_THRESHOLD = 6.0

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

class WorkflowDispatchNoticeRequest(BaseModel):
    case_number: str
    objective: str
    receiver_name: str
    receiver_email: str
    receiver_type: str = "bank"
    context_data: Optional[Dict[str, Any]] = None
    template_id: Optional[str] = None

class WorkflowSimulateReplyRequest(BaseModel):
    case_number: str
    sender_email: str
    subject: str
    body_text: str
    attachments: Optional[List[Dict[str, Any]]] = None

class WorkflowApproveNoticeRequest(BaseModel):
    approval_id: str
    approved_by: Optional[str] = "PSI Inspector V. K. Patel"
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None

class WorkflowRejectNoticeRequest(BaseModel):
    approval_id: str
    rejected_by: Optional[str] = "PSI Inspector V. K. Patel"

class WorkflowSetPolicyRequest(BaseModel):
    policy: str  # MANDATORY_HUMAN_APPROVAL, AUTONOMOUS_LLM_AUTO_DISPATCH, HYBRID_RISK_THRESHOLD
    risk_threshold: Optional[float] = 6.0

class WorkflowCreateTemplateRequest(BaseModel):
    template_id: str
    title: str
    category: str = "third_party_intermediary"
    subject_template: str
    body_template: str
    required_vars: Optional[List[str]] = None
    legal_statute_ref: Optional[str] = "Bharatiya Nagarik Suraksha Sanhita (BNSS)"

class CaseSummaryGenerateRequest(BaseModel):
    case_number: str
    activity_timeline: Optional[List[Dict[str, Any]]] = None
    investigating_officer: Optional[str] = "PSI Inspector V. K. Patel"
    police_station: Optional[str] = "Central Cyber Crime Station"

@app.get("/health")
def health_check():
    return {"status": "online", "service": "Crime OS AI Backend", "engine": "FastAPI + LangGraph + Workflow Automator"}

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
        gen_legal_requests = final_state.get("legal_requests_to_generate", [])

        # ── SEAMLESS WORKFLOW AUTOMATOR INTEGRATION ────────────────────────────
        # Stage all investigation-generated legal requests as PENDING HUMAN APPROVAL drafts
        for req_item in gen_legal_requests:
            req_type = req_item.get("request_type", "SECTION_94_BNSS")
            provider_title = req_item.get("target_provider", "Nodal Officer")
            pdf_url = req_item.get("pdf_url", "")
            desc = req_item.get("description", "")
            
            # Resolve target recipient email from template_engine nodal directory
            resolved_email = "nodal.officer@institution.com"
            if template_engine_inst:
                contact = template_engine_inst.get_receiver_contact(provider_title)
                if contact and contact.get("email"):
                    resolved_email = contact.get("email")

            appr_id = f"APPR-INV-{uuid.uuid4().hex[:6].upper()}"
            draft_subject = f"[ CrimeOS LEGAL NOTICE ] {req_type} - Case {req.case_number} [CrimeOS-REF: {req.case_number}]"
            draft_body = (
                f"OFFICIAL STATUTORY NOTICE (HUMAN APPROVAL PENDING)\n\n"
                f"To: {provider_title} ({resolved_email})\n"
                f"Case Ref: {req.case_number}\n"
                f"Notice Type: {req_type}\n\n"
                f"Details: {desc}\n"
                f"Attached Document PDF: {pdf_url}\n\n"
                f"Please produce requested records / confirm freeze compliance within statutory timeframe.\n\n"
                f"Investigating Officer: PSI Inspector V. K. Patel\n"
                f"Surat Cyber Crime Police Station"
            )

            pending_approval_drafts[appr_id] = {
                "approval_id": appr_id,
                "case_number": req.case_number,
                "sender_email": resolved_email,
                "recommended_action": f"Dispatch {req_type} to {provider_title}",
                "draft_subject": draft_subject,
                "draft_body": draft_body,
                "recipient_email": resolved_email,
                "recipient_name": provider_title,
                "pdf_url": pdf_url,
                "status": "PENDING_HUMAN_APPROVAL",
                "created_at": datetime.datetime.now().isoformat()
            }
        # ──────────────────────────────────────────────────────────────────────

        return {
            "status": "success",
            "case_number": final_state.get("case_number"),
            "master_fir": final_state.get("master_fir_details"),
            "investigation_steps": final_state.get("investigation_steps"),
            "cross_case_matches": final_state.get("cross_case_matches"),
            "legal_requests": gen_legal_requests,
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

# ── WORKFLOW AUTOMATOR AGENT ENDPOINTS & GOVERNANCE POLICY ───────────

@app.get("/api/workflow/policy")
def get_automation_policy():
    global AUTOMATION_GOVERNANCE_POLICY, AUTOMATION_RISK_THRESHOLD
    return {
        "policy": AUTOMATION_GOVERNANCE_POLICY,
        "risk_threshold": AUTOMATION_RISK_THRESHOLD,
        "description": "Configurable LLM Auto-Dispatch vs Mandatory Human Officer Approval Engine"
    }

@app.post("/api/workflow/policy")
def set_automation_policy(req: WorkflowSetPolicyRequest):
    global AUTOMATION_GOVERNANCE_POLICY, AUTOMATION_RISK_THRESHOLD
    if req.policy not in ["MANDATORY_HUMAN_APPROVAL", "AUTONOMOUS_LLM_AUTO_DISPATCH", "HYBRID_RISK_THRESHOLD"]:
        raise HTTPException(status_code=400, detail="Invalid governance policy. Must be one of MANDATORY_HUMAN_APPROVAL, AUTONOMOUS_LLM_AUTO_DISPATCH, or HYBRID_RISK_THRESHOLD.")
    
    AUTOMATION_GOVERNANCE_POLICY = req.policy
    if req.risk_threshold is not None:
        AUTOMATION_RISK_THRESHOLD = req.risk_threshold
    
    print(f"[🛡️ Governance Engine Updated] Policy set to '{AUTOMATION_GOVERNANCE_POLICY}' (Risk Threshold: {AUTOMATION_RISK_THRESHOLD})")
    return {
        "status": "success",
        "policy": AUTOMATION_GOVERNANCE_POLICY,
        "risk_threshold": AUTOMATION_RISK_THRESHOLD,
        "message": f"Automation Governance Policy successfully set to '{AUTOMATION_GOVERNANCE_POLICY}'."
    }

@app.post("/api/workflow/templates/custom")
def create_custom_template(req: WorkflowCreateTemplateRequest):
    if not template_engine_inst:
        raise HTTPException(status_code=500, detail="Template Engine is unavailable.")
    
    tmpl = template_engine_inst.create_custom_template(
        template_id=req.template_id,
        title=req.title,
        category_str=req.category,
        subject_template=req.subject_template,
        body_template=req.body_template,
        required_vars=req.required_vars,
        legal_statute_ref=req.legal_statute_ref
    )
    return {
        "status": "success",
        "message": f"Custom Statutory Notice Template '{req.template_id}' registered successfully.",
        "template": {
            "template_id": tmpl.template_id,
            "title": tmpl.title,
            "category": tmpl.category.value,
            "legal_statute_ref": tmpl.legal_statute_ref
        }
    }

# ── DYNAMIC QDRANT RAG KNOWLEDGE BASE ENDPOINTS ───────────────────────

@app.get("/api/rag/documents")
def get_rag_documents():
    try:
        from app.rag.qdrant_client import list_ingested_documents
        docs = list_ingested_documents()
        return {"status": "success", "documents": docs}
    except Exception as e:
        print(f"[⚠️ RAG List Error]: {e}")
        return {"status": "error", "documents": []}

@app.post("/api/rag/documents/upload")
async def upload_rag_document(
    file: UploadFile = File(...),
    statute_type: Optional[str] = Form("custom_extended")
):
    # Bug 5.1 fix: Validate file type, size, and sanitize filename
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}
    MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

    # Sanitize filename to prevent path traversal
    raw_filename = file.filename or "uploaded_statute.pdf"
    filename = os.path.basename(raw_filename.replace("..", "").replace("/", "_").replace("\\", "_"))
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file_ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    try:
        from app.rag.qdrant_client import ingest_new_document
        temp_dir = os.path.join(tempfile.gettempdir(), "rag_uploads")
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, filename)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({len(content) // 1024}KB). Maximum allowed size is 20MB."
            )

        with open(temp_path, "wb") as f:
            f.write(content)

        result = ingest_new_document(file_path=temp_path, filename=filename, statute_type=statute_type)
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[WARNING] RAG Upload Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {str(e)}")

@app.delete("/api/rag/documents/{filename:path}")
def delete_rag_document(filename: str):
    try:
        from app.rag.qdrant_client import delete_ingested_document
        result = delete_ingested_document(filename=filename)
        return result
    except Exception as e:
        print(f"[⚠️ RAG Delete Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@app.post("/api/case-diary/generate-summary")
def generate_case_summary_report(req: CaseSummaryGenerateRequest):
    """
    Synthesizes all chronological activity logs and step details of a case into an
    official statutory Court Case Summary & Charge Sheet Brief under Section 167 BNSS.
    Dynamically extracts findings from the actual timeline — no hardcoded data.
    """
    import re as _re

    timeline = req.activity_timeline or [
        {"module": "MODULE_1_INTAKE", "step_title": "Complaint Ingestion", "details": "Activity timeline not provided."},
    ]

    steps_text = "\n".join([
        f"  [{item.get('module', 'STEP')}] {item.get('step_title', 'Action')}: {item.get('details', '')}"
        for item in timeline
    ])

    # Dynamically extract legal sections mentioned in any timeline detail
    all_details = " ".join([item.get("details", "") for item in timeline])
    bns_sections = list(set(_re.findall(
        r"(?:Section|Sec\.?)\s+[\d]+(?:\([\d]+\))?(?:\s+(?:BNS|BNSS|IT Act|CrPC|IPC|BSA))?",
        all_details
    )))
    sections_str = "; ".join(bns_sections) if bns_sections else "Refer to investigation steps above"

    # Dynamically detect account freeze actions
    freeze_steps = [
        item.get("details", "") for item in timeline
        if any(kw in item.get("details", "").lower() for kw in ["freeze", "frozen", "debit freeze", "1930"])
    ]
    freeze_summary = (
        "  - " + "\n  - ".join(freeze_steps[:3])
        if freeze_steps else
        "  - No account/asset freeze actions logged in this case."
    )

    # Dynamically detect cross-case linkage steps
    linkage_steps = [
        item.get("details", "") for item in timeline
        if any(kw in item.get("details", "").lower() for kw in ["link", "cross-case", "fir-", "match", "recurrence", "serial"])
    ]
    linkage_summary = (
        "  - " + "\n  - ".join(linkage_steps[:3])
        if linkage_steps else
        "  - No cross-case linkages identified in this case."
    )

    sep = "=" * 70
    summary_text = (
        f"STATUTORY CASE DIARY & INVESTIGATION EXECUTIVE SUMMARY\n"
        f"(Section 167 BNSS / Section 173 CrPC)\n"
        f"{sep}\n\n"
        f"Case Reference     : {req.case_number}\n"
        f"Investigating Unit : {req.police_station}\n"
        f"Investigating Officer: {req.investigating_officer}\n"
        f"Date of Synthesis  : {datetime.date.today().strftime('%d %B %Y')}\n"
        f"Total Steps Logged : {len(timeline)}\n\n"
        f"{sep}\n"
        f"I. CHRONOLOGICAL INVESTIGATION STEPS\n"
        f"{sep}\n"
        f"{steps_text}\n\n"
        f"{sep}\n"
        f"II. STATUTORY STATUTES & LEGAL FINDINGS\n"
        f"{sep}\n"
        f"Identified Statutes: {sections_str}\n\n"
        f"Account/Asset Actions:\n{freeze_summary}\n\n"
        f"Cross-Case Intelligence:\n{linkage_summary}\n\n"
        f"{sep}\n"
        f"III. RECOMMENDED COURT PROCEEDING\n"
        f"{sep}\n"
        f"Based on the investigation steps and statutory findings documented above,\n"
        f"the Investigating Officer recommends submission of the Charge Sheet / Final\n"
        f"Report under Section 193 BNSS before the competent Judicial Magistrate.\n\n"
        f"All collected digital evidence, legal notices dispatched, and responses\n"
        f"received from third-party authorities shall be annexed as exhibits.\n\n"
        f"Signed,\n"
        f"{req.investigating_officer}\n"
        f"{req.police_station}"
    )

    return {
        "status": "success",
        "case_number": req.case_number,
        "total_logged_steps": len(timeline),
        "statutory_case_summary": summary_text,
        "legal_statute_ref": "Section 167 BNSS / Section 173 CrPC",
        "sections_identified": bns_sections,
        "has_freeze_actions": len(freeze_steps) > 0,
        "has_cross_case_links": len(linkage_steps) > 0,
    }

@app.get("/api/workflow/templates")
def get_workflow_templates():
    if not template_engine_inst:
        return {"error": "Template Engine unavailable", "templates": [], "receiver_directory": {}}
    
    templates_list = []
    for tid, tmpl in template_engine_inst._templates.items():
        templates_list.append({
            "template_id": tmpl.template_id,
            "category": tmpl.category.value if hasattr(tmpl.category, 'value') else str(tmpl.category),
            "title": tmpl.title,
            "legal_statute_ref": tmpl.legal_statute_ref,
            "subject_template": tmpl.subject_template,
            "body_template": tmpl.body_template,
            "required_vars": tmpl.required_vars
        })
    
    return {
        "templates": templates_list,
        "receiver_directory": template_engine_inst.receiver_directory,
        "crime_domains": template_engine_inst.crime_domains
    }

@app.post("/api/workflow/dispatch-notice")
async def dispatch_workflow_notice(req: WorkflowDispatchNoticeRequest):
    if not workflow_automator:
        raise HTTPException(status_code=500, detail="MasterWorkflowAutomatorAgent not initialized.")
    
    result = workflow_automator.dispatch_investigation_notice(
        case_number=req.case_number,
        investigation_objective=req.objective,
        receiver_name=req.receiver_name,
        receiver_email=req.receiver_email,
        receiver_type=req.receiver_type,
        context_data=req.context_data or {}
    )
    return {"status": "success", "notice": result}

@app.post("/api/workflow/incoming-reply")
async def handle_workflow_incoming_reply(req: WorkflowSimulateReplyRequest):
    """
    Ingests and parses incoming authority email replies (CSV, PDF, Images, Text).
    Extracts entities, computes risk score, auto-adds discovered targets, and
    creates a PENDING HUMAN APPROVAL draft for any follow-up notice (Strict HITL Policy).
    """
    if not workflow_automator:
        raise HTTPException(status_code=500, detail="MasterWorkflowAutomatorAgent not initialized.")

    reply_state = workflow_automator.handle_async_incoming_reply(
        case_number=req.case_number,
        sender_email=req.sender_email,
        subject=req.subject,
        body_text=req.body_text,
        attachments=req.attachments
    )

    analytics = reply_state.get("analytics_result", {})
    next_step = reply_state.get("next_investigation_directive", {})
    auto_added = reply_state.get("auto_added_targets", [])

    # Evaluate Governance Policy: Autonomous LLM Auto-Dispatch vs Mandatory Human Approval Queue
    risk_score = float(analytics.get("risk_score", 8.0))
    is_auto_dispatch = (
        AUTOMATION_GOVERNANCE_POLICY == "AUTONOMOUS_LLM_AUTO_DISPATCH" or
        (AUTOMATION_GOVERNANCE_POLICY == "HYBRID_RISK_THRESHOLD" and risk_score <= AUTOMATION_RISK_THRESHOLD)
    )

    status_str = "APPROVED_AND_DISPATCHED" if is_auto_dispatch else "PENDING_HUMAN_APPROVAL"
    header_title = "OFFICIAL STATUTORY DIRECTIVE (AUTONOMOUS LLM DISPATCHED)" if is_auto_dispatch else "OFFICIAL STATUTORY DIRECTIVE (HUMAN APPROVAL PENDING)"

    # --- Build required variables before use (Bug 3.1 fix: were previously undefined) ---
    approval_id = f"APPR-REPLY-{uuid.uuid4().hex[:6].upper()}"
    draft_subject = (
        f"[CrimeOS FOLLOW-UP] Case {req.case_number} - "
        f"Reply Analyzed | Risk Score: {risk_score}/10"
    )
    if auto_added:
        target_str = ", ".join([
            str(t.get("entity_value", t)) if isinstance(t, dict) else str(t)
            for t in auto_added
        ])
    else:
        target_str = analytics.get("key_entities_found", "entities identified in response")
    rec_tmpl = analytics.get("recommended_next_action", "Issue statutory follow-up notice to the relevant authority")
    # -------------------------------------------------------------------------------------

    draft_body = (
        f"{header_title}\n\n"
        f"To: Nodal Compliance Officer ({req.sender_email})\n"
        f"Case Ref: {req.case_number}\n\n"
        f"Following analysis of your response received on {datetime.date.today().strftime('%Y-%m-%d')}, "
        f"the investigating unit requires immediate statutory action regarding identified target(s): {target_str}.\n\n"
        f"Directive: {rec_tmpl}\n"
        f"Forensic Risk Score: {risk_score}/10\n\n"
        f"Please preserve all logs and confirm compliance within 24 hours.\n\n"
        f"Investigating Officer: PSI Inspector V. K. Patel\n"
        f"Surat Cyber Crime Station"
    )

    approval_item = {
        "approval_id": approval_id,
        "case_number": req.case_number,
        "sender_email": req.sender_email,
        "analytics_summary": analytics,
        "next_step": next_step,
        "auto_added_targets": auto_added,
        "recommended_action": analytics.get("recommended_next_action", "Issue statutory follow-up notice"),
        "draft_subject": draft_subject,
        "draft_body": draft_body,
        "recipient_email": req.sender_email,
        "recipient_name": req.sender_email.split("@")[0].title(),
        "status": status_str,
        "auto_dispatched_by_llm": is_auto_dispatch,
        "approved_by": "Autonomous LLM Engine" if is_auto_dispatch else None,
        "dispatched_at": datetime.datetime.now().isoformat() if is_auto_dispatch else None,
        "created_at": datetime.datetime.now().isoformat()
    }

    if is_auto_dispatch and smtp_mailer_inst:
        try:
            smtp_mailer_inst.send_email(
                to_email=req.sender_email,
                to_name=approval_item["recipient_name"],
                subject=draft_subject,
                body_text=draft_body,
                case_number=req.case_number
            )
            print(f"[🤖 AUTONOMOUS LLM AUTO-DISPATCH] Email notice dispatched to '{req.sender_email}' without human intervention.")
        except Exception as se:
            print(f"[⚠️ LLM Auto-Dispatch SMTP Warning]: {se}")

    pending_approval_drafts[approval_id] = approval_item

    return {
        "status": "reply_ingested",
        "case_number": req.case_number,
        "analytics": analytics,
        "auto_added_targets": auto_added,
        "requires_human_approval": not is_auto_dispatch,
        "approval_item": approval_item
    }

@app.get("/api/workflow/pending-approvals")
def get_pending_approvals(case_number: Optional[str] = None):
    items = list(pending_approval_drafts.values())
    if case_number:
        items = [i for i in items if i["case_number"] == case_number]
    return {"pending_approvals": items, "total": len(items)}

@app.post("/api/workflow/approve-notice")
async def approve_workflow_notice(req: WorkflowApproveNoticeRequest):
    """
    HUMAN OFFICER APPROVAL ENDPOINT:
    Dispatches the LLM-drafted follow-up email ONLY when a human officer reads & approves it.
    """
    item = pending_approval_drafts.get(req.approval_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Approval ID '{req.approval_id}' not found.")

    subject = req.custom_subject or item["draft_subject"]
    body = req.custom_body or item["draft_body"]

    if workflow_automator and workflow_automator.smtp_mailer:
        dispatch_res = workflow_automator.smtp_mailer.send_email(
            to_email=item["recipient_email"],
            to_name=item["recipient_name"],
            subject=subject,
            body_text=body,
            case_number=item["case_number"]
        )
    else:
        dispatch_res = {"success": True, "status": "Simulated Dispatch"}

    item["status"] = "APPROVED_AND_DISPATCHED"
    item["approved_by"] = req.approved_by or "PSI Inspector V. K. Patel"
    item["dispatched_at"] = datetime.datetime.now().isoformat()
    item["dispatch_result"] = dispatch_res

    return {
        "status": "success",
        "message": f"Follow-up notice approved and dispatched by {item['approved_by']}",
        "approval_item": item
    }

@app.post("/api/workflow/reject-notice")
async def reject_workflow_notice(req: WorkflowRejectNoticeRequest):
    item = pending_approval_drafts.get(req.approval_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Approval ID '{req.approval_id}' not found.")
    
    item["status"] = "REJECTED_BY_OFFICER"
    item["rejected_by"] = req.rejected_by or "PSI Inspector V. K. Patel"
    item["rejected_at"] = datetime.datetime.now().isoformat()
    
    return {"status": "rejected", "approval_id": req.approval_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

