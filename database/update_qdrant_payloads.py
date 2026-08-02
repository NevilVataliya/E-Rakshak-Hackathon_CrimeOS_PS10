import os
import sys
import json
from typing import List, Dict, Any
from qdrant_client import QdrantClient

# Ensure root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "police_sops_v2")

DOMAIN_KEYWORDS = {
    "cyber_financial_intel_specialist": [
        "cfcfrms", "1930", "it act", "section 66", "section 66d", "section 66c", "section 43",
        "computer", "digital evidence", "ip address", "telegram", "whatsapp", "phishing",
        "debit freeze", "mule account", "kyc", "upi", "crypto", "usdt", "wallet", "online fraud",
        "apk scam", "part time job", "cyber", "financial crime", "bank account", "customer liability"
    ],
    "bns_specialist": [
        "bns", "penal", "ipc", "punishment", "impersonation", "cheating", "extortion", "318",
        "308", "forgery", "fake document", "fraudulent", "offence against property", "digital arrest",
        "blackmail", "sextortion", "coercion", "stolen", "theft", "breach of trust"
    ],
    "bsa_specialist": [
        "bsa", "sakshya", "evidence", "certificate", "section 63", "section 61", "section 62",
        "65b", "hash value", "chain of custody", "admissibility", "digital forensics",
        "primary evidence", "secondary evidence", "electronic record", "call recording"
    ],
    "conventional_field_specialist": [
        "bnss", "nagarik suraksha", "procedural", "panchnama", "search and seizure", "section 105",
        "section 94", "section 183", "case diary", "fir", "zero fir", "gujarat police manual",
        "maalkhana", "chowki", "duty officer", "station house officer", "inquest", "spot inspection",
        "warrant", "arrest procedure", "training institute"
    ]
}

def classify_multi_specialist_domains(source_doc: str, doc_title: str, text: str) -> List[str]:
    combined_str = f"{source_doc} {doc_title} {text}".lower()
    matched_domains = set()

    # Document filename primary attribution
    fname = source_doc.upper()
    if any(x in fname for x in ["BSA", "EVIDENCE"]):
        matched_domains.add("bsa_specialist")
    if any(x in fname for x in ["CFCFRMS", "CYBER", "CRYPTO", "FINANCIAL", "IT_ACT", "FAQ", "DPDP", "KYC", "LIABILITY"]):
        matched_domains.add("cyber_financial_intel_specialist")
    if any(x in fname for x in ["BNS_", "BNS.", "PENAL", "OFFENCE"]):
        matched_domains.add("bns_specialist")
    if any(x in fname for x in ["MANUAL", "GUJARAT", "TRAINING", "BNSS", "PROCEDURAL"]):
        matched_domains.add("conventional_field_specialist")

    # Keyword text matching for multi-disciplinary statutes
    for domain, keywords in DOMAIN_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in combined_str)
        if hits >= 2:
            matched_domains.add(domain)

    if not matched_domains:
        matched_domains.add("conventional_field_specialist")

    return sorted(list(matched_domains))

def update_qdrant_payloads_in_place():
    print(f"\n===========================================================================")
    print(f"   CRIME OS AI — IN-PLACE QDRANT PAYLOAD ENRICHMENT ('{COLLECTION_NAME}')")
    print(f"===========================================================================")
    print(f"[+] Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}...")

    q_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    if not q_client.collection_exists(COLLECTION_NAME):
        print(f"[-] Error: Collection '{COLLECTION_NAME}' does not exist.")
        return

    offset = None
    total_updated = 0
    batch_size = 250

    while True:
        scroll_res, next_offset = q_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=batch_size,
            offset=offset,
            with_payload=True,
            with_vectors=False
        )

        if not scroll_res:
            break

        for pt in scroll_res:
            payload = pt.payload or {}
            source = payload.get("source", "")
            doc_title = payload.get("document_title", "")
            text = payload.get("text", "")

            multi_specs = classify_multi_specialist_domains(source, doc_title, text)
            primary_spec = multi_specs[0] if multi_specs else payload.get("target_specialist", "conventional_field_specialist")

            updated_payload = {
                "target_specialist": primary_spec,
                "target_specialists": multi_specs
            }

            q_client.set_payload(
                collection_name=COLLECTION_NAME,
                payload=updated_payload,
                points=[pt.id]
            )
            total_updated += 1

        print(f"    -> Progress: Enriched {total_updated} point payloads in Qdrant '{COLLECTION_NAME}'...")

        if next_offset is None:
            break
        offset = next_offset

    print(f"\n[+] SUCCESS! In-place payload enrichment complete for all {total_updated} points in '{COLLECTION_NAME}'.")
    print(f"[+] Qdrant DB is fully synchronized without re-ingesting raw PDF vectors!")

if __name__ == "__main__":
    update_qdrant_payloads_in_place()
