import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops
from eval.run_rag_benchmark import is_chunk_hit

v3_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "eval_dataset", "rag_benchmark_v3.json")
with open(v3_path, "r", encoding="utf-8") as f:
    data = json.load(f)

comp_cases = [tc for tc in data["test_cases"] if tc["case_type"] == "COMPOSITE_MULTI_DOCUMENT"]

tc = comp_cases[0]
print(f"Testing {tc['test_case_id']}...")
targets = tc["ground_truth_targets"]
synth = tc["synthetic_complaint"]
narrative = synth.get("translated_text") or synth.get("raw_text") or ""
crime_sub = synth.get("crime_sub_type", "")
query_str = f"{narrative[:1500]} {crime_sub}".strip()

print("\n--- GROUND TRUTH TARGETS ---")
for idx, tgt in enumerate(targets, 1):
    print(f"Target #{idx} ({tgt['target_specialist']}): Point ID={tgt['point_id']} | Doc={tgt['source_document']} p.{tgt['page_number']}")

retrieved = search_legal_sops(query_str, target_specialist="multi_specialist", top_k=20)

print(f"\n--- RETRIEVED ({len(retrieved)} chunks) ---")
for idx, ret in enumerate(retrieved, 1):
    spec = ret.get("target_specialist", "unknown")
    doc = ret.get("source", "unknown")
    page = ret.get("page", "1")
    pid = ret.get("id")
    print(f"Rank #{idx:02d} [{spec}] Point ID={pid} | Doc={doc} p.{page}")

print("\n--- TARGET HITS ANALYSIS ---")
for idx, tgt in enumerate(targets, 1):
    hit_idx = None
    for r_rank, r_chunk in enumerate(retrieved, 1):
        if is_chunk_hit(r_chunk, tgt):
            hit_idx = r_rank
            break
    status = f"HIT at Rank {hit_idx}" if hit_idx else "MISSED"
    print(f"Target #{idx} ({tgt['target_specialist']}) [{tgt['source_document']} p.{tgt['page_number']}]: {status}")
