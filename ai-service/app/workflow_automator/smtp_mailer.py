import os
import smtplib
import logging
import datetime
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class SMTPMailer:
    """
    Standard SMTP Email Sender for CrimeOS Law Enforcement Automated Workflows.
    Uses Python's native `smtplib` and `email.mime` standard libraries.
    Supports STARTTLS (587), SSL (465), custom headers, HTML/plain text, attachments,
    and a robust offline simulation mode.
    """
    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        sender_email: Optional[str] = None,
        sender_name: Optional[str] = None,
        use_tls: bool = True,
        simulation_mode: bool = False
    ):
        self.smtp_host = smtp_host or os.environ.get("SMTP_HOST", os.environ.get("SMTP_SERVER", os.environ.get("EMAIL_HOST", "smtp.gmail.com")))
        self.smtp_port = int(smtp_port or os.environ.get("SMTP_PORT", os.environ.get("EMAIL_PORT", 587)))
        self.smtp_username = smtp_username or os.environ.get("SMTP_USER", os.environ.get("SMTP_USERNAME", os.environ.get("SENDER_EMAIL")))
        
        raw_pwd = smtp_password or os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD") or os.environ.get("EMAIL_PASSWORD") or os.environ.get("IMAP_PASSWORD")
        self.smtp_password = raw_pwd.strip("'\" \t\r\n") if raw_pwd else None

        self.sender_email = sender_email or os.environ.get("SMTP_FROM", os.environ.get("SENDER_EMAIL", self.smtp_username or "crimeos.police@gmail.com"))
        self.sender_name = sender_name or os.environ.get("SENDER_NAME", "Cyber Crime Investigation Cell")
        self.use_tls = use_tls

        # Fallback to simulation mode only if no password is provided in environment or args
        self.simulation_mode = simulation_mode or not bool(self.smtp_password)

    def send_email(
        self,
        to_email: str,
        to_name: str = "",
        subject: str = "",
        body_text: str = "",
        body_html: Optional[str] = None,
        case_number: Optional[str] = None,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Dispatches transactional email to receiver via native smtplib or Simulation.
        """
        timestamp = datetime.datetime.now().isoformat()
        message_id = f"<crimeos-{uuid.uuid4().hex[:12]}@police.gov.in>"

        if not body_html:
            body_html = self._wrap_html(body_text, subject, case_number)

        # Target Email Override for Testing Mode
        override_email = os.environ.get("OVERRIDE_RECIPIENT_EMAIL") or os.environ.get("TEST_RECIPIENT_EMAIL") or os.environ.get("TEST_EMAIL")
        actual_to_email = override_email.strip() if override_email and override_email.strip() else to_email
        if override_email and override_email.strip() and override_email.strip() != to_email:
            logger.info(f"[SMTPMailer TEST OVERRIDE] Redirecting email intended for {to_email} to {actual_to_email}")

        if not self.smtp_username or not self.smtp_password:
            err_text = "Real SMTP credentials missing. Please set SMTP User and Password (or Gmail App Password) in SMTP Settings."
            logger.error(f"[SMTPMailer] {err_text}")
            return {
                "success": False,
                "status": "Failed - SMTP Credentials Missing",
                "message_id": message_id,
                "timestamp": timestamp,
                "recipient": {"email": actual_to_email, "intended_email": to_email, "name": to_name},
                "simulation": False,
                "error": err_text
            }

        # Construct MIME Message using Python smtplib standard structures
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{self.sender_name} <{self.sender_email}>"
        msg["To"] = f"{to_name} <{actual_to_email}>" if to_name else actual_to_email
        msg["Subject"] = subject
        msg["Message-ID"] = message_id
        if case_number:
            msg["X-CrimeOS-CaseNumber"] = case_number
        msg["X-CrimeOS-Department"] = "Cyber Crime Investigation Cell"

        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        if attachments:
            for att in attachments:
                filename = att.get("filename", "attachment.bin")
                content = att.get("content", b"")
                if isinstance(content, str):
                    content = content.encode("utf-8")
                
                part = MIMEBase("application", "octet-stream")
                part.set_payload(content)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", f"attachment; filename={filename}")
                msg.attach(part)

        try:
            logger.info(f"[SMTPMailer] Connecting to SMTP server {self.smtp_host}:{self.smtp_port}...")
            
            if self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=15)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15)
                if self.use_tls:
                    server.starttls()
            
            server.login(self.smtp_username, self.smtp_password)
            server.sendmail(self.sender_email, [actual_to_email], msg.as_string())
            server.quit()

            logger.info(f"[SMTPMailer] Successfully sent email to {actual_to_email}. Message ID: {message_id}")
            print(f"[SMTP SUCCESS] Email delivered via smtplib to {actual_to_email} (Intended: {to_email}, Case: {case_number})")

            return {
                "success": True,
                "status": "Sent via smtplib",
                "message_id": message_id,
                "timestamp": timestamp,
                "recipient": {"email": actual_to_email, "intended_email": to_email, "name": to_name},
                "simulation": False,
                "error": None
            }

        except Exception as e:
            err_msg = f"smtplib Dispatch Error: {str(e)}"
            logger.exception(err_msg)
            print(f"[SMTP ERROR] {err_msg}. Falling back to simulation record.")

            return {
                "success": False,
                "status": "SMTP Failed - Fallback Simulated",
                "message_id": message_id,
                "timestamp": timestamp,
                "recipient": {"email": to_email, "name": to_name},
                "simulation": True,
                "error": str(e)
            }

    def _wrap_html(self, text: str, subject: str, case_number: Optional[str]) -> str:
        paragraphs = "".join([f"<p style='margin-bottom: 12px; line-height: 1.6;'>{p.strip()}</p>" for p in text.split("\n\n") if p.strip()])
        return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b;">
    <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #0f172a; color: #ffffff; padding: 20px 24px; border-bottom: 3px solid #0284c7;">
            <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">POLICE INVESTIGATION WORKFLOW DIRECTIVE</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Case File Ref: {case_number or 'CONFIDENTIAL'}</p>
        </div>
        <div style="padding: 28px 24px;">
            {paragraphs}
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
            <p style="margin: 0;"><strong>Official Notice:</strong> This email contains statutory communication from CrimeOS Cyber Investigation System. Retain this notice for legal reference.</p>
        </div>
    </div>
</body>
</html>"""
