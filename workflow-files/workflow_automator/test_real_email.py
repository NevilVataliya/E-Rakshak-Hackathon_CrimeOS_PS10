#!/usr/bin/env python3
"""
LIVE EMAIL TESTING SCRIPT for CrimeOS Workflow Automator & Inbox Monitor (smtplib)

This script tests sending real emails via Python native smtplib and 
polling your real inbox via IMAP for incoming replies.

SETUP REQUIRED IN .env FILE:
---------------------------
# 1. SMTP Email Sending Credentials (Gmail / Custom SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SENDER_EMAIL="your_email@gmail.com"
SMTP_PASSWORD="your_16_character_app_password"
SENDER_NAME="Cyber Crime Investigation Cell"

# 2. IMAP Inbox Reading Credentials (Gmail / Outlook)
IMAP_HOST="imap.gmail.com"
IMAP_PORT=993
IMAP_USERNAME="your_email@gmail.com"
IMAP_PASSWORD="your_16_character_app_password"
"""

import os
import sys
import time
from dotenv import load_dotenv

# Ensure local imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflow_automator import MasterWorkflowAutomatorAgent, InboxMonitorAgent, SMTPMailer

def main():
    load_dotenv()

    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    sender_email = os.environ.get("SENDER_EMAIL")
    smtp_password = os.environ.get("SMTP_PASSWORD") or os.environ.get("EMAIL_PASSWORD") or os.environ.get("IMAP_PASSWORD")
    imap_username = os.environ.get("IMAP_USERNAME", sender_email)
    imap_password = os.environ.get("IMAP_PASSWORD", smtp_password)

    print("\n" + "="*80)
    print(" 📧 REAL EMAIL WORKFLOW AUTOMATOR (smtplib) & INBOX MONITOR LIVE TEST")
    print("="*80)

    # Check credentials
    if not smtp_password:
        print("\n⚠️ WARNING: SMTP_PASSWORD is missing in .env!")
        print("   For Gmail, generate an App Password at: https://myaccount.google.com/apppasswords")
        print("   and update your .env file:\n   SMTP_PASSWORD='xxxx xxxx xxxx xxxx'")
        print("\n   The mailer will run in SIMULATION mode for now.\n")

    if not imap_password:
        print("\n⚠️ WARNING: IMAP_PASSWORD is missing in .env!")
        print("   To poll your real inbox for replies, set IMAP_PASSWORD in your .env file.\n")

    # Prompt user for target test email address if not specified
    target_recipient_email = input(f"Enter recipient email to send real test notice to (default: {sender_email or 'test@example.com'}): ").strip()
    if not target_recipient_email:
        target_recipient_email = sender_email or "test@example.com"

    case_num = f"FIR-TEST-{int(time.time()) % 10000}"

    print(f"\n[1] Initializing Master Automator Agent & Native smtplib Mailer...")
    mailer = SMTPMailer(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_username=sender_email,
        smtp_password=smtp_password,
        sender_email=sender_email,
        sender_name=os.environ.get("SENDER_NAME", "Cyber Crime Investigation Cell"),
        simulation_mode=not bool(smtp_password)
    )

    master_agent = MasterWorkflowAutomatorAgent(smtp_mailer=mailer)

    # Initialize Inbox Monitor
    inbox_monitor = InboxMonitorAgent(
        imap_host=os.environ.get("IMAP_HOST", "imap.gmail.com"),
        imap_port=int(os.environ.get("IMAP_PORT", 993)),
        username=imap_username,
        password=imap_password,
        on_reply_received_callback=master_agent.handle_async_incoming_reply
    )

    print(f"\n[2] Dispatching Real Investigation Notice via smtplib for Case: {case_num}...")
    master_agent.dispatch_investigation_notice(
        case_number=case_num,
        investigation_objective="Notice to Produce Bank Account Records and Statements under Section 94 BNSS",
        receiver_name="Target Test Recipient",
        receiver_email=target_recipient_email,
        receiver_type="bank",
        context_data={
            "details": "Please reply to this email with bank statement CSV or PDF.",
            "deadline": "24 Hours"
        }
    )

    print("\n" + "-"*80)
    print(f"📩 EMAIL DISPATCHED TO: {target_recipient_email}")
    print(f"   Subject contained: [CrimeOS-REF: {case_num}]")
    print("-" * 80)
    print("\n👉 NOW TEST REPLYING:")
    print(f"1. Open your inbox at '{target_recipient_email}'")
    print(f"2. Reply to the email (make sure the subject keeps '[CrimeOS-REF: {case_num}]')")
    print("3. Optionally attach a sample CSV or PDF file.")
    print("\nPress ENTER when you have sent the reply to start checking your real inbox...")
    input()

    print("\n[3] Polling Real IMAP Inbox for incoming replies...")
    max_checks = 5
    found = False

    for attempt in range(1, max_checks + 1):
        print(f"   Checking inbox (Attempt {attempt}/{max_checks})...")
        processed = inbox_monitor.check_inbox_once(target_case_number=case_num)
        if processed:
            found = True
            print(f"\n🎉 Successfully received and processed reply for {case_num}!")
            break
        time.sleep(5)

    if not found:
        print("\n⏳ No reply detected yet. If you replied recently, Gmail IMAP may take a minute to reflect.")
        print("   You can run this polling check again anytime!")

    print("\n" + "="*80)
    print(" ✅ LIVE TESTING SCRIPT COMPLETED")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
