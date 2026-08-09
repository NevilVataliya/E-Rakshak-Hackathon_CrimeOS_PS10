#!/usr/bin/env python3
"""
End-to-End Test & Demonstration Script for Workflow Automator Agent & Evaluator Pipeline.
Simulates a high-value Money Laundering & Bank Cyber Fraud Investigation:
1. Ingests Evaluator Agent output payload (Case metadata + Evaluated Target Entities).
2. Auto-registers Case in cyberproj persistent case_manager (cases.json).
3. Automated Legal Notice Generation & Email Dispatch via SMTPMailer.
4. Asynchronous Inbox Monitoring & Evidence Ingestion (Bank Record CSV & CDR CSVs).
5. Domain Parsing via cyberproj bank_parser & cdr_parser.
6. Secondary Suspect Entity Extraction & Auto-Target Addition.
7. Automated Gemini AI Evidence Correlation & Summary Generation.
"""

import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        safe_args = []
        for a in args:
            if isinstance(a, str):
                safe_args.append(a.encode("ascii", errors="replace").decode("ascii"))
            else:
                safe_args.append(a)
        print(*safe_args, **kwargs)

# Ensure local imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workflow_automator import MasterWorkflowAutomatorAgent, InboxMonitorAgent

def run_evaluator_automated_pipeline_demo():
    safe_print("\n" + "═"*85)
    safe_print(" 🚀 CRIME OS / E-RAKSHAK - 5 CRIME DOMAINS DYNAMIC NOTICE & EMAIL AUTOMATION DEMO")
    safe_print("═"*85)

    master_agent = MasterWorkflowAutomatorAgent()

    inbox_monitor = InboxMonitorAgent(
        on_reply_received_callback=master_agent.handle_async_incoming_reply
    )

    # =========================================================================
    # PHASE 0: DYNAMIC NOTICE GENERATION ACROSS ALL 5 CRIME DOMAINS
    # =========================================================================
    safe_print("\n" + "▶"*3 + " PHASE 0: DYNAMIC TEMPLATE SELECTION & NODAL EMAIL LOOKUP ACROSS 5 DOMAINS")
    domains = master_agent.template_engine.list_domains()
    safe_print(f"📌 [Loaded Crime Domains]: {len(domains)} Domains Registered in JSON Directory")
    for code, info in domains.items():
        safe_print(f"   • [{info.get('name')}] ({code})")

    # Demonstrate dynamic notice generation for each of the 5 domains
    demo_cases = [
        {
            "domain": "financial_fraud",
            "objective": "Urgent Financial Freeze Order for Cyber Fraud Mule Account",
            "receiver": "HDFC",
            "case": "FIR-FIN-2026-101"
        },
        {
            "domain": "cyber_crime",
            "objective": "Requisition for Cyber Forensic IP Connection Logs and Metadata",
            "receiver": "Google",
            "case": "FIR-CYB-2026-202"
        },
        {
            "domain": "telecom_location",
            "objective": "Requisition for Call Detail Records and Tower Dump Location",
            "receiver": "Airtel",
            "case": "FIR-TEL-2026-303"
        },
        {
            "domain": "corporate_payroll",
            "objective": "Requisition for Corporate Payroll Audit and Bank Ledgers",
            "receiver": "ROC MCA",
            "case": "FIR-CORP-2026-404"
        },
        {
            "domain": "physical_homicide",
            "objective": "Urgent Preservation Order for Premises CCTV Footage and DVR Feeds",
            "receiver": "State Forensic Lab",
            "case": "FIR-HOM-2026-505"
        }
    ]

    for item in demo_cases:
        tmpl = master_agent.template_engine.select_template_for_target(domain=item["domain"], directive_action=item["objective"])
        contact = master_agent.template_engine.get_receiver_contact(item["receiver"])
        receiver_email = contact.get("email") if contact else "nodal@agency.gov.in"
        safe_print(f"\n🔹 [Domain: {item['domain'].upper()}] Case: {item['case']}")
        safe_print(f"   ► Selected Template ID: '{tmpl.template_id}' ({tmpl.title})")
        safe_print(f"   ► Nodal Receiver Email Resolved: '{receiver_email}' ({contact.get('entity_name') if contact else 'Custom Unit'})")

    # =========================================================================
    # PHASE 1: INGEST EVALUATOR AGENT OUTPUT PAYLOAD (MONEY LAUNDERING CASE)
    # =========================================================================
    safe_print("\n" + "▶"*3 + " PHASE 1: RECEIVING EVALUATOR AGENT ANALYSIS OUTPUT (MONEY LAUNDERING)")

    evaluator_output_payload = {
        "case_metadata": {
            "case_id": "FIR-ML-2026-7701",
            "fir_number": "FIR-ML-2026-7701",
            "police_station": "Economic Offences Wing (EOW), Financial Crime Unit",
            "officer_name": "DSP A. R. Joshi",
            "officer_designation": "Deputy Superintendent of Police",
            "official_email": "officer.cyber@police.gov.in",
            "investigation_purpose": "Multi-Layered Cyber Fraud & Money Laundering Syndicate (PMLA / Sec 106 BNSS)",
            "legal_authority": "Section 106 BNSS / Section 111 BNSS & Section 94 BNSS",
            "suspect_details": "Inter-state Shell Company Money Laundering Network using layered mule accounts",
            "victim_details": "Global Tech Solutions Ltd (Stolen Wire Transfer Proceeds: INR 25,00,000)"
        },
        "evaluated_targets": [
            {
                "type": "bank",
                "identifier": "501004928172",
                "name": "Apex Global Shell Corp (Primary Beneficiary Mule Account)",
                "entity_name": "HDFC Bank Nodal Fraud Control Cell",
                "details": "Primary recipient account of INR 25,00,000 cyber fraud proceeds"
            },
            {
                "type": "bank",
                "identifier": "918273645019",
                "name": "Vanguard Logistics (Layer-1 Transfer Account)",
                "entity_name": "State Bank of India Compliance Cell",
                "details": "Layer-1 mule account receiving rapid split transfer of INR 8,00,000"
            },
            {
                "type": "telecom",
                "identifier": "9825012345",
                "name": "Syndicate Handler Call Coordinate",
                "entity_name": "Airtel Nodal Compliance Division",
                "details": "Mobile line used for phishing dispatch and net-banking OTP interception"
            }
        ],
        "recommended_directives": [
            {
                "target_identifier": "501004928172",
                "type": "freeze",
                "legal_section": "Section 106 BNSS / PMLA Directive"
            },
            {
                "target_identifier": "918273645019",
                "type": "statement",
                "legal_section": "Section 91 CrPC / Sec 94 BNSS"
            },
            {
                "target_identifier": "9825012345",
                "type": "cdr",
                "legal_section": "Section 94 BNSS"
            }
        ]
    }

    # Execute Evaluator Ingestion & Initial Pipeline Dispatch
    ingest_result = master_agent.ingest_evaluator_data(evaluator_output_payload)
    case_id = ingest_result["case_id"]

    safe_print(f"\n📌 [Evaluator Agent Ingestion Summary]")
    safe_print(f"   ► Status: {ingest_result['status'].upper()}")
    safe_print(f"   ► Ingested Case ID: '{case_id}'")
    safe_print(f"   ► Ingested Targets Count: {ingest_result['targets_ingested']}")

    # =========================================================================
    # PHASE 2: ASYNCHRONOUS INBOX MONITORING & EVIDENCE INGESTION
    # =========================================================================
    safe_print("\n" + "▶"*3 + " PHASE 2: INGESTING EVIDENTIAL RESPONSES (BANK RECORD CSV & CDR)")

    # Read the created bank_record.csv file content
    bank_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bank_record.csv")
    bank_record_csv_content = ""
    if os.path.exists(bank_csv_path):
        with open(bank_csv_path, "r", encoding="utf-8") as f:
            bank_record_csv_content = f.read()

    # Simulate Response 1: HDFC Bank sends bank_record.csv
    inbox_monitor.simulate_receive_reply(
        sender_email="nodal.fraud@hdfcbank.com",
        subject=f"COMPLIANCE REPORT: Debit Freeze Directive [CrimeOS-REF: {case_id}]",
        body_text="Account freezed under Section 106 BNSS. Attached certified ledger statement bank_record.csv.",
        attachment_filename="bank_record.csv",
        attachment_content=bank_record_csv_content,
        case_number=case_id
    )

    # Simulate Response 2: Airtel Nodal Cell sends CDR CSV attachment
    simulated_cdr_csv = """CallID,Timestamp,CallerNumber,ReceiverNumber,CallType,DurationSec,CellID,IMEI
CDR7001,2026-07-24T09:15:00,9825012345,9898011223,OUTGOING,180,MUM-TOWER-441,864209041234567
CDR7002,2026-07-24T09:22:15,9825012345,918273645019,OUTGOING,45,DEL-TOWER-882,864209041234567
CDR7003,2026-07-24T09:40:10,9825012345,9727099887,OUTGOING,210,MUM-TOWER-441,864209041234567
"""

    inbox_monitor.simulate_receive_reply(
        sender_email="nodal@airtel.com",
        subject=f"REQUISITION REPORT: CDR Logs [CrimeOS-REF: {case_id}]",
        body_text="Call detail records attached for suspect phone line.",
        attachment_filename="CDR_Logs_9825012345.csv",
        attachment_content=simulated_cdr_csv,
        case_number=case_id
    )

    # =========================================================================
    # SUMMARY OF AUTOMATED MONEY LAUNDERING CASE PIPELINE
    # =========================================================================
    safe_print("\n" + "═"*85)
    safe_print(" 📋 MONEY LAUNDERING CASE REGISTRY & DISCOVERED MULE TARGETS")
    safe_print("═"*85)

    final_state = master_agent.pending_cases.get(case_id, {})
    safe_print(f"📂 Case Reference: {case_id}")
    safe_print(f"   Status: '{final_state.get('status')}'")
    safe_print(f"   Auto-Added Discovered Targets: {len(final_state.get('auto_added_targets', []))}")
    for tgt in final_state.get("auto_added_targets", []):
        safe_print(f"   • Discovered Target: {tgt.get('name')} ({tgt.get('identifier')})")

    if final_state.get("next_investigation_directive"):
        safe_print(f"   Next Directive Strategy: {final_state['next_investigation_directive'].get('strategy_summary')}")

    safe_print("\n" + "═"*85)
    safe_print(" ✅ MONEY LAUNDERING WORKFLOW AUTOMATION DEMO COMPLETED CLEANLY")
    safe_print("═"*85 + "\n")

if __name__ == "__main__":
    run_evaluator_automated_pipeline_demo()
