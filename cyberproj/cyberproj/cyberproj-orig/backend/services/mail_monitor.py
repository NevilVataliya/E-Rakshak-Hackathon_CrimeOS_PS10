import os
import imaplib
import email
from email.header import decode_header
import datetime
from typing import List, Dict, Any

from backend.config import load_settings
from backend.services.case_manager import add_evidence, add_timeline_event
from backend.services.audit_logger import log_action

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
EVIDENCE_DIR = os.path.join(DATA_DIR, "evidence")

os.makedirs(EVIDENCE_DIR, exist_ok=True)

def clean_filename(name: str) -> str:
    return "".join(c for c in name if c.isalnum() or c in ['.', '_', '-']).strip()

def classify_document(filename: str) -> str:
    """
    Classifies a document based on its file name.
    """
    fn = filename.lower()
    if any(x in fn for x in ["cdr", "call", "telecom", "records"]):
        return "cdr"
    elif any(x in fn for x in ["statement", "ledger", "transaction", "bank", "passbook"]):
        return "bank_statement"
    elif any(x in fn for x in ["kyc", "customer", "subscriber", "details", "profile"]):
        return "kyc"
    else:
        return "reply"

def poll_mailbox_for_case(case_id: str, fir_number: str, officer_name: str) -> List[Dict[str, Any]]:
    """
    Connects to the configured mail account via IMAP, searches for emails containing
    the case_id or fir_number in the subject, downloads attachments, classifies them,
    and appends them to the case evidence folder.
    """
    settings = load_settings()
    
    # Check SMTP credentials since we reuse them for IMAP
    user = settings.smtp.user
    password = settings.smtp.password
    host = settings.smtp.host
    
    if not user or not password or not host:
        raise ValueError("SMTP/IMAP account credentials are not configured in Settings.")
        
    # Infer IMAP server from SMTP host
    # e.g., smtp.gmail.com -> imap.gmail.com
    imap_host = host.replace("smtp.", "imap.")
    if imap_host == "smtp.office365.com":
        imap_host = "outlook.office365.com"
        
    imap_port = 993 # standard IMAP over SSL
    
    downloaded_evidence = []
    
    try:
        # Establish connection
        mail = imaplib.IMAP4_SSL(imap_host, imap_port)
        mail.login(user, password)
        mail.select("INBOX")
        
        # Build search queries: search for case_id or fir_number in subject
        search_queries = []
        if case_id:
            search_queries.append(f'SUBJECT "{case_id}"')
        if fir_number:
            search_queries.append(f'SUBJECT "{fir_number}"')
            
        mail_ids = set()
        for query in search_queries:
            status, data = mail.search(None, query)
            if status == "OK" and data[0]:
                mail_ids.update(data[0].split())
                
        # Parse matching emails
        for msg_id in mail_ids:
            status, msg_data = mail.fetch(msg_id, "(RFC822)")
            if status != "OK":
                continue
                
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Extract headers
            subject, encoding = decode_header(msg["Subject"])[0]
            if isinstance(subject, bytes):
                subject = subject.decode(encoding or "utf-8", errors="ignore")
                
            sender = msg.get("From")
            date_str = msg.get("Date")
            
            # Check message body or attachments
            attachments_downloaded = []
            
            # Create case evidence directory
            case_evidence_dir = os.path.join(EVIDENCE_DIR, case_id)
            os.makedirs(case_evidence_dir, exist_ok=True)
            
            # Check if multipart
            email_body_text = ""
            email_parts_to_process = []
            
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    filename = part.get_filename()
                    
                    if filename:
                        try:
                            filename_decoded, encoding = decode_header(filename)[0]
                            if isinstance(filename_decoded, bytes):
                                filename = filename_decoded.decode(encoding or "utf-8", errors="ignore")
                        except Exception:
                            pass
                        email_parts_to_process.append((part, filename))
                    else:
                        if content_type == "text/plain" and not email_body_text:
                            payload = part.get_payload(decode=True)
                            if payload:
                                email_body_text = payload.decode(errors="ignore")
                        elif content_type == "text/html" and not email_body_text:
                            payload = part.get_payload(decode=True)
                            if payload:
                                email_body_text = payload.decode(errors="ignore")
            else:
                body = msg.get_payload(decode=True)
                if body:
                    email_body_text = body.decode(errors="ignore")
                    
            # 1. Save the email body text if found
            if email_body_text:
                msg_suffix = msg_id.decode() if isinstance(msg_id, bytes) else str(msg_id)
                safe_body_name = f"email_reply_{msg_suffix[:8]}.txt"
                body_file_path = os.path.join(case_evidence_dir, safe_body_name)
                with open(body_file_path, "w", encoding="utf-8") as f:
                    f.write(email_body_text)
                    
                summary = f"Official email reply text received from {sender}."
                evidence_obj = add_evidence(case_id, safe_body_name, "reply", body_file_path, summary, {
                    "sender": sender,
                    "received_date": date_str,
                    "email_subject": subject
                })
                downloaded_evidence.append(evidence_obj)
                attachments_downloaded.append(safe_body_name)
                
            # 2. Process all attachments
            for part, filename in email_parts_to_process:
                safe_name = clean_filename(filename)
                file_path = os.path.join(case_evidence_dir, safe_name)
                
                payload = part.get_payload(decode=True)
                if payload:
                    with open(file_path, "wb") as f:
                        f.write(payload)
                        
                    doc_type = classify_document(safe_name)
                    parsed_metadata = {
                        "sender": sender,
                        "received_date": date_str,
                        "email_subject": subject
                    }
                    summary = f"Official reply attachment received from {sender} on date {date_str}."
                    
                    try:
                        if doc_type == "cdr":
                            from backend.services.cdr_parser import parse_cdr_file
                            stats = parse_cdr_file(file_path)
                            parsed_metadata.update(stats)
                            summary += f" Standardized CDR processed with {stats.get('total_records', 0)} calls."
                        elif doc_type == "bank_statement":
                            from backend.services.bank_parser import parse_bank_statement
                            stats = parse_bank_statement(file_path)
                            parsed_metadata.update(stats)
                            summary += f" Standardized Bank Statement parsed with {stats.get('total_records', 0)} ledger items."
                    except Exception as parse_err:
                        print(f"Auto-parsing IMAP file {safe_name} failed: {parse_err}")
                        
                    evidence_obj = add_evidence(case_id, safe_name, doc_type, file_path, summary, parsed_metadata)
                    downloaded_evidence.append(evidence_obj)
                    attachments_downloaded.append(safe_name)
                    
            if attachments_downloaded:
                # Log action to audit trail
                log_action(officer_name, "Poll Mailbox Match", {
                    "case_id": case_id,
                    "fir_number": fir_number,
                    "sender": sender,
                    "subject": subject,
                    "files_downloaded": attachments_downloaded
                })
                
        mail.close()
        mail.logout()
        
    except Exception as e:
        print(f"Error polling IMAP mailbox: {e}")
        # Raise error to display in frontend
        raise RuntimeError(f"IMAP login/poll failed: {str(e)}")
        
    return downloaded_evidence
