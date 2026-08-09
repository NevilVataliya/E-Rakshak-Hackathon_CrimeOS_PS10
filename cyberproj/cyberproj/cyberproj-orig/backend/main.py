import os
import shutil
import tempfile
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from backend.config import load_settings, save_settings, AppSettings, OfficerProfile, SmtpConfig
from backend.services.cdr_parser import parse_cdr_file
from backend.services.bank_parser import parse_bank_statement
from backend.services.mail_monitor import poll_mailbox_for_case
from backend.services.audit_logger import get_audit_trail, log_action
from backend.services.gemini_service import (
    analyze_reply_text, 
    analyze_cdr_records, 
    correlate_investigation_evidence, 
    generate_case_investigation_summary
)
import backend.services.case_manager as cm

from generate_mock_cdr import generate_mock_cdr

app = FastAPI(title="Cyber Forensic & Investigation Portal API")

@app.on_event("startup")
def startup_event():
    # Automatically generate mock CDR on startup if not present
    frontend_mock_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "mock_cdr.csv")
    if not os.path.exists(frontend_mock_file):
        try:
            generate_mock_cdr(frontend_mock_file)
            print(f"Successfully auto-generated mock CDR on startup at {frontend_mock_file}.")
        except Exception as e:
            print(f"Failed to auto-generate mock CDR: {e}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- PYDANTIC REQUEST SCHEMAS -----------------

class SettingsUpdatePayload(BaseModel):
    gemini_api_key: Optional[str] = None
    officer: Optional[Dict[str, Any]] = None
    smtp: Optional[Dict[str, Any]] = None

class EmailGeneratePayload(BaseModel):
    template_type: str
    case_number: str
    target_name: str
    target_identifier: str
    entity_name: str
    legal_section: str
    additional_details: Optional[str] = ""

class EmailSendPayload(BaseModel):
    recipient_email: str
    subject: str
    body: str
    case_id: Optional[str] = None
    request_id: Optional[str] = None

class ReplyAnalysisPayload(BaseModel):
    reply_text: str
    clues: Optional[str] = ""

class CdrAnalysisPayload(BaseModel):
    cdr_summary: Dict[str, Any]
    clues: str

# New Pydantic Case Schemas
class CaseCreatePayload(BaseModel):
    case_id: str
    fir_number: str
    police_station: str
    officer_name: str
    officer_designation: str
    official_email: str
    investigation_purpose: str
    legal_authority: str
    date: Optional[str] = None
    suspect_details: Optional[str] = ""
    victim_details: Optional[str] = ""

class TargetCreatePayload(BaseModel):
    type: str
    identifier: str
    name: str
    entity_name: str
    details: Optional[str] = ""

class RequestCreatePayload(BaseModel):
    type: str
    target_identifier: str
    entity_name: str
    legal_section: str
    subject: str
    body: str

# ----------------- SYSTEM SETTINGS ENDPOINTS -----------------

@app.get("/api/settings")
def get_settings():
    settings = load_settings()
    return {
        "has_api_key": bool(settings.gemini_api_key),
        "officer": settings.officer.dict(),
        "smtp": {
            "host": settings.smtp.host,
            "port": settings.smtp.port,
            "user": settings.smtp.user,
            "sender_name": settings.smtp.sender_name,
            "has_password": bool(settings.smtp.password)
        }
    }

@app.post("/api/settings")
def update_settings(payload: SettingsUpdatePayload):
    settings = load_settings()
    
    if payload.gemini_api_key is not None:
        settings.gemini_api_key = payload.gemini_api_key
        
    if payload.officer is not None:
        settings.officer = OfficerProfile(**payload.officer)
        
    if payload.smtp is not None:
        # Keep old password if not provided
        pwd = payload.smtp.get("password")
        if not pwd and settings.smtp.password:
            payload.smtp["password"] = settings.smtp.password
        settings.smtp = SmtpConfig(**payload.smtp)
        
    save_settings(settings)
    
    # Log configuration update
    log_action(settings.officer.name, "Update Settings", {"updated_fields": list(payload.dict(exclude_none=True).keys())})
    
    return {"status": "success", "message": "Settings saved successfully."}

# ----------------- CASE WORKSPACE ENDPOINTS -----------------

@app.get("/api/cases")
def list_cases():
    return cm.get_all_cases()

@app.post("/api/cases")
def create_case_route(payload: CaseCreatePayload):
    try:
        case = cm.create_case(payload.dict())
        log_action(payload.officer_name, "Case Intake Form Completed", {"case_id": payload.case_id, "fir_number": payload.fir_number})
        return case
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/cases/{case_id}")
def get_case_route(case_id: str):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    # Auto-healing: parse evidence if standard metadata fields are missing
    modified = False
    for ev in case.get("evidence", []):
        file_path = ev.get("file_path")
        if file_path and os.path.exists(file_path):
            ev_type = ev.get("type")
            meta = ev.get("metadata", {})
            if ev_type in ["cdr", "bank_statement"] and "total_records" not in meta:
                try:
                    if ev_type == "cdr":
                        from backend.services.cdr_parser import parse_cdr_file
                        stats = parse_cdr_file(file_path)
                        meta.update(stats)
                        ev["metadata"] = meta
                        ev["summary"] = f"Auto-parsed CDR: {stats['total_records']} calls."
                        modified = True
                    elif ev_type == "bank_statement":
                        from backend.services.bank_parser import parse_bank_statement
                        stats = parse_bank_statement(file_path)
                        meta.update(stats)
                        ev["metadata"] = meta
                        ev["summary"] = f"Auto-parsed Bank Statement: {stats['total_records']} transactions."
                        modified = True
                except Exception as e:
                    print(f"Self-heal parsing failed for {file_path}: {e}")
                    
    if modified:
        db = cm.load_cases_db()
        db[case_id] = case
        cm.save_cases_db(db)
        
    return case

@app.get("/api/cases/{case_id}/evidence/{evidence_id}/content")
def get_evidence_content(case_id: str, evidence_id: str):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    evidence = None
    for ev in case.get("evidence", []):
        if ev.get("id") == evidence_id:
            evidence = ev
            break
            
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    file_path = evidence.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Evidence file not found on disk")
        
    content = ""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".txt", ".html", ".eml", ".json", ".csv"]:
        try:
            if ext == ".csv":
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = [f.readline() for _ in range(100)]
                    content = "".join(lines)
                    if len(content) > 5000:
                        content = content[:5000] + "\n... [Content Truncated for View] ..."
            else:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read(10000)
                    if len(content) >= 10000:
                        content += "\n... [Content Truncated for View] ..."
        except Exception as e:
            content = f"Failed to read file contents: {str(e)}"
    else:
        content = f"Binary/structured file [{ext}]. Open via the Forensics tab to analyze charts."
        
    return {
        "filename": evidence["filename"],
        "type": evidence["type"],
        "metadata": evidence["metadata"],
        "content": content
    }

