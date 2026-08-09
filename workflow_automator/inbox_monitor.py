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
        self.imap_host = imap_host or os.environ.get("IMAP_HOST", "imap.gmail.com")
        self.imap_port = int(os.environ.get("IMAP_PORT", imap_port))
        self.username = username or os.environ.get("IMAP_USERNAME", os.environ.get("SENDER_EMAIL"))
        self.password = password or os.environ.get("IMAP_PASSWORD")
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
        print(f"\n📩 [INBOX MONITOR AGENT] New Incoming Email Detected!")
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

        # 2. Try real IMAP polling if username/password configured
        if self.username and self.password and self.imap_host:
            try:
                imap_results = self._poll_real_imap(target_case_number=target_case_number)
                processed_list.extend(imap_results)
            except Exception as e:
                logger.warning(f"IMAP Polling warning: {e}")

        return processed_list

    def _process_single_mail(self, mail_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        sender_email = mail_item["sender_email"]
        subject = mail_item["subject"]
        body_text = mail_item["body_text"]
        attachments = mail_item.get("attachments", [])

        # Extract Case Ref ID from Subject or Body
        case_number = self.extract_case_reference(subject, body_text)
        if not case_number:
            print(f"   ⚠️ [Inbox Monitor] Email from {sender_email} has no valid Case Reference tag [CrimeOS-REF: XXX]. Ignoring non-case email.")
            mail_item["processed"] = True
            return None

        print(f"   ✅ [Inbox Monitor] Matched Case Reference: '{case_number}'")
        mail_item["processed"] = True

        # Save attachment / body to cyberproj data/evidence directory using cyberproj_resolver
        from .cyberproj_resolver import get_cyberproj_services
        cyberproj_svcs = get_cyberproj_services()
        cyberproj_path = cyberproj_svcs.get("cyberproj_path") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        CYBERPROJ_DATA = os.path.join(cyberproj_path, "data", "evidence", case_number)
        os.makedirs(CYBERPROJ_DATA, exist_ok=True)

        if attachments:
            for att in attachments:
                fname = att.get("filename", "evidence_reply.txt")
                fpath = os.path.join(CYBERPROJ_DATA, fname)
                content = att.get("content", "")
                mode = "wb" if isinstance(content, bytes) else "w"
                encoding = None if isinstance(content, bytes) else "utf-8"
                try:
                    with open(fpath, mode, encoding=encoding) as f:
                        f.write(content)
                    att["file_path"] = fpath
                except Exception as e:
                    logger.warning(f"Failed to save evidence attachment {fname}: {e}")
        elif body_text:
            fname = f"reply_{int(time.time())}.txt"
            fpath = os.path.join(CYBERPROJ_DATA, fname)
            try:
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(body_text)
                attachments.append({
                    "filename": fname,
                    "content": body_text,
                    "format": "text",
                    "file_path": fpath
                })
            except Exception as e:
                logger.warning(f"Failed to save body text evidence: {e}")

        if self.on_reply_received_callback:
            self.on_reply_received_callback(case_number, sender_email, subject, body_text, attachments)

        return {
            "case_number": case_number,
            "sender": sender_email,
            "subject": subject,
            "attachments_count": len(attachments)
        }

    def extract_case_reference(self, subject: str, body: str) -> Optional[str]:
        """
        Extracts `[CrimeOS-REF: <case_number>]` or `FIR-<number>` pattern.
        """
        # Priority 1: Official CrimeOS Token
        match = re.search(r'\[CrimeOS-REF:\s*([A-Za-z0-9_\-]+)\]', subject + " " + body, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Priority 2: Generic FIR Pattern
        match_fir = re.search(r'\b(FIR-[A-Za-z0-9_\-]+)\b', subject + " " + body)
        if match_fir:
            return match_fir.group(1).strip()

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
        return "".join(parts)

    def _poll_real_imap(self, target_case_number: Optional[str] = None) -> List[Dict[str, Any]]:
        """IMAP inbox fetch for live production server."""
        processed = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
            mail.login(self.username, self.password)
            mail.select("inbox")

            search_queries = []
            if target_case_number:
                search_queries.append(f'SUBJECT "{target_case_number}"')
                search_queries.append(f'BODY "{target_case_number}"')
            search_queries.append('SUBJECT "CrimeOS-REF"')

            mail_ids = []
            for query in search_queries:
                status, data = mail.search(None, query)
                if status == 'OK' and data[0]:
                    for num in data[0].split():
                        if num not in mail_ids:
                            mail_ids.append(num)

            # Fallback to UNSEEN if no specific query matched
            if not mail_ids:
                status, data = mail.search(None, 'UNSEEN')
                if status == 'OK' and data[0]:
                    mail_ids = data[0].split()

            for num in mail_ids:
                status, data = mail.fetch(num, '(RFC822)')
                if status != 'OK':
                    continue

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Decode subject cleanly
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
                            fname = filename or f"attachment_{num.decode() if isinstance(num, bytes) else num}.bin"
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
                res = self._process_single_mail(mail_item)
                if res:
                    processed.append(res)

            mail.logout()
        except Exception as e:
            logger.error(f"Error connecting to IMAP server: {e}")

        return processed
