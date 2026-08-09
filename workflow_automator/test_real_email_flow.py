#!/usr/bin/env python3
"""
REAL-TIME EMAIL SENDING & IMAP INBOX MONITORING TEST SCRIPT
CrimeOS / E-Rakshak Workflow Automator Agent

Tests live real-time SMTP dispatch and live IMAP inbox monitoring for provider responses.
"""

import os
import sys
import time
import datetime
from typing import Dict, Any

# Ensure parent path imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflow_automator import MasterWorkflowAutomatorAgent, InboxMonitorAgent, SMTPMailer

def test_real_time_email_flow():
    print("\n" + "═"*85)
    print(" 📧 CRIME OS - REAL-TIME EMAIL DISPATCH & IMAP INBOX MONITORING TEST")
    print("═"*85)

    # 1. Load Environment Configuration
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    sender_email = os.environ.get("SENDER_EMAIL")
    sender_password = os.environ.get("SENDER_PASSWORD") or os.environ.get("IMAP_PASSWORD")
    imap_host = os.environ.get("IMAP_HOST", "imap.gmail.com")

    print(f"📌 [Email Configuration Status]:")
    print(f"   • SMTP Server: {smtp_server}:{smtp_port}")
    print(f"   • Sender/Monitor Email: {sender_email or 'NOT CONFIGURED (Will run in simulation mode)'}")
    print(f"   • IMAP Host: {imap_host}")

    # Initialize Master Workflow Agent & Inbox Monitor Agent
    master_agent = MasterWorkflowAutomatorAgent()
    
    inbox_monitor = InboxMonitorAgent(
        imap_host=imap_host,
        username=sender_email,
        password=sender_password,
        on_reply_received_callback=master_agent.handle_async_incoming_reply
    )

    case_id = f"FIR-TEST-{int(time.time())}"
    target_recipient = sender_email or "officer.cyber@police.gov.in"

    print("\n" + "▶"*3 + f" STEP 1: DISPATCHING INITIAL REAL STATUTORY NOTICE FOR CASE {case_id}")
    notice_res = master_agent.dispatch_investigation_notice(
        case_number=case_id,
        investigation_objective="Urgent Debit Freeze Order for Cyber Fraud Mule Account 501004928172",
        receiver_name="HDFC Bank Nodal Compliance Cell",
        receiver_email=target_recipient,
        receiver_type="bank",
        context_data={
            "account_number": "501004928172",
            "account_holder": "Suspect Cyber Mule Account",
            "entity_name": "HDFC Bank Compliance Division",
            "investigating_officer": "PSI Inspector V. K. Patel",
            "police_station": "Surat Cyber Crime Police Station"
        }
    )

    print(f"✅ Initial Notice Status: '{notice_res.get('status')}'")
    print(f"   Notice Subject: '{notice_res.get('notice_subject')}'")
    print(f"   Notice Sent To: '{notice_res.get('receiver', {}).get('email')}'")

    print("\n" + "▶"*3 + " STEP 2: POLLING INBOX FOR INCOMING PROVIDER REPLIES...")
    print("   (Send a reply to the email with subject tag [CrimeOS-REF: " + case_id + "])")
    print("   Waiting 5 seconds for incoming email check...\n")
    time.sleep(5)

    # Perform IMAP check / Simulated queue check
    replies = inbox_monitor.check_inbox_once(target_case_number=case_id)

    if not replies:
        print("ℹ️ No live email reply detected yet on IMAP server.")
        print("⚡ Simulating incoming partial reply with valid accounts & missing ledger...\n")

        # Simulate incoming reply containing partial valid data
        simulated_reply = inbox_monitor.simulate_receive_reply(
            sender_email=target_recipient,
            subject=f"RE: Freeze Order Compliance [CrimeOS-REF: {case_id}]",
            body_text=f"We acknowledge receipt. Suspect Mule Account 501004928172 and secondary account 918293847123 have been placed on freeze. Itemized transaction ledger is incomplete.",
            attachment_filename="partial_account_summary.txt",
            attachment_content=f"Account: 501004928172\nSecondary Account: 918293847123\nStatus: Partial Ledger Provided",
            case_number=case_id
        )
        replies = [simulated_reply]

    print("\n" + "▶"*3 + " STEP 3: EVALUATING PROCESSED CASE STATE AFTER INBOX MONITORING")
    case_state = master_agent.pending_cases.get(case_id, {})
    print(f"📂 Case Reference: {case_id}")
    print(f"   Status: '{case_state.get('status')}'")
    print(f"   Valid Data Stored in Database: {case_state.get('gathered_valid_entities')}")
    print(f"   Follow-Back Notice Dispatched: {case_state.get('followback_subject') is not None}")

    print("\n" + "═"*85)
    print(" ✅ REAL-TIME EMAIL DISPATCH & INBOX MONITORING TEST COMPLETE")
    print("═"*85 + "\n")

if __name__ == "__main__":
    test_real_time_email_flow()
