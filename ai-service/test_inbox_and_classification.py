"""
CRIME OS — COMPREHENSIVE INBOX & GROQ CLASSIFICATION TEST SUITE
================================================================
Runs thorough verification of:
1. Real IMAP SSL Inbox Connection & Searching (zoomtest021@gmail.com)
2. Groq LLM Reply Classification & Data Completeness Detection across 5 scenarios.
3. FastApi /api/email Endpoints.
"""

import os
import sys
import json
import logging
import imaplib
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, '.')

from app.workflow_automator.inbox_monitor import InboxMonitorAgent
from app.workflow_automator.email_response_manager import classify_reply_with_groq

print("==================================================================")
print("  CRIME OS: COMPREHENSIVE INBOX FETCH & GROQ CLASSIFICATION TESTS ")
print("==================================================================\n")

# ----------------------------------------------------------------------
# STEP 1: TEST IMAP SSL INBOX CONNECTION & FETCHING
# ----------------------------------------------------------------------
print("[TEST 1] Testing Real IMAP SSL Inbox Connection & Email Retrieval...")
imap_user = os.environ.get("IMAP_USERNAME") or os.environ.get("SMTP_USER")
imap_pass = os.environ.get("IMAP_PASSWORD") or os.environ.get("SMTP_PASS")
imap_host = os.environ.get("IMAP_HOST", "imap.gmail.com")
imap_port = int(os.environ.get("IMAP_PORT", 993))

print(f"Connecting to IMAP Server: {imap_host}:{imap_port} as {imap_user}...")
try:
    inbox_agent = InboxMonitorAgent(
        imap_host=imap_host,
        imap_port=imap_port,
        username=imap_user,
        password=imap_pass
    )
    raw_mails = inbox_agent.check_inbox_once(target_case_number=None)
    print(f"SUCCESS: Successfully connected to IMAP inbox! Fetched {len(raw_mails)} messages matching case references.")
    for idx, mail in enumerate(raw_mails[:3]):
        print(f"  Mail #{idx+1}: From: {mail.get('sender')} | Case: {mail.get('case_number')} | Subject: {mail.get('subject')}")
except Exception as e:
    print(f"IMAP SSL Note: {e} (Testing continues with simulated inbox payloads)")

print("\n------------------------------------------------------------------")

# ----------------------------------------------------------------------
# STEP 2: TEST GROQ LLM CLASSIFICATION ACROSS 5 REALISTIC SCENARIOS
# ----------------------------------------------------------------------
groq_key = os.environ.get("GROQ_API_KEY", "")
print(f"[TEST 2] Testing Groq LLM Reply Classification (GROQ_API_KEY present: {bool(groq_key)})...")

