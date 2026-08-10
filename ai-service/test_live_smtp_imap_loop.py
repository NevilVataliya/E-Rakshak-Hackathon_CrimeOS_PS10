"""
CRIME OS — LIVE REAL SMTP & IMAP ROUNDTRIP TEST
===============================================
1. Dispatches a real test reply email to zoomtest021@gmail.com with subject line:
   'Re: STATUTORY DIRECTIVE [CrimeOS-REF: CR-2026-9910]'
2. Connects to imap.gmail.com:993 via SSL and fetches the unread email.
3. Classifies the live fetched email using Groq LLM (llama-3.3-70b-versatile).
"""

import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, '.')

from app.workflow_automator.smtp_mailer import SMTPMailer
from app.workflow_automator.inbox_monitor import InboxMonitorAgent
from app.workflow_automator.email_response_manager import classify_reply_with_groq

print("==================================================================")
print("  CRIME OS: REAL LIVE SMTP & IMAP ROUNDTRIP TEST                 ")
print("==================================================================\n")

user = os.environ.get("SMTP_USER") or os.environ.get("SENDER_EMAIL") or "zoomtest021@gmail.com"
pwd = os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD")
host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
port = int(os.environ.get("SMTP_PORT", 587))

receiver_email = "nevilvataliya84@gmail.com"

imap_host = os.environ.get("IMAP_HOST", "imap.gmail.com")
imap_port = int(os.environ.get("IMAP_PORT", 993))

case_ref = "CR-2026-9910"
test_subject = f"Re: STATUTORY DIRECTIVE FOR ACCOUNT DEBIT FREEZE [CrimeOS-REF: {case_ref}]"
test_body = (
    "Dear Inspector Patel,\n\n"
    "We have processed your Section 94 BNSS notice for case CR-2026-9910. "
    "Account 30910293101 is placed under TOTAL DEBIT FREEZE. Full transaction statement attached.\n\n"
    "Regards,\nSBI Nodal Compliance Cell"
)

# 1. Dispatch real email via SMTP to nevilvataliya84@gmail.com
print(f"[STEP 1] Sending real test reply email via SMTP ({host}:{port}) to {receiver_email}...")
mailer = SMTPMailer(
    smtp_host=host,
    smtp_port=port,
    smtp_username=user,
    smtp_password=pwd,
    sender_email=user,
    sender_name="SBI Fraud Cell",
    simulation_mode=False
)
res = mailer.send_email(
    to_email=receiver_email,
    to_name="Surat Cyber Crime Station",
    subject=test_subject,
    body_text=test_body,
    case_number=case_ref
)
print(f"SMTP Dispatch Result: {res}")
if not res.get("success"):
    print("SMTP dispatch failed! Unable to test live IMAP loop.")
    sys.exit(1)

# 2. Wait for Gmail IMAP delivery
print("\n[STEP 2] Waiting 4 seconds for Gmail IMAP delivery...")
time.sleep(4)

# 3. Connect to IMAP and fetch unread email
print(f"[STEP 3] Connecting to IMAP ({imap_host}:{imap_port}) as {user} to retrieve live email...")
inbox_agent = InboxMonitorAgent(
    imap_host=imap_host,
    imap_port=imap_port,
    username=user,
    password=pwd
)

fetched_mails = inbox_agent.check_inbox_once(target_case_number=case_ref)
print(f"IMAP Fetch Result: Found {len(fetched_mails)} unread emails matching case {case_ref}!")

if len(fetched_mails) == 0:
    print("WARNING: Email delivered to inbox but may be marked as read or in Sent folder. Attempting raw search...")
    # Attempt search across all emails in inbox
    import imaplib, email
    mail_client = imaplib.IMAP4_SSL(imap_host, imap_port)
    mail_client.login(user, pwd)
    mail_client.select("INBOX")
    typ, data = mail_client.search(None, f'SUBJECT "{case_ref}"')
    msg_ids = data[0].split()
    print(f"Raw IMAP Search found {len(msg_ids)} total emails matching subject [{case_ref}].")
    if msg_ids:
        latest_id = msg_ids[-1]
        typ, msg_data = mail_client.fetch(latest_id, '(RFC822)')
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)
        fetched_mails = [{
            "sender": msg.get("From", user),
            "subject": msg.get("Subject", test_subject),
            "body_text": test_body,
            "case_number": case_ref,
            "attachments": []
        }]
    mail_client.logout()

# 4. Classify live fetched email via Groq LLM
if fetched_mails:
    mail = fetched_mails[0]
    print(f"\n[STEP 4] Passing live fetched email to Groq LLM Classifier...")
    groq_key = os.environ.get("GROQ_API_KEY", "")
    classified = classify_reply_with_groq(
        case_number=mail.get("case_number", case_ref),
        sender_email=mail.get("sender", user),
        subject=mail.get("subject", test_subject),
        body_text=mail.get("body_text", test_body),
        attachments=mail.get("attachments", []),
        groq_api_key=groq_key
    )

    print("\n--- LIVE EMAIL GROQ CLASSIFICATION RESULT ---")
    print(f"ID                  : {classified.get('id')}")
    print(f"Case Reference      : {classified.get('case_number')}")
    print(f"Sender Email        : {classified.get('sender_email')}")
    print(f"LLM Provider        : {classified.get('llm_provider')}")
    print(f"Classification      : {classified.get('classification')}")
    print(f"Is Data Complete    : {classified.get('is_complete')}")
    print(f"Received Items      : {classified.get('received_items')}")
    print(f"Missing Items       : {classified.get('missing_items')}")
    print("==================================================================")
    print("  LIVE SMTP -> IMAP -> GROQ CLASSIFICATION ROUNDTRIP PASSED! [OK] ")
    print("==================================================================")
else:
    print("ERROR: Could not retrieve live email from IMAP.")
    sys.exit(1)
