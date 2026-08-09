import os
import re
import email
import imaplib
import logging
import datetime
import tempfile
from email.header import decode_header
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class IMAPEmailFetcher:
    """
    Standard IMAP Email Fetcher for CrimeOS Workflow Automator.
    Uses Python's native `imaplib` and `email` standard libraries.
    Connects to IMAP server, checks incoming emails for case reference tokens
    like `[CrimeOS-REF: CR-2026-XXXX]`, extracts sender, subject, body text,
    and saves MIME attachments for automated forensic analysis.
    """
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_ssl: bool = True
    ):
        self.host = host or os.environ.get("IMAP_HOST") or os.environ.get("SMTP_HOST") or "imap.gmail.com"
        self.port = int(port or os.environ.get("IMAP_PORT", 993))
        
        raw_user = (
            username or 
            os.environ.get("IMAP_USERNAME") or 
            os.environ.get("IMAP_USER") or 
            os.environ.get("SMTP_USERNAME") or 
            os.environ.get("SMTP_USER") or 
            os.environ.get("SENDER_EMAIL") or 
            ""
        )
        self.username = raw_user.strip("'\" \t\r\n") if raw_user else ""

        raw_pwd = (
            password or 
            os.environ.get("IMAP_PASSWORD") or 
            os.environ.get("IMAP_PASS") or 
            os.environ.get("SMTP_PASSWORD") or 
            os.environ.get("SMTP_PASS") or 
            os.environ.get("EMAIL_PASSWORD") or 
            ""
        )
        self.password = raw_pwd.strip("'\" \t\r\n") if raw_pwd else ""
        self.use_ssl = use_ssl

    def _decode_header_str(self, header_val: str) -> str:
        if not header_val:
            return ""
        decoded_list = decode_header(header_val)
        header_text = ""
        for bytes_or_str, encoding in decoded_list:
            if isinstance(bytes_or_str, bytes):
                header_text += bytes_or_str.decode(encoding or "utf-8", errors="ignore")
            else:
                header_text += str(bytes_or_str)
        return header_text

    def fetch_unread_case_replies(self, folder: str = "INBOX", mark_as_read: bool = True) -> List[Dict[str, Any]]:
        """
        Fetches incoming emails from IMAP inbox containing '[CrimeOS-REF: ...]' token.
        Saves attached files (CSV, PDF, XLSX, images) and returns parsed structured data.
        """
        if not self.username or not self.password:
            logger.warning("[IMAPEmailFetcher] IMAP credentials missing. Operating in simulated inbox mode.")
            return []

        messages = []
        try:
            if self.use_ssl:
                mail = imaplib.IMAP4_SSL(self.host, self.port)
            else:
                mail = imaplib.IMAP4(self.host, self.port)

            mail.login(self.username, self.password)
            mail.select(folder)

            # Search for UNSEEN unread emails or SUBJECT "CrimeOS-REF"
            status, response = mail.search(None, '(UNSEEN SUBJECT "CrimeOS-REF")')
            if status != "OK" or not response[0]:
                status, response = mail.search(None, '(SUBJECT "CrimeOS-REF")')

            if status != "OK" or not response[0]:
                mail.logout()
                return []

            email_ids = response[0].split()
            for e_id in email_ids[-10:]:
                res, msg_data = mail.fetch(e_id, '(RFC822)')
                if res != "OK":
                    continue

                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        subject = self._decode_header_str(msg.get("Subject", ""))
                        sender = self._decode_header_str(msg.get("From", ""))

                        match = re.search(r'\[CrimeOS-REF:\s*([A-Za-z0-9_\-/\.]+)\s*\]', subject, re.IGNORECASE)
                        case_number = match.group(1).upper() if match else "CR-2026-UNKNOWN"

                        body_text = ""
                        attachments = []

                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition"))

                                if content_type == "text/plain" and "attachment" not in content_disposition:
                                    payload_bytes = part.get_payload(decode=True)
                                    if payload_bytes:
                                        body_text += payload_bytes.decode("utf-8", errors="ignore") + "\n"

                                elif "attachment" in content_disposition or part.get_filename():
                                    filename = part.get_filename()
                                    if filename:
                                        filename = self._decode_header_str(filename)
                                        att_bytes = part.get_payload(decode=True)
                                        if att_bytes:
                                            evidence_dir = os.path.join(tempfile.gettempdir(), "crimeos_attachments")
                                            os.makedirs(evidence_dir, exist_ok=True)
                                            saved_path = os.path.join(evidence_dir, f"{case_number}_{filename}")
                                            with open(saved_path, "wb") as f:
                                                f.write(att_bytes)

                                            attachments.append({
                                                "filename": filename,
                                                "file_path": saved_path,
                                                "format": "csv" if filename.endswith(".csv") else "pdf" if filename.endswith(".pdf") else "file",
                                                "size_bytes": len(att_bytes)
                                            })
                        else:
                            payload_bytes = msg.get_payload(decode=True)
                            if payload_bytes:
                                body_text = payload_bytes.decode("utf-8", errors="ignore")

                        messages.append({
                            "email_id": e_id.decode('utf-8') if isinstance(e_id, bytes) else str(e_id),
                            "case_number": case_number,
                            "sender_email": sender,
                            "subject": subject,
                            "body_text": body_text.strip(),
                            "attachments": attachments,
                            "received_at": datetime.datetime.now().isoformat()
                        })

                        if mark_as_read:
                            mail.store(e_id, '+FLAGS', '\\Seen')

            mail.logout()
        except Exception as e:
            logger.error(f"[IMAPEmailFetcher Exception]: {e}")

        return messages
