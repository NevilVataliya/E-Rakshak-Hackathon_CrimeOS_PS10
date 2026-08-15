import os
import sys
import json
import logging
from pathlib import Path

# Setup paths
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.stdout.reconfigure(encoding='utf-8')

from app.workflow_automator.summarizer_agent import SummarizerAgent

logging.basicConfig(level=logging.INFO)

def main():
    print("=================================================================")
    print("Testing Groq llama-3.1-8b-instant AI Module Summarizer (Modules 1-5)")
    print("=================================================================")
    
    agent = SummarizerAgent()
    print(f"Groq API Key present: {bool(agent.groq_api_key)}")
    print(f"Target Model: {agent.model_name}")

    case_no = "CR-2026-9914"

    # Test payloads for Modules 1 to 5
    modules_to_test = {
        "MODULE_1": {
            "complainant_name": "Rajesh Sharma",
            "crime_category": "Investment Fraud",
            "complaint_text": "Victim received a call on WhatsApp offering 300% guaranteed returns on crypto investment platform. Transferred INR 48.9 Lakhs to mule accounts.",
            "entities": {
                "bank_accounts": ["HDFC5010023411", "ICICI9821301923"],
                "phone_numbers": ["+919876543210", "+919123456789"],
                "upi_ids": ["mule.pay@okaxis"],
                "ip_addresses": ["185.220.101.4"]
            },
            "attached_files_count": 2
        },
        "MODULE_2": {
            "matches": [
                {
                    "entity_value": "HDFC5010023411",
                    "entity_type": "bank_account",
                    "matched_fir": "FIR 142/2026",
                    "police_station": "Cyber Cell Delhi",
                    "confidence": 0.94
                },
                {
                    "entity_value": "+919876543210",
                    "entity_type": "phone",
                    "matched_fir": "FIR 88/2026",
                    "police_station": "Cyber Cell Mumbai",
                    "confidence": 0.89
                }
            ],
            "stats": {"total_matches": 2, "high_confidence_matches": 2}
        },
        "MODULE_3": {
            "crime_category": "Investment Fraud",
            "investigation_steps": [
                {"title": "Issue Sec 106 BNSS Debit Freeze Directive", "bnss_reference": "Section 106 BNSS"},
                {"title": "Obtain IP Connection Logs from WhatsApp", "bnss_reference": "Section 94 BNSS"}
            ],
            "strategy_roadmap": ["Debit Freeze", "IP Tracing", "Mule Arrest"]
        },
        "MODULE_4": {
            "dispatched_directives": [
                {"id": "DIR-01", "title": "Section 94 BNSS Notice to HDFC Bank", "target_provider": "HDFC Bank", "status": "DISPATCHED_SMTP"},
                {"id": "DIR-02", "title": "Section 94 BNSS Notice to WhatsApp/Meta", "target_provider": "Meta Compliance", "status": "RESPONSE_RECEIVED"}
            ],
            "processed_replies": [
                {"sender": "nodal@hdfcbank.com", "subject": "Re: Section 94 BNSS Notice CR-2026-9914", "classification": "EVIDENCE_CONFIRMED"}
            ]
        },
        "MODULE_5": {
            "parsed_type": "BANK_STATEMENT",
            "executive_summary": "Parsed HDFC Bank Statement (1,840 transactions). System identified multi-tier money laundering layering pattern with 96% confidence score.",
            "extracted_metrics": {"total_debits": 4890000, "mule_accounts_identified": 4},
            "recommended_next_action": "Freeze secondary beneficiary accounts immediately."
        }
    }

    generated_summaries = {}

    for mod_id, payload in modules_to_test.items():
        print(f"\n[+] Testing {mod_id}...")
        res = agent.summarize_module(case_no, mod_id, payload)
        generated_summaries[mod_id] = res
        print(f"    Title: {res.get('module_title')}")
        print(f"    Brief: {res.get('concise_brief')}")
        print(f"    Key Facts: {res.get('key_facts')}")
        print(f"    Actions Taken: {res.get('actions_taken')}")

    print("\n[+] Testing Global Master Synthesis (Modules 1 to 5)...")
    global_res = agent.summarize_global(case_no, generated_summaries)
    print(f"    Master Title: {global_res.get('master_title')}")
    print(f"    Executive Brief: {global_res.get('executive_brief')}")
    print(f"    Total Completed Modules: {global_res.get('total_completed_modules')}")
    print(f"    Next Action: {global_res.get('recommended_next_step')}")
    print("\n✅ Groq llama-3.1-8b-instant Summarizer Test Finished Successfully!")

if __name__ == "__main__":
    main()