@app.post("/api/cases/{case_id}/targets")
def add_case_target(case_id: str, payload: TargetCreatePayload):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        target = cm.add_target(case_id, payload.dict())
        log_action(case["officer_name"], "Add Target Identifier", {"case_id": case_id, "target": payload.dict()})
        return target
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cases/{case_id}/requests")
def add_case_request(case_id: str, payload: RequestCreatePayload):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        req = cm.add_request(case_id, payload.dict())
        log_action(case["officer_name"], "Generate Compliance Request Draft", {"case_id": case_id, "request_id": req["id"], "type": payload.type})
        return req
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cases/{case_id}/requests/{request_id}/status")
def update_case_request_status(case_id: str, request_id: str, payload: Dict[str, Any]):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    status = payload.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Status field is required")
        
    try:
        req = cm.update_request_status(case_id, request_id, status, payload)
        log_action(case["officer_name"], f"Update Request Status ({status.upper()})", {"case_id": case_id, "request_id": request_id})
        return req
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ----------------- IMAP MAIL MONITOR ENDPOINT -----------------

@app.post("/api/cases/{case_id}/poll-mail")
def poll_case_mail(case_id: str):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    try:
        evidence_list = poll_mailbox_for_case(case_id, case["fir_number"], case["officer_name"])
        return {
            "status": "success", 
            "message": f"Polled mailbox successfully. Found and imported {len(evidence_list)} evidence attachments.",
            "evidence": evidence_list
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ----------------- UPLOAD & PROCESS EVIDENCE FILE -----------------

@app.post("/api/cases/{case_id}/evidence/upload")
async def upload_case_evidence(case_id: str, file: UploadFile = File(...), file_type: str = Form(...)):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    case_evidence_dir = os.path.join("data", "evidence", case_id)
    os.makedirs(case_evidence_dir, exist_ok=True)
    
    file_path = os.path.join(case_evidence_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    parsed_stats = {}
    
    try:
        if file_type == "cdr":
            parsed_stats = parse_cdr_file(file_path)
            cm.add_evidence(case_id, file.filename, "cdr", file_path, f"Parsed CDR: {parsed_stats['total_records']} call records.", parsed_stats)
        elif file_type == "bank_statement":
            parsed_stats = parse_bank_statement(file_path)
            cm.add_evidence(case_id, file.filename, "bank_statement", file_path, f"Parsed Bank Statement: {parsed_stats['total_records']} ledger transactions.", parsed_stats)
        elif file_type == "kyc":
            parsed_stats = {"filename": file.filename, "type": "kyc"}
            cm.add_evidence(case_id, file.filename, "kyc", file_path, "KYC profile information document.", parsed_stats)
        else:
            cm.add_evidence(case_id, file.filename, "reply", file_path, "Official reply/miscellaneous response text.", {})
            
        log_action(case["officer_name"], "Upload Case Evidence File", {
            "case_id": case_id,
            "filename": file.filename,
            "file_type": file_type
        })
        
        return {"status": "success", "filename": file.filename, "file_type": file_type, "stats": parsed_stats}
        
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Evidence processing failed: {str(e)}")

# ----------------- DRAFT NOTICE WRITER (STANDALONE) -----------------

@app.post("/api/generate-email")
def generate_email_route(payload: EmailGeneratePayload):
    settings = load_settings()
    
    target_ident = payload.target_identifier
    target_nm = payload.target_name
    entity = payload.entity_name
    sect = payload.legal_section
    case_no = payload.case_number
    details = payload.additional_details
    
    rank = settings.officer.rank or "Police Inspector"
    name = settings.officer.name or "[Officer Name]"
    dept = settings.officer.department or "[Cyber Cell Department]"
    contact = settings.officer.contact_number or "[Contact Phone]"
    officer_email = settings.officer.email or "[Official Email]"
    sig = settings.officer.signature or ""
    
    if payload.template_type == "freeze":
        subject = f"URGENT: Legal request for debit freeze on account {target_ident} - FIR No. {case_no}"
        body = f"""To,
The Nodal Officer / Compliance Cell,
{entity}.

Subject: Directives for immediate debit freeze of Bank Account {target_ident} under Section {sect}.

Sir/Madam,

It is reported that this unit is currently investigating a cyber crime case registered under Case/FIR Number: {case_no} at Cyber Police Station {dept}.

During the course of the investigation, it has been established that the stolen/fraudulent funds of the crime were routed into the following account maintained with your institution:
- Account Holder Name: {target_nm}
- Account Number: {target_ident}

Additional Fraud Coordinates:
{details}

Therefore, in exercise of powers conferred under Section {sect}, you are hereby directed to:
1. Immediately place a debit freeze on the aforementioned account.
2. Restrict all outward channels (Internet Banking, UPI, ATM, POS).
3. Furnish the current balance, account opening form (AOF), KYC documents, registered mobile number, and transaction logs from the inception till date.

Please acknowledge receipt and confirm compliance by replying to this email.

Regards,

{name}
{rank}
{dept}
Email: {officer_email} | Contact: {contact}
{sig}
"""
    elif payload.template_type == "statement":
        subject = f"Legal Notice under Section {sect} for bank statement of account {target_ident} - FIR No. {case_no}"
        body = f"""To,
The Nodal Officer / Compliance Department,
{entity}.

Subject: Requisition of bank statement and transactional details under Section {sect}.

Sir/Madam,

An investigation is underway regarding cybercrime activities registered under FIR/Case ID: {case_no} at Cyber Police Station {dept}.

To trace the trail of fraudulent funds, statement logs are required for the following account:
- Account Holder Name: {target_nm}
- Account Number: {target_ident}
- Specific duration required: {details}

Under the authority of Section {sect}, you are hereby requested to provide:
1. Certified Bank Statement in excel/CSV format for the mentioned duration.
2. Complete customer details, KYC files, and IP logs used for net-banking access.

Please send the requested files as a reply to this official email within 48 hours.

Regards,

{name}
{rank}
{dept}
Email: {officer_email} | Contact: {contact}
{sig}
"""
    else: # cdr
        subject = f"Requisition for Call Detail Records (CDR) of mobile number {target_ident} - FIR No. {case_no}"
        body = f"""To,
The Nodal Officer / Compliance Division,
{entity}.

Subject: Request for CDR, CGI Tower, and subscriber information of mobile {target_ident} under Section {sect}.

Sir/Madam,

A cybercrime cell case has been registered under FIR Number: {case_no} at Cyber Police Station {dept} and is currently under active investigation.

For the purpose of identifying suspect locations and network contacts, you are requested to furnish subscriber information for the following number:
- Target Suspect Mobile: {target_ident}
- Suspect Name: {target_nm}
- Duration of logs: {details}

By virtue of powers under Section {sect}, please provide:
1. Call Detail Records (CDR) including cell tower details (CGI) in Excel/CSV format.
2. Subscriber Details (SDR) and Customer Application Form (CAF) with photo ID.
3. GPRS/IP Logs and IMEI handset swaps during the specified window.

Kindly share this information securely via email to the sender.

Regards,

{name}
{rank}
{dept}
Email: {officer_email} | Contact: {contact}
{sig}
"""
    
    return {"subject": subject, "body": body}

# ----------------- SMTP EMAIL DISPATCH ENDPOINT -----------------

@app.post("/api/send-email")
def send_email_route(payload: EmailSendPayload):
    settings = load_settings()
    
    smtp_host = settings.smtp.host
    smtp_port = settings.smtp.port
    smtp_user = settings.smtp.user
    smtp_pass = settings.smtp.password
    sender_name = settings.smtp.sender_name or "Cyber Forensic Portal"
    
    if not smtp_host or not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=400, 
            detail="SMTP host, username, and app password must be configured in Settings first."
        )
        
    try:
        override_email = os.environ.get("OVERRIDE_RECIPIENT_EMAIL") or os.environ.get("TEST_RECIPIENT_EMAIL") or os.environ.get("TEST_EMAIL")
        actual_recipient = override_email.strip() if override_email and override_email.strip() else payload.recipient_email

        msg = MIMEMultipart()
        msg["From"] = f"{sender_name} <{smtp_user}>"
        msg["To"] = actual_recipient
        msg["Subject"] = payload.subject
        
        msg.attach(MIMEText(payload.body, "plain"))
        
        # Connect and send
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, actual_recipient, msg.as_string())
        server.quit()
        
        # Generate dummy message-id for tracking
        message_id = f"msg_{os.urandom(8).hex()}@cyberforensics"
        
        # Update case workflow if links are provided
        if payload.case_id and payload.request_id:
            cm.update_request_status(payload.case_id, payload.request_id, "sent", {
                "message_id": message_id,
                "subject": payload.subject,
                "body": payload.body
            })
            
        # Log action
        log_action(settings.officer.name, "Dispatch Official Email Notice", {
            "recipient": payload.recipient_email,
            "subject": payload.subject,
            "message_id": message_id,
            "case_id": payload.case_id
        })
        
        return {"status": "success", "message_id": message_id}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP sending failed: {str(e)}")

