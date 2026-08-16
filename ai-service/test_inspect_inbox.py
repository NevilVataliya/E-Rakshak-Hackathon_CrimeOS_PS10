import os
import sys
import email
import imaplib
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, '.')

from app.workflow_automator.inbox_monitor import InboxMonitorAgent

user = os.environ.get("IMAP_USERNAME") or os.environ.get("SMTP_USER") or os.environ.get("SENDER_EMAIL")
pwd = os.environ.get("IMAP_PASSWORD") or os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD")
host = os.environ.get("IMAP_HOST", "imap.gmail.com")
port = int(os.environ.get("IMAP_PORT", 993))

print(f"Connecting to IMAP {host}:{port} as {user}...")
if not user or not pwd:
    print("ERROR: Missing credentials")
    sys.exit(1)

mail = imaplib.IMAP4_SSL(host, port)
mail.login(user, pwd)
mail.select("inbox")

status, search_data = mail.search(None, 'ALL')
all_ids = search_data[0].split()
print(f"Total inbox messages: {len(all_ids)}")

recent_ids = all_ids[-10:]
for msg_id in reversed(recent_ids):
    status, fetch_data = mail.fetch(msg_id, '(RFC822)')
    if not fetch_data or not isinstance(fetch_data[0], tuple):
        continue
    raw = fetch_data[0][1]
    msg = email.message_from_bytes(raw)
    subject = msg.get("Subject", "")
    sender = msg.get("From", "")
    date = msg.get("Date", "")
    print(f"\n--- Message ID {msg_id.decode()} ---")
    print(f"Date: {date}")
    print(f"From: {sender}")
    print(f"Subject: {subject}")
    print(f"Is Multipart: {msg.is_multipart()}")

    part_count = 0
    for part in msg.walk():
        part_count += 1
        ctype = part.get_content_type()
        cdisp = str(part.get("Content-Disposition") or "")
        fname = part.get_filename() or part.get_param("name")
        payload = part.get_payload(decode=True)
        plen = len(payload) if payload else 0
        print(f"  Part #{part_count}: Content-Type='{ctype}', Filename='{fname}', Disposition='{cdisp}', PayloadBytes={plen}")

mail.logout()

print("\n\nNow running InboxMonitorAgent.check_inbox_once()...")
agent = InboxMonitorAgent(imap_host=host, imap_port=port, username=user, password=pwd)
results = agent.check_inbox_once()
print(f"check_inbox_once() returned {len(results)} items:")
for idx, r in enumerate(results):
    print(f"\nResult #{idx+1}:")
    print(f"  Case: {r.get('case_number')}")
    print(f"  From: {r.get('sender_email')}")
    print(f"  Subject: {r.get('subject')}")
    print(f"  Body (first 100 chars): {repr(r.get('body_text', '')[:100])}")
    print(f"  Attachments count: {len(r.get('attachments', []))}")
    for a in r.get('attachments', []):
        print(f"    - Attachment: filename='{a.get('filename')}', format='{a.get('format')}', size={a.get('size_bytes')}, storage_url='{a.get('storage_url')}'")
