import os
import sys
import json
import re
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client, search_legal_sops
from app.rag.query_optimizer import decompose_query_for_specialist
from sentence_transformers import SentenceTransformer

def run_diagnostic_audit_and_header_test():
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    composite_cases = [tc for tc in data['test_cases'] if tc['case_type'] == 'COMPOSITE_MULTI_DOCUMENT']

    print(f"=========================================================================")
    print(f"[*] STEP 1: AUDITING THE 4 SUSPICIOUS CONVENTIONAL GROUND-TRUTH TARGETS")
    print(f"=========================================================================\n", flush=True)

    suspicious_ids = ["BENCH-COMPOSITE-001", "BENCH-COMPOSITE-009", "BENCH-COMPOSITE-011", "BENCH-COMPOSITE-013"]

    for tc in composite_cases:
        tc_id = tc["test_case_id"]
        if tc_id in suspicious_ids:
            synth = tc["synthetic_complaint"]
            narrative = synth.get("translated_text") or synth.get("raw_text") or ""
            crime_sub = synth.get("crime_sub_type", "")
            conv_tgt = [tgt for tgt in tc["ground_truth_targets"] if tgt["target_specialist"] == "conventional_field_specialist"][0]

            print(f"--- CASE ID: {tc_id} (Crime: '{crime_sub}') ---")
            print(f"  Target Document: '{conv_tgt['source_document']}' (Page {conv_tgt['page_number']})")
            print(f"  Narrative Text:  \"{narrative}\"")

            # Search Qdrant for chunk text
            scroll_resp, _ = client.scroll(
                collection_name="police_sops_universal",
                limit=10000,
                with_payload=True,
                with_vectors=False
            )
            doc_target = str(conv_tgt["source_document"]).lower().strip()
            page_window = conv_tgt.get("allowed_page_window", [conv_tgt["page_number"]])
            
            matching = []
            for pt in scroll_resp:
                p = pt.payload or {}
                c_doc = str(p.get("source", "")).lower().strip()
                c_pages = [int(x.strip()) for x in str(p.get("page", "")).split(",") if x.strip().isdigit()]
                if c_doc == doc_target and any(pg in page_window for pg in c_pages):
                    matching.append(p.get("text", ""))

            print(f"  Target Chunk Snippet in Qdrant: \"{matching[0][:250] if matching else 'NOT FOUND'}...\"\n")

    print(f"=========================================================================")
    print(f"[*] STEP 2: CHEAP OFFLINE VALIDATION OF HEADER STRIPPING ON MISSED CHUNKS")
    print(f"=========================================================================\n", flush=True)

    model = SentenceTransformer('BAAI/bge-m3')

    # Test stripping header pollution on missed Gujarat Police Manual chunks
    header_regex = re.compile(r'\[Source:.*?Section:\s*\(G\.\s*R\..*?\]', re.IGNORECASE | re.DOTALL)

    improved_ranks = 0
    total_gpm_misses = 0

    for tc in composite_cases:
        tc_id = tc["test_case_id"]
        synth = tc["synthetic_complaint"]
        narrative = synth.get("translated_text") or synth.get("raw_text") or ""
        crime_sub = synth.get("crime_sub_type", "")
        conv_tgt = [tgt for tgt in tc["ground_truth_targets"] if tgt["target_specialist"] == "conventional_field_specialist"][0]

        if "gujarat" in str(conv_tgt["source_document"]).lower():
            total_gpm_misses += 1
            query = decompose_query_for_specialist(narrative, "conventional_field_specialist", crime_sub)
            q_emb = model.encode([query], normalize_embeddings=True)[0]

            # Get target chunk text from Qdrant
            doc_target = str(conv_tgt["source_document"]).lower().strip()
            page_window = conv_tgt.get("allowed_page_window", [conv_tgt["page_number"]])
            
            scroll_resp, _ = client.scroll(
                collection_name="police_sops_universal",
                limit=10000,
                with_payload=True,
                with_vectors=False
            )
            raw_text = ""
            for pt in scroll_resp:
                p = pt.payload or {}
                c_doc = str(p.get("source", "")).lower().strip()
                c_pages = [int(x.strip()) for x in str(p.get("page", "")).split(",") if x.strip().isdigit()]
                if c_doc == doc_target and any(pg in page_window for pg in c_pages):
                    raw_text = p.get("text", "")
                    break

            if raw_text:
                clean_text = header_regex.sub('', raw_text).strip()
                
                raw_emb = model.encode([raw_text], normalize_embeddings=True)[0]
                clean_emb = model.encode([clean_text], normalize_embeddings=True)[0]

                raw_sim = float(np.dot(q_emb, raw_emb))
                clean_sim = float(np.dot(q_emb, clean_emb))

                delta = clean_sim - raw_sim
                if delta > 0.02:
                    improved_ranks += 1

                print(f"  [+] {tc_id} (P.{conv_tgt['page_number']}): Raw Similarity={raw_sim:.4f} | Cleaned Similarity={clean_sim:.4f} | Delta={delta:+.4f}")

    print("\n=========================================================================")
    print(f" SUMMARY OF OFFLINE HEADER STRIPPING VALIDATION (GPM CHUNKS):")
    print(f"   • Total GPM Conventional Targets:    {total_gpm_misses}")
    print(f"   • Chunks with > +0.02 Similarity Gain: {improved_ranks} / {total_gpm_misses}")
    print("=========================================================================\n")

if __name__ == "__main__":
    run_diagnostic_audit_and_header_test()