# ----------------- GEMINI EVIDENCE INTELLIGENCE ENDPOINTS -----------------

@app.post("/api/analyze-reply")
def analyze_reply_route(payload: ReplyAnalysisPayload):
    settings = load_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not set in Settings.")
        
    analysis = analyze_reply_text(payload.reply_text, payload.clues, settings.gemini_api_key)
    return {"analysis": analysis}

@app.post("/api/analyze-cdr-ai")
def analyze_cdr_ai_route(payload: CdrAnalysisPayload):
    settings = load_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not set in Settings.")
        
    analysis = analyze_cdr_records(payload.cdr_summary, payload.clues, settings.gemini_api_key)
    return {"analysis": analysis}

@app.post("/api/cases/{case_id}/correlate")
def run_case_correlation(case_id: str):
    settings = load_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not set in Settings.")
        
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    try:
        report = correlate_investigation_evidence(case, settings.gemini_api_key)
        cm.add_timeline_event(case_id, "AI Evidence Correlation Run", "Investigator triggered cross-evidence entity correlation report.", "custom")
        
        log_action(case["officer_name"], "Run Evidence Correlation Report", {"case_id": case_id})
        return {"correlation_report": report}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/cases/{case_id}/summary")
def run_case_summary(case_id: str):
    settings = load_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is not set in Settings.")
        
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    try:
        report = generate_case_investigation_summary(case, settings.gemini_api_key)
        cm.add_timeline_event(case_id, "AI Case Summary Generated", "Phase 14 Case Summary Report generated successfully.", "custom")
        
        log_action(case["officer_name"], "Generate Case Investigation Summary", {"case_id": case_id})
        return {"case_summary": report}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ----------------- WORKFLOW AUTOMATOR PIPELINE ENDPOINTS -----------------

@app.post("/api/cases/ingest-evaluator")
def ingest_evaluator_agent_route(payload: Dict[str, Any]):
    try:
        from workflow_automator.automator_agent import MasterWorkflowAutomatorAgent
        automator = MasterWorkflowAutomatorAgent()
        result = automator.ingest_evaluator_data(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Evaluator ingestion failed: {str(e)}")

@app.post("/api/cases/{case_id}/automate")
def run_case_automation_route(case_id: str):
    case = cm.get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    try:
        from workflow_automator.automator_agent import MasterWorkflowAutomatorAgent
        automator = MasterWorkflowAutomatorAgent()
        result = automator.run_automated_case_pipeline(case_id=case_id)
        log_action(case.get("officer_name", "Investigating Officer"), "Run Automated Investigation Pipeline", {"case_id": case_id})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Automated pipeline execution failed: {str(e)}")

# ----------------- IMMUTABLE AUDIT TRAIL -----------------

@app.get("/api/audit-trail")
def get_audit_trail_route():
    return get_audit_trail()

# Serve Frontend static files
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
