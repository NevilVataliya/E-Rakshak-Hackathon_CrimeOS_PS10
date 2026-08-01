import os
import sys
import json
import time
import random
from typing import List, Dict, Any

# Ensure root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT, COLLECTION_NAME, get_agent_llm
from app.rag.query_optimizer import extract_universal_legal_terms

DOMAINS = [
    "cyber_financial_intel_specialist",
    "bns_specialist",
    "bsa_specialist",
    "conventional_field_specialist"
]

def infer_specialist_domain(filename: str, current_spec: str) -> str:
    if current_spec in DOMAINS:
        return current_spec
    fname = str(filename).upper()
    if any(x in fname for x in ["BSA", "EVIDENCE"]):
        return "bsa_specialist"
    if any(x in fname for x in ["CFCFRMS", "CYBER", "CRYPTO", "FINANCIAL", "IT_ACT", "FAQ", "DPDP", "KYC", "LIABILITY"]):
        return "cyber_financial_intel_specialist"
    if any(x in fname for x in ["BNS_", "BNS.", "PENAL", "OFFENCE"]):
        return "bns_specialist"
    return "conventional_field_specialist"

def generate_rag_benchmark_v3():
    print("===========================================================================")
    print("   CRIME OS AI — SYNTHESIZING NEW BENCHMARK DATASET (v3.0)")
    print("===========================================================================")
    print(f"[+] Connecting to Qdrant vector store at {QDRANT_HOST}:{QDRANT_PORT}...")
    
    q_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    coll = COLLECTION_NAME if q_client.collection_exists(COLLECTION_NAME) else "police_sops_v2"
    
    scroll_res, _ = q_client.scroll(
        collection_name=coll,
        limit=3000,
        with_payload=True,
        with_vectors=False
    )
    
    if not scroll_res:
        print("[-] Error: Could not scroll points from Qdrant collection!")
        return

    print(f"[+] Retrieved {len(scroll_res)} points from Qdrant '{coll}'. Categorizing by specialist domain...")
    
    domain_chunks: Dict[str, List[Dict[str, Any]]] = {d: [] for d in DOMAINS}
    
    for pt in scroll_res:
        payload = pt.payload or {}
        text = payload.get("text", "")
        source = payload.get("source", "")
        raw_page = payload.get("page", 1)
        try:
            page = int(raw_page)
        except Exception:
            page = 1
            
        spec = infer_specialist_domain(source, payload.get("target_specialist", ""))
        
        if len(text) < 150:
            continue
            
        if spec not in domain_chunks:
            spec = "conventional_field_specialist"
            
        domain_chunks[spec].append({
            "point_id": str(pt.id),
            "source": source,
            "page": page,
            "text": text,
            "target_specialist": spec
        })

    for d, chunks in domain_chunks.items():
        print(f"    • Domain '{d}': {len(chunks)} candidate chunks available")

    # Sample 30 ATOMIC chunks (7-8 per domain)
    atomic_cases = []
    tc_id_counter = 1
    
    print("\n[+] Synthesizing 30 ATOMIC Single-Chunk Test Cases mimicking real police station complaints...")

    HINGLISH_TEMPLATES = [
        "Respected Sir, main Surat police station mein complaint darj karwana chahta hoon. {summary}. Mujhe nyay chahiye aur kripya ispar strict action lein.",
        "Sir, mere saath achanak yeh incident hua: {summary}. Main bohot pareshan hoon aur police se nivedan hai ki turant investigation shuru karein.",
        "Dear Officer, I want to report an offence regarding {summary}. Crime happened near Surat location. Please register my complaint u/s relative law.",
        "Respected Inspector, kal raat mere saath cyber fraud aur illegal activity hui: {summary}. Kripya bns/bsa ke tehat FIR register karke accused ke khilaf action lein."
    ]

    for domain in DOMAINS:
        candidates = domain_chunks[domain]
        random.shuffle(candidates)
        selected_atomic = candidates[:8]
        
        for chunk in selected_atomic:
            tc_id = f"BENCH3-ATOMIC-{tc_id_counter:03d}"
            tc_id_counter += 1
            
            snippet = chunk["text"][:300].replace("\n", " ").strip()
            summary = snippet[:180]
            
            template = random.choice(HINGLISH_TEMPLATES)
            hinglish_text = template.format(summary=summary)
            english_text = f"Respected Sir, I am filing a police complaint regarding: {summary}. Requesting immediate investigation and appropriate legal action under Indian law."
            crime_sub = f"{domain.replace('_specialist', '').replace('_', ' ').title()} Incident"

            atomic_cases.append({
                "test_case_id": tc_id,
                "case_type": "ATOMIC_SINGLE_CHUNK",
                "specialist_domain": domain,
                "ground_truth_binding": {
                    "target_point_id": chunk["point_id"],
                    "source_document": chunk["source"],
                    "page_number": chunk["page"],
                    "allowed_page_window": [max(1, chunk["page"]-1), chunk["page"], chunk["page"]+1]
                },
                "synthetic_complaint": {
                    "raw_text": hinglish_text,
                    "translated_text": english_text,
                    "crime_sub_type": crime_sub
                }
            })
            print(f"  [✓] {tc_id} ({domain[:15]}): Generated from {chunk['source']} p.{chunk['page']}")

    # Sample 20 COMPOSITE Multi-Document Cases
    composite_cases = []
    comp_counter = 1
    
    print("\n[+] Synthesizing 20 COMPOSITE Multi-Document Test Cases (4 Specialists per Case)...")

    for i in range(20):
        tc_id = f"BENCH3-COMPOSITE-{comp_counter:03d}"
        comp_counter += 1
        
        c_cyber = random.choice(domain_chunks["cyber_financial_intel_specialist"])
        c_bns = random.choice(domain_chunks["bns_specialist"])
        c_bsa = random.choice(domain_chunks["bsa_specialist"])
        c_conv = random.choice(domain_chunks["conventional_field_specialist"])
        
        s_cyber = c_cyber["text"][:120].replace("\n", " ")
        s_bns = c_bns["text"][:120].replace("\n", " ")
        s_bsa = c_bsa["text"][:120].replace("\n", " ")
        s_conv = c_conv["text"][:120].replace("\n", " ")
        
        hinglish_multi = f"Sir, main multiple offences reporting kar raha hoon. Cyber fraud aspect: {s_cyber}. Penal crime aspect: {s_bns}. Electronic evidence aspect: {s_bsa}. Field panchnama aspect: {s_conv}. Kripya FIR lodge karein aur multi-department action lein."
        english_multi = f"Respected Officer, I am reporting a multi-offense crime. Cyber Fraud: {s_cyber}. Penal Offence: {s_bns}. Electronic Evidence: {s_bsa}. Procedural Rule: {s_conv}. Requesting multi-agent police investigation."
        
        composite_cases.append({
            "test_case_id": tc_id,
            "case_type": "COMPOSITE_MULTI_DOCUMENT",
            "specialist_domain": "multi_domain",
            "ground_truth_targets": [
                {
                    "target_specialist": "cyber_financial_intel_specialist",
                    "point_id": c_cyber["point_id"],
                    "source_document": c_cyber["source"],
                    "page_number": c_cyber["page"],
                    "allowed_page_window": [max(1, c_cyber["page"]-1), c_cyber["page"], c_cyber["page"]+1]
                },
                {
                    "target_specialist": "bns_specialist",
                    "point_id": c_bns["point_id"],
                    "source_document": c_bns["source"],
                    "page_number": c_bns["page"],
                    "allowed_page_window": [max(1, c_bns["page"]-1), c_bns["page"], c_bns["page"]+1]
                },
                {
                    "target_specialist": "bsa_specialist",
                    "point_id": c_bsa["point_id"],
                    "source_document": c_bsa["source"],
                    "page_number": c_bsa["page"],
                    "allowed_page_window": [max(1, c_bsa["page"]-1), c_bsa["page"], c_bsa["page"]+1]
                },
                {
                    "target_specialist": "conventional_field_specialist",
                    "point_id": c_conv["point_id"],
                    "source_document": c_conv["source"],
                    "page_number": c_conv["page"],
                    "allowed_page_window": [max(1, c_conv["page"]-1), c_conv["page"], c_conv["page"]+1]
                }
            ],
            "synthetic_complaint": {
                "raw_text": hinglish_multi,
                "translated_text": english_multi,
                "crime_sub_type": "Complex Multi-Offense Police Case"
            }
        })
        print(f"  [✓] {tc_id}: Synthesized 4-Target Composite Case ({i+1}/20)")

    all_cases = atomic_cases + composite_cases
    
    benchmark_data = {
        "benchmark_metadata": {
            "version": "3.0",
            "created_at": time.strftime("%Y-%m-%d"),
            "total_test_cases": len(all_cases),
            "tier_distribution": {
                "atomic_single_chunk_cases": len(atomic_cases),
                "composite_multi_document_cases": len(composite_cases)
            },
            "description": "Newly synthesized Version 3.0 benchmark dataset mimicking authentic Indian police station complaints grounded in official PDFs."
        },
        "test_cases": all_cases
    }

    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval_dataset", "rag_benchmark_v3.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_data, f, indent=4)
        
    print(f"\n[+] SUCCESS! Generated dataset v3.0 with {len(all_cases)} test cases saved at:")
    print(f"    {output_path}")

if __name__ == "__main__":
    generate_rag_benchmark_v3()
