import os
import re
import time
import json
import imaplib
import email
import logging
from email.header import decode_header
from typing import Dict, Any, List, Optional, Callable

logger = logging.getLogger(__name__)

def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass

_load_env()

class InboxMonitorAgent:
    """
    INBOX MONITOR AGENT
    
    Monitors the sender/department email inbox asynchronously for incoming 
    responses from external providers (Banks, Tech Giants, Telecoms, Witnesses).
    
    - Extracts Case Reference Tokens: `[CrimeOS-REF: <case_number>]`
    - Parses body text and attachments (CSV, PDF, JSON).
    - Triggers the Master Workflow Automator Agent when a case-relevant reply arrives.
    """
    def __init__(
        self,
        imap_host: Optional[str] = None,
        imap_port: int = 993,
        username: Optional[str] = None,
        password: Optional[str] = None,
        on_reply_received_callback: Optional[Callable[[str, str, str, str, List[Dict[str, Any]]], None]] = None
    ):
        self.imap_host = imap_host or os.environ.get("IMAP_HOST", os.environ.get("SMTP_HOST", "imap.gmail.com"))
        self.imap_port = int(os.environ.get("IMAP_PORT", imap_port))
        self.username = username or os.environ.get("IMAP_USERNAME", os.environ.get("SMTP_USER", os.environ.get("SMTP_USERNAME", os.environ.get("SENDER_EMAIL"))))
        self.password = password or os.environ.get("IMAP_PASSWORD", os.environ.get("SMTP_PASS", os.environ.get("SMTP_PASSWORD")))
        self.on_reply_received_callback = on_reply_received_callback
        self._simulated_inbox: List[Dict[str, Any]] = []

    def simulate_receive_reply(
        self,
        sender_email: str,
        subject: str,
        body_text: str,
        attachment_filename: Optional[str] = None,
        attachment_content: Optional[str] = None,
        case_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Simulates an incoming email arrival into the inbox queue (for async testing / event simulation).
        """
        if case_number and f"[CrimeOS-REF: {case_number}]" not in subject:
            subject = f"{subject} [CrimeOS-REF: {case_number}]"

        attachments = []
        if attachment_filename and attachment_content:
            attachments.append({
                "filename": attachment_filename,
                "content": attachment_content,
                "format": "csv" if attachment_filename.endswith(".csv") else ("pdf" if attachment_filename.endswith(".pdf") else "text")
            })

        incoming_mail = {
            "timestamp": time.time(),
            "sender_email": sender_email,
            "subject": subject,
            "body_text": body_text,
            "attachments": attachments,
            "processed": False
        }

        self._simulated_inbox.append(incoming_mail)
        print(f"\n[INBOX MONITOR AGENT] New Incoming Email Detected!")
        print(f"   From: {sender_email}")
        print(f"   Subject: {subject}")
        if attachments:
            print(f"   Attachment: {attachments[0]['filename']} ({len(attachments[0]['content'])} bytes)")

        # Process immediately if callback is registered
        self._process_single_mail(incoming_mail)

        return incoming_mail

    def check_inbox_once(self, target_case_number: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Polls both the simulated queue and real IMAP inbox (if credentials present) once.
        Returns list of processed replies.
        """
        processed_list = []

        # 1. Process simulated queue
        for mail_item in list(self._simulated_inbox):
            if not mail_item.get("processed"):
                result = self._process_single_mail(mail_item)
                if result:
                    processed_list.append(result)

        # 2. Try real IMAP polling if credentials present or explicitly enabled
        enable_imap_env = os.environ.get("ENABLE_REAL_IMAP_POLLING", "true").lower() != "false"
        imap_user = (self.username or os.environ.get("IMAP_USERNAME") or os.environ.get("SMTP_USER") or os.environ.get("SENDER_EMAIL") or "").strip()
        imap_pass = (self.password or os.environ.get("IMAP_PASSWORD") or os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD") or "").strip()

        if enable_imap_env and imap_user and imap_pass and self.imap_host:
            try:
                self.username = imap_user
                self.password = imap_pass
                imap_results = self._poll_real_imap(target_case_number=target_case_number)
                processed_list.extend(imap_results)
            except Exception as e:
                logger.warning(f"IMAP Polling warning: {e}")
        elif imap_user and not imap_pass:
            logger.info("[Inbox Monitor] IMAP username present but password missing — skipping live IMAP poll.")

        return processed_list

    def _process_single_mail(self, mail_item: Dict[str, Any], target_case_number: Optional[str] = None) -> Optional[Dict[str, Any]]:
        sender_email = mail_item["sender_email"]
        subject = mail_item["subject"]
        body_text = mail_item["body_text"]
        attachments = mail_item.get("attachments", [])

        # Extract Case Ref ID from Subject or Body
        case_number = self.extract_case_reference(subject, body_text)
        if not case_number:
            mail_item["processed"] = True
            return None

        # Filter strictly by target case if specified — do not process or write files for other cases
        if target_case_number and case_number.upper() != target_case_number.upper():
            mail_item["processed"] = True
            return None

        print(f"   [INBOX MATCH] Matched Case Reference: '{case_number}'")
        mail_item["processed"] = True

        # Save attachment / body to cyberproj data/evidence directory using cyberproj_resolver
        import hashlib
        from .cyberproj_resolver import get_cyberproj_services
        from app.services.supabase_storage import upload_to_supabase_storage

        cyberproj_svcs = get_cyberproj_services()
        cyberproj_path = cyberproj_svcs.get("cyberproj_path") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        CYBERPROJ_DATA = os.path.join(cyberproj_path, "data", "evidence", case_number)
        os.makedirs(CYBERPROJ_DATA, exist_ok=True)

        email_hash = hashlib.sha256(f"{case_number}_{sender_email}_{subject}_{body_text}".encode()).hexdigest()[:12]

        if attachments:
            for att in attachments:
                raw_name = att.get("filename", "evidence_reply.bin")
                content = att.get("content", "")
                raw_bytes = content if isinstance(content, bytes) else str(content).encode("utf-8")
                att_hash = hashlib.sha256(raw_bytes).hexdigest()[:10]
                safe_fname = f"{att_hash}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', raw_name)}"
                fpath = os.path.join(CYBERPROJ_DATA, safe_fname)

                # Write to local cache only if not already existing
                if not os.path.exists(fpath):
                    mode = "wb" if isinstance(content, bytes) else "w"
                    encoding = None if isinstance(content, bytes) else "utf-8"
                    try:
                        with open(fpath, mode, encoding=encoding) as f:
                            f.write(content)
                    except Exception as e:
                        logger.warning(f"Failed to save evidence attachment {safe_fname}: {e}")

                # Upload to Supabase with x-upsert (prevents duplicate storage consumption)
                try:
                    cloud_res = upload_to_supabase_storage(raw_bytes, f"evidence/{case_number}/{safe_fname}")
                    att["storage_url"] = cloud_res.get("storage_url")
                    att["sha256"] = cloud_res.get("sha256")
                except Exception as e:
                    logger.warning(f"Failed cloud upload for {safe_fname}: {e}")

                att["file_path"] = fpath
                att["filename"] = safe_fname
        elif body_text:
            fname = f"reply_{email_hash}.txt"
            fpath = os.path.join(CYBERPROJ_DATA, fname)
            if not os.path.exists(fpath):
                try:
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(body_text)
                except Exception as e:
                    logger.warning(f"Failed to save body text evidence: {e}")

            attachments.append({
                "filename": fname,
                "content": body_text,
                "format": "text",
                "file_path": fpath,
                "sha256": email_hash
            })

        if self.on_reply_received_callback:
            self.on_reply_received_callback(case_number, sender_email, subject, body_text, attachments)

        return {
            "id": f"REPLY-{email_hash}",
            "case_number": case_number,
            "sender": sender_email,
            "sender_email": sender_email,
            "subject": subject,
            "body_text": body_text,
            "body": body_text,
            "attachments": attachments,
            "attachments_count": len(attachments),
            "sha256": email_hash
        }

    def extract_case_reference(self, subject: str, body: str) -> Optional[str]:
        """
        Extracts `[CrimeOS-REF: <case_number>]`, `CR-XXXX-XXXX`, or `FIR-<number>` pattern.
        """
        combined = subject + " " + body
        # Priority 1: Official CrimeOS Token
        match = re.search(r'\[CrimeOS-REF:\s*([A-Za-z0-9_\-]+)\]', combined, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Priority 2: Standard Case Number Pattern (e.g., CR-2026-9914)
        match_cr = re.search(r'\b(CR-\d{4}-\d{4,6})\b', combined, re.IGNORECASE)
        if match_cr:
            return match_cr.group(1).strip().upper()

        # Priority 3: Generic FIR Pattern
        match_fir = re.search(r'\b(FIR-[A-Za-z0-9_\-]+)\b', combined, re.IGNORECASE)
        if match_fir:
            return match_fir.group(1).strip().upper()

        return None

    def _decode_header_full(self, header_val: Optional[str]) -> str:
        if not header_val:
            return ""
        parts = []
        try:
            for bytes_or_str, encoding in decode_header(header_val):
                if isinstance(bytes_or_str, bytes):
                    parts.append(bytes_or_str.decode(encoding or 'utf-8', errors='ignore'))
                else:
                    parts.append(str(bytes_or_str))
        except Exception:
            return str(header_val)
        res = "".join(parts)
        return " ".join(res.split())

    def _poll_real_imap(self, target_case_number: Optional[str] = None) -> List[Dict[str, Any]]:
        """IMAP inbox fetch for live production server with fast RFC3501 range fetch."""
        processed = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.sock.settimeout(20)
            mail.login(self.username, self.password)
            mail.select("inbox")

            status, search_data = mail.search(None, 'ALL')
            if status != 'OK' or not search_data[0]:
                mail.logout()
                return processed

            all_ids = search_data[0].split()
            recent_ids = all_ids[-30:]  # Inspect up to 30 most recent messages

            if not recent_ids:
                mail.logout()
                return processed

            range_str = f"{recent_ids[0].decode()}:{recent_ids[-1].decode()}".encode()
            status, fetch_data = mail.fetch(range_str, '(RFC822)')
            if status != 'OK' or not fetch_data:
                mail.logout()
                return processed

            for item in fetch_data:
                if not isinstance(item, tuple) or len(item) < 2:
                    continue

                raw_email = item[1]
                msg = email.message_from_bytes(raw_email)

                subject = self._decode_header_full(msg.get("Subject", ""))
                sender = self._decode_header_full(msg.get("From", ""))

                body = ""
                attachments = []

                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        disp = str(part.get("Content-Disposition"))
                        filename = part.get_filename()
                        if filename:
                            filename = self._decode_header_full(filename)

                        if content_type == "text/plain" and "attachment" not in disp:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body += payload.decode('utf-8', errors='ignore')
                        elif filename or "attachment" in disp:
                            fname = filename or "attachment.bin"
                            payload = part.get_payload(decode=True)
                            content = payload.decode('utf-8', errors='ignore') if payload else ""
                            attachments.append({
                                "filename": fname,
                                "content": content,
                                "format": "csv" if fname.endswith(".csv") else ("pdf" if fname.endswith(".pdf") else "text")
                            })
                else:
                    payload = msg.get_payload(decode=True)
                    body = payload.decode('utf-8', errors='ignore') if payload else ""

                mail_item = {
                    "sender_email": sender,
                    "subject": subject,
                    "body_text": body,
                    "attachments": attachments,
                    "processed": False
                }
                res = self._process_single_mail(mail_item, target_case_number=target_case_number)
                if res:
                    processed.append(res)

            mail.logout()
        except Exception as e:
            logger.error(f"Error connecting to IMAP server: {e}")

        return processed
