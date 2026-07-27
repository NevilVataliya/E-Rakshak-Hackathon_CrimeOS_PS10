import os
import sys
import json
import re
import hashlib
from typing import List, Dict, Any

# Ensure ai-service root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT, get_agent_llm
from app.utils.json_helper import parse_llm_json

def get_md5(text: str) -> str:
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def parse_page_num(val: Any) -> int:
    if isinstance(val, int):
        return val
    val_str = str(val or "1")
    nums = re.findall(r'\d+', val_str)
    return int(nums[0]) if nums else 1

def generate_benchmark_dataset():
    collection_name = os.getenv("COLLECTION_NAME", "police_sops_v2")
    print(f"[+] Initializing Persistent RAG Synthetic Benchmark Generator for '{collection_name}'...")
    
    # 1. Connect to Qdrant Vector Store
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    
    # Scroll points from Qdrant
    scroll_res, _ = client.scroll(
        collection_name=collection_name,
        limit=200,
        with_payload=True,
        with_vectors=False
    )
    
    print(f"[+] Scrolled {len(scroll_res)} points from Qdrant collection '{collection_name}'.")
    
    if not scroll_res:
        print(f"[-] No points found in Qdrant collection '{collection_name}'.")
        return

    # Categorize points by target_specialist
    specialist_chunks: Dict[str, List[Any]] = {
        "cyber_financial_intel_specialist": [],
        "bns_specialist": [],
        "bsa_specialist": [],
        "conventional_field_specialist": []
    }
    
    for pt in scroll_res:
        payload = pt.payload or {}
        spec = payload.get("target_specialist") or "bns_specialist"
        if spec in specialist_chunks:
            p_num = parse_page_num(payload.get("page"))
            specialist_chunks[spec].append({
                "point_id": str(pt.id),
                "source_document": payload.get("source", "UNKNOWN_SOP.pdf"),
                "document_title": payload.get("document_title", payload.get("source", "UNKNOWN_SOP.pdf")),
                "page_number": p_num,
                "text_snippet": payload.get("text", "")[:800],
                "specialist": spec
            })
            
    print("[+] Chunk Stratification Counts:")
    for spec, chunks in specialist_chunks.items():
        print(f"    - {spec}: {len(chunks)} sampled chunks")

    llm = get_agent_llm("auto", temperature=0.2)
    test_cases = []
    tc_counter = 1

    # 2. Generate Tier 1: Single-Chunk Atomic Cases (6 per specialist domain = 24 cases)
    print("\n[+] Generating Tier 1 Atomic Single-Chunk Test Cases...")
    for spec, chunks in specialist_chunks.items():
        sampled_subset = chunks[:6]
        for item in sampled_subset:
            page_num = item["page_number"]
            window = [max(1, page_num - 1), page_num, page_num + 1]
            
            prompt = f"""
You are a Police Investigation Analyst creating benchmark evaluation datasets for Indian Law Enforcement.

Given the following SOP / Penal Code text snippet:
DOCUMENT: {item['source_document']} ({item['document_title']} - Page {page_num})
SPECIALIST DOMAIN: {spec}
TEXT SNIPPET:
{item['text_snippet']}

Task:
Synthesize 1 realistic Hinglish / Multilingual police complaint narrative (as written by a victim or police officer in India) whose specific facts, crime locations, and amounts DIRECTLY trigger the legal sections or SOP rules in the text snippet.

Respond ONLY in valid JSON matching this exact structure:
{{
  "hinglish_raw_text": "<HINGLISH_COMPLAINT_NARRATIVE>",
  "translated_english_text": "<CLEAR_ENGLISH_TRANSLATION>",
  "crime_category": "CYBER|CONVENTIONAL|HYBRID",
  "crime_sub_type": "<SPECIFIC_CRIME_SUB_TYPE>",
  "extracted_entities": {{
    "persons": [{{"name": "...", "role": "victim|accused"}}],
    "phone_numbers": ["..."],
    "bank_accounts": [{{"account_number": "...", "ifsc": "..."}}],
    "vpas_upis": ["..."]
  }}
}}
"""
            try:
                resp = llm.invoke(prompt)
                text = resp.content if hasattr(resp, 'content') else str(resp)
                synth_data = parse_llm_json(text)
                
                tc_id = f"BENCH-ATOMIC-{tc_counter:03d}"
                test_case = {
                    "test_case_id": tc_id,
                    "case_type": "ATOMIC_SINGLE_CHUNK",
                    "specialist_domain": spec,
                    "ground_truth_binding": {
                        "target_point_id": item["point_id"],
                        "source_document": item["source_document"],
                        "document_title": item["document_title"],
                        "page_number": page_num,
                        "allowed_page_window": window,
                        "chunk_md5_hash": get_md5(item["text_snippet"])
                    },
                    "target_chunk_snippet": item["text_snippet"][:300],
                    "synthetic_complaint": {
                        "variant_type": "hinglish",
                        "raw_text": synth_data.get("hinglish_raw_text", ""),
                        "translated_text": synth_data.get("translated_english_text", ""),
                        "crime_category": synth_data.get("crime_category", "CYBER"),
                        "crime_sub_type": synth_data.get("crime_sub_type", "Cyber Investigation")
                    },
                    "expected_entities": synth_data.get("extracted_entities", {})
                }
                test_cases.append(test_case)
                print(f"  [✓] Built Atomic Case {tc_id} ({spec} | {item['source_document']} p.{page_num})")
                tc_counter += 1
            except Exception as e:
                print(f"  [!] Failed to generate atomic case for point {item['point_id']}: {e}")

    # 3. Generate Tier 2: Multi-Document Composite Cases (16 cases)
    print("\n[+] Generating Tier 2 Multi-Document Composite Test Cases...")
    cyber_list = specialist_chunks["cyber_financial_intel_specialist"]
    bns_list = specialist_chunks["bns_specialist"]
    bsa_list = specialist_chunks["bsa_specialist"]
    conv_list = specialist_chunks["conventional_field_specialist"]
    
    comp_counter = 1
    max_comp = min(len(cyber_list), len(bns_list), len(bsa_list), len(conv_list), 16)
    
    for i in range(max_comp):
        c_chunk = cyber_list[i % len(cyber_list)]
        b_chunk = bns_list[i % len(bns_list)]
        s_chunk = bsa_list[i % len(bsa_list)]
        v_chunk = conv_list[i % len(conv_list)]
        
        targets = [
            {
                "target_specialist": c_chunk["specialist"],
                "source_document": c_chunk["source_document"],
                "page_number": c_chunk["page_number"],
                "allowed_page_window": [max(1, c_chunk["page_number"]-1), c_chunk["page_number"], c_chunk["page_number"]+1],
                "point_id": c_chunk["point_id"]
            },
            {
                "target_specialist": b_chunk["specialist"],
                "source_document": b_chunk["source_document"],
                "page_number": b_chunk["page_number"],
                "allowed_page_window": [max(1, b_chunk["page_number"]-1), b_chunk["page_number"], b_chunk["page_number"]+1],
                "point_id": b_chunk["point_id"]
            },
            {
                "target_specialist": s_chunk["specialist"],
                "source_document": s_chunk["source_document"],
                "page_number": s_chunk["page_number"],
                "allowed_page_window": [max(1, s_chunk["page_number"]-1), s_chunk["page_number"], s_chunk["page_number"]+1],
                "point_id": s_chunk["point_id"]
            },
            {
                "target_specialist": v_chunk["specialist"],
                "source_document": v_chunk["source_document"],
                "page_number": v_chunk["page_number"],
                "allowed_page_window": [max(1, v_chunk["page_number"]-1), v_chunk["page_number"], v_chunk["page_number"]+1],
                "point_id": v_chunk["point_id"]
            }
        ]
        
        comp_prompt = f"""
You are a Senior Police Intelligence Analyst creating benchmark multi-offense complex cases.

Synthesize ONE comprehensive, multi-offense Indian police complaint narrative (in Hinglish + English translation) that combines the following 4 procedural/statutory requirements into a single realistic case:

REQUIREMENT 1 ({c_chunk['source_document']} p.{c_chunk['page_number']}): {c_chunk['text_snippet'][:300]}
REQUIREMENT 2 ({b_chunk['source_document']} p.{b_chunk['page_number']}): {b_chunk['text_snippet'][:300]}
REQUIREMENT 3 ({s_chunk['source_document']} p.{s_chunk['page_number']}): {s_chunk['text_snippet'][:300]}
REQUIREMENT 4 ({v_chunk['source_document']} p.{v_chunk['page_number']}): {v_chunk['text_snippet'][:300]}

Respond ONLY in valid JSON matching this exact structure:
{{
  "hinglish_raw_text": "<COMPLEX_MULTIPLE_OFFENSE_HINGLISH_COMPLAINT>",
  "translated_english_text": "<CLEAR_ENGLISH_TRANSLATION>",
  "crime_category": "HYBRID",
  "crime_sub_type": "<COMPOSITE_CRIME_SUB_TYPE>",
  "extracted_entities": {{
    "persons": [{{"name": "...", "role": "victim|accused"}}],
    "phone_numbers": ["..."],
    "bank_accounts": [{{"account_number": "...", "ifsc": "..."}}],
    "vpas_upis": ["..."]
  }}
}}
"""
        try:
            resp = llm.invoke(comp_prompt)
            text = resp.content if hasattr(resp, 'content') else str(resp)
            synth_data = parse_llm_json(text)
            
            tc_id = f"BENCH-COMPOSITE-{comp_counter:03d}"
            test_case = {
                "test_case_id": tc_id,
                "case_type": "COMPOSITE_MULTI_DOCUMENT",
                "specialist_domain": "multi_domain",
                "ground_truth_targets": targets,
                "synthetic_complaint": {
                    "variant_type": "hinglish",
                    "raw_text": synth_data.get("hinglish_raw_text", ""),
                    "translated_text": synth_data.get("translated_english_text", ""),
                    "crime_category": synth_data.get("crime_category", "HYBRID"),
                    "crime_sub_type": synth_data.get("crime_sub_type", "Complex Multi-Offense Crime")
                },
                "expected_entities": synth_data.get("extracted_entities", {})
            }
            test_cases.append(test_case)
            print(f"  [✓] Built Composite Case {tc_id} (4 Targets Across Domains)")
            comp_counter += 1
        except Exception as e:
            print(f"  [!] Failed to generate composite case #{i+1}: {e}")

    # 4. Save Persistent Benchmark File
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "rag_benchmark_v2.json")
    
    benchmark_payload = {
        "benchmark_metadata": {
            "version": "2.0",
            "created_at": "2026-07-24",
            "collection_name": collection_name,
            "total_test_cases": len(test_cases),
            "tier_distribution": {
                "atomic_single_chunk_cases": len([c for c in test_cases if c["case_type"] == "ATOMIC_SINGLE_CHUNK"]),
                "composite_multi_document_cases": len([c for c in test_cases if c["case_type"] == "COMPOSITE_MULTI_DOCUMENT"])
            }
        },
        "test_cases": test_cases
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_payload, f, indent=2, ensure_ascii=False)
        
    print(f"\n[+] SUCCESS! Persistent RAG Benchmark v2 dataset saved to '{output_path}'.")
    print(f"    - Total Test Cases Generated: {len(test_cases)}")

if __name__ == "__main__":
    generate_benchmark_dataset()
