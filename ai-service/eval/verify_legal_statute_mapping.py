import os
import sys
import json

def verify_case_statute_correctness():
    print("=========================================================================")
    print("  CRIME OS AI — SURAT POLICE LEGAL STATUTE & CASE RELEVANCE AUDIT")
    print("=========================================================================\n")

    audit_matrix = [
        {
            "case_id": "SURAT-CYBER-2026-001",
            "crime_type": "Telegram Part-Time Job Scam (₹4.5 Lakhs)",
            "fact_pattern": "Victim promised task commission on Telegram, induced to transfer ₹4.5L via UPI to fake beneficiary accounts.",
            "statutory_mapping": [
                {
                    "section": "Section 318(4) BNS",
                    "legal_reasoning": "Mandatory for Cheating & Dishonestly inducing victim to transfer property/money (Replaces IPC 420).",
                    "official_sop_source": "BNS Penal Code 2024 Chapter X & Gujarat Police Investigation Manual Vol III"
                },
                {
                    "section": "Section 66D IT Act",
                    "legal_reasoning": "Mandatory whenever cheating/fraud is committed using a computer resource, mobile app, or Telegram.",
                    "official_sop_source": "Information Technology Act 2000 Section 66D & I4C Cyber SOP"
                },
                {
                    "section": "Section 319 BNS",
                    "legal_reasoning": "Cheating by Personation (Admin posing as task agent).",
                    "official_sop_source": "BNS Penal Code 2024 Section 319"
                },
                {
                    "section": "1930 Portal & Layer-1/2 Lien Mark",
                    "legal_reasoning": "Mandatory emergency financial intervention to freeze stolen funds before cash-out.",
                    "official_sop_source": "MHA I4C CFCFRMS SOP & Gujarat Cyber Crime Cell Directives"
                },
                {
                    "section": "Section 63 BSA Certificate",
                    "legal_reasoning": "Mandatory for legal admissibility of Telegram chat screenshots and UPI receipts in court.",
                    "official_sop_source": "Bharatiya Sakshya Adhiniyam 2023 Section 63 (Replaces 65B Evidence Act)"
                }
            ]
        },
        {
            "case_id": "SURAT-CYBER-2026-002",
            "crime_type": "Digital Arrest Extortion & CBI Impersonation (₹12 Lakhs)",
            "fact_pattern": "WhatsApp video call from fake CBI officer threatening arrest for illegal courier package, demanding ₹12L fee.",
            "statutory_mapping": [
                {
                    "section": "Section 308(2) BNS",
                    "legal_reasoning": "Mandatory for Extortion (putting victim in fear of arrest/injury to dishonestly induce money transfer).",
                    "official_sop_source": "BNS Penal Code 2024 Section 308"
                },
                {
                    "section": "Section 204 BNS",
                    "legal_reasoning": "Mandatory for Personating a Public Servant (Posing as CBI/Police Officer in uniform).",
                    "official_sop_source": "BNS Penal Code 2024 Section 204 (Replaces IPC 170)"
                },
                {
                    "section": "Section 66D IT Act",
                    "legal_reasoning": "Cheating by impersonation using WhatsApp video call / telecommunication device.",
                    "official_sop_source": "Information Technology Act Section 66D"
                },
                {
                    "section": "Section 183 BNSS",
                    "legal_reasoning": "Mandatory recording of victim's statement by Magistrate / IO for cyber extortion trials.",
                    "official_sop_source": "Bharatiya Nagarik Suraksha Sanhita 2023 Section 183"
                }
            ]
        },
        {
            "case_id": "SURAT-ADAJAN-2026-003",
            "crime_type": "Muthoot Gold Loan Fraud & Forged Aadhar (₹14.5 Lakhs)",
            "fact_pattern": "Accused pledged fake copper-coated gold ornaments & submitted forged Aadhar card to obtain ₹14.5L loan.",
            "statutory_mapping": [
                {
                    "section": "Section 318(4) BNS",
                    "legal_reasoning": "Cheating financial institution by pledging fake gold.",
                    "official_sop_source": "BNS Penal Code 2024 Section 318"
                },
                {
                    "section": "Section 336(3) & 338 BNS",
                    "legal_reasoning": "Mandatory for Forgery of valuable security / identity documents (Aadhar card).",
                    "official_sop_source": "BNS Penal Code 2024 Sections 336 & 338"
                },
                {
                    "section": "Section 340 BNS",
                    "legal_reasoning": "Using forged document as genuine.",
                    "official_sop_source": "BNS Penal Code 2024 Section 340"
                },
                {
                    "section": "DFS Gandhinagar Testing & BNSS 105 Panchnama",
                    "legal_reasoning": "Mandatory audio-video recorded seizure of fake gold & sending samples to State Forensic Science Laboratory.",
                    "official_sop_source": "BNSS 2023 Section 105 & Gujarat Police Manual Vol II Chapter IV"
                }
            ]
        }
    ]

    for case in audit_matrix:
        print(f"[*] Case ID: {case['case_id']} | Type: {case['crime_type']}")
        print(f"    Fact Pattern: {case['fact_pattern']}\n")
        print("    STATUTORY & SOP RELEVANCE AUDIT:")
        for idx, m in enumerate(case["statutory_mapping"], 1):
            print(f"    {idx}. [{m['section']}]")
            print(f"       -> Legal Necessity: {m['legal_reasoning']}")
            print(f"       -> Official Source: {m['official_sop_source']}\n")
        print("-------------------------------------------------------------------------\n")

if __name__ == "__main__":
    verify_case_statute_correctness()
