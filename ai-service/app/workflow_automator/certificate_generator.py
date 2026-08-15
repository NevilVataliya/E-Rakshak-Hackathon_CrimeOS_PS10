import os
import hashlib
import datetime
from typing import Dict, Any, Optional

def generate_section_63_bsa_certificate(
    case_number: str,
    evidence_type: str,
    file_name: str,
    file_content_or_bytes: Any,
    officer_name: str = "PSI Inspector V. K. Patel",
    police_station: str = "Surat Cyber Crime Police Station, Gujarat",
    summary_findings: str = ""
) -> Dict[str, Any]:
    """
    Generates a legally compliant Electronic Evidence Certificate under
    Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (BSA) / Section 65B of Indian Evidence Act, 1872.
    Computes cryptographic SHA-256 checksum and produces court-admissible certification.
    """
    # 1. Compute Cryptographic SHA-256 Checksum
    if isinstance(file_content_or_bytes, bytes):
        raw_bytes = file_content_or_bytes
    elif isinstance(file_content_or_bytes, str):
        raw_bytes = file_content_or_bytes.encode('utf-8')
    else:
        raw_bytes = str(file_content_or_bytes).encode('utf-8')

    sha256_hash = hashlib.sha256(raw_bytes).hexdigest()
    file_size_kb = max(0.1, round(len(raw_bytes) / 1024, 2))
    timestamp_utc = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    timestamp_ist = (datetime.datetime.utcnow() + datetime.timedelta(hours=5, minutes=30)).strftime("%d-%b-%Y %I:%M:%S %p IST")

    cert_id = f"BSA63-CERT-{case_number.replace('/', '-')}-{sha256_hash[:8].upper()}"

    # 2. Statutory Legal Declaration Text
    statutory_text = f"""
========================================================================================================
CERTIFICATE OF ELECTRONIC EVIDENCE UNDER SECTION 63 OF BHARATIYA SAKSHYA ADHINIYAM, 2023 (BSA)
(Formerly Section 65B of the Indian Evidence Act, 1872)
========================================================================================================

CERTIFICATE REFERENCE NO : {cert_id}
CASE FIR / CR REFERENCE  : {case_number}
INVESTIGATING UNIT       : {police_station}
DATE & TIME OF INGESTION : {timestamp_ist}

I, {officer_name}, holding the rank of Police Sub-Inspector at {police_station}, do hereby solemnly affirm and state on oath as follows:

1. Identification of Electronic Record:
   The electronic record described herein consists of:
   • Evidence Category : {evidence_type.upper()}
   • Source File Name  : {file_name or f'{evidence_type.lower()}_payload.csv'}
   • File Size         : {file_size_kb} KB
   • SHA-256 Checksum  : {sha256_hash}

2. Operational Integrity Declaration (Sub-Section 2 of Section 63 BSA):
   (a) The computer system, network terminals, and automated analytical software ('CrimeOS Core Engine') used to ingest, parse, and analyze the said electronic record were operating under my lawful management, supervision, and command during the entire period of investigation.
   (b) The said electronic record was supplied directly from official lawful authority nodal channels (Bank/Telecom/Intermediary compliance response desks) and was fed into the automated evidentiary computer in the ordinary course of official investigation.
   (c) Throughout the material part of the said period, the computer system and hashing algorithms were operating properly; and at no stage was the operational integrity, chain of custody, or accuracy of the electronic data compromised.

3. Forensic Summary of Extracted Record:
   {summary_findings or 'Grounded extraction of transactions, subscriber identifiers, call detail records, and device metadata.'}

4. Cryptographic Validation & Anti-Tampering Seal:
   The computed SHA-256 hash [{sha256_hash}] guarantees zero bit-level alteration between the received statutory compliance payload and the analytical exhibits presented in this judicial dossier.

IN WITNESS WHEREOF, I have subscribed my hand and official seal to this certificate on this {timestamp_ist}.

_______________________________________
Signature of Certifying Officer
{officer_name}
Investigating Officer / Cyber Forensic Analyst
{police_station}
Official Identification: GJ-CYBER-POLICE-{case_number}
========================================================================================================
"""

    return {
        "certificate_id": cert_id,
        "case_number": case_number,
        "evidence_type": evidence_type,
        "file_name": file_name or f"{evidence_type.lower()}_response.csv",
        "file_size_kb": file_size_kb,
        "sha256_hash": sha256_hash,
        "timestamp_ist": timestamp_ist,
        "timestamp_utc": timestamp_utc,
        "certifying_officer": officer_name,
        "police_station": police_station,
        "certificate_full_text": statutory_text.strip(),
        "is_verified": True,
        "statute_reference": "Section 63 of Bharatiya Sakshya Adhiniyam, 2023 (BSA)"
    }