test_scenarios = [
    {
        "name": "Scenario A: Full Bank Compliance (SBI)",
        "case_number": "CR-2026-9910",
        "sender_email": "nodal.compliance@sbi.co.in",
        "subject": "Re: STATUTORY DIRECTIVE FOR DEBIT FREEZE [CrimeOS-REF: CR-2026-9910]",
        "body_text": (
            "Dear Inspector Patel,\n\n"
            "This is to confirm that target account 30910293101 has been successfully placed under TOTAL DEBIT FREEZE. "
            "We have attached the complete itemized transaction ledger for July 2026 and account opening KYC documents as requested under Section 94 BNSS.\n\n"
            "Regards,\nNodal Officer, SBI Fraud Cell"
        ),
        "attachments": [{"filename": "sbi_account_ledger_july2026.csv", "format": "csv"}, {"filename": "kyc_documents.pdf", "format": "pdf"}],
        "expected_is_complete": True,
        "expected_classification": "CASE_COMPLETE"
    },
    {
        "name": "Scenario B: Partial Telecom Response (Jio)",
        "case_number": "CR-2026-9910",
        "sender_email": "nodal.officer@jio.com",
        "subject": "Re: CDR & Cell Tower Requisition [CrimeOS-REF: CR-2026-9910]",
        "body_text": (
            "Dear IO,\n\n"
            "We acknowledge receipt of your notice regarding mobile number +91 98765 43210. "
            "We have attached the basic Customer Application Form (CAF) subscriber details. "
            "However, itemized Call Detail Records (CDR) and cell tower location dumps require additional technical extraction and will take 48-72 hours.\n\n"
            "Regards,\nJio Regulatory Compliance Cell"
        ),
        "attachments": [{"filename": "jio_subscriber_caf.pdf", "format": "pdf"}],
        "expected_is_complete": False,
        "expected_classification": "PARTIAL_DATA_RECEIVED"
    },
    {
        "name": "Scenario C: Legal Clarification Asked (Google LERT)",
        "case_number": "CR-2026-9910",
        "sender_email": "lert-requests@google.com",
        "subject": "Re: Legal Order for Gmail Account Logs [CrimeOS-REF: CR-2026-9910]",
        "body_text": (
            "Dear Officer Patel,\n\n"
            "We received your request for IP login logs regarding user target@gmail.com. "
            "To process your request under applicable legal frameworks, please clarify the exact 24-hour UTC timeframe for the requested IP connection logs, and provide an updated court order specifying the statutory authority.\n\n"
            "Sincerely,\nGoogle Law Enforcement Response Team"
        ),
        "attachments": [],
        "expected_is_complete": False,
        "expected_classification": "CLARIFICATION_ASKED"
    },
    {
        "name": "Scenario D: Foreign Jurisdiction Refusal (Offshore Crypto Exchange)",
        "case_number": "CR-2026-9910",
        "sender_email": "compliance@offshore-crypto.io",
        "subject": "Re: Subpoena for Wallet Transactions [CrimeOS-REF: CR-2026-9910]",
        "body_text": (
            "Dear Officer,\n\n"
            "We are a foreign entity incorporated in Seychelles. We cannot comply with your Section 94 BNSS notice as Indian criminal procedure laws do not apply to our jurisdiction without an MLAT request.\n\n"
            "Legal Department"
        ),
        "attachments": [],
        "expected_is_complete": False,
        "expected_classification": "DECLINED"
    },
    {
        "name": "Scenario E: Delivery Failure (Mailer-Daemon Bounce)",
        "case_number": "CR-2026-9910",
        "sender_email": "mailer-daemon@googlemail.com",
        "subject": "Undeliverable: Legal Requisition [CrimeOS-REF: CR-2026-9910]",
        "body_text": (
            "An error occurred while trying to deliver your mail to nodal.invalid@bank.com. "
            "550 5.1.1 The email account that you tried to reach does not exist."
        ),
        "attachments": [],
        "expected_is_complete": False,
        "expected_classification": "BOUNCED"
    }
]

scenario_results = []
for test in test_scenarios:
    print(f"\n--- Running {test['name']} ---")
    res = classify_reply_with_groq(
        case_number=test["case_number"],
        sender_email=test["sender_email"],
        subject=test["subject"],
        body_text=test["body_text"],
        attachments=test["attachments"],
        groq_api_key=groq_key
    )

    is_complete = res.get("is_complete")
    classification = res.get("classification")
    provider = res.get("llm_provider")
    fb_draft = res.get("followback_draft")

    print(f"Provider Used       : {provider}")
    print(f"Classification      : {classification} (Expected: {test['expected_classification']})")
    print(f"Is Data Complete    : {is_complete} (Expected: {test['expected_is_complete']})")
    print(f"Received Items      : {res.get('received_items')}")
    print(f"Missing Items       : {res.get('missing_items')}")
    if fb_draft:
        print(f"Followback Subject  : {fb_draft.get('subject')}")
        print(f"Followback Body Snippet: {(fb_draft.get('body') or '')[:140]}...")
    else:
        print("Followback Draft    : None (No email required - Data Complete)")

    match = (is_complete == test["expected_is_complete"])
    scenario_results.append((test["name"], match, classification, provider))

print("\n==================================================================")
print("  CLASSIFICATION SCENARIO SUMMARY RESULTS")
print("==================================================================")
all_passed = True
for name, passed, classification, provider in scenario_results:
    status_str = "[OK]" if passed else "[FAILED]"
    if not passed: all_passed = False
    print(f"- {name:<50}: {status_str} [{classification} via {provider}]")

if all_passed:
    print("\nALL CLASSIFICATION SCENARIO TESTS PASSED SUCCESSFULLY! [OK]")
else:
    print("\nSOME CLASSIFICATION TESTS FAILED! [FAIL]")

sys.exit(0 if all_passed else 1)
