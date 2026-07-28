import os
import sys
import json
from sentence_transformers import CrossEncoder

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client, get_query_embedding, tokenize_text, compute_bm25_score
from app.rag.reranker import get_fast_reranker_model

def run_diagnostic():
    client = get_qdrant_client()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json")
    
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    model = get_fast_reranker_model()

    print("=========================================================================")
    print("      DIAGNOSTIC: RRF vs CROSSENCODER CANDIDATE RANKING COMPARISON")
    print("=========================================================================\n")

    for tc_idx in [0, 3, 4, 7, 9]:  # ATOMIC-001, 004, 005, 008, 010
        tc = data['test_cases'][tc_idx]
        tc_id = tc['test_case_id']
        synth = tc['synthetic_complaint']
        query_raw = synth.get('raw_text') or ''
        query_trans = synth.get('translated_text') or query_raw
        gt = tc['ground_truth_binding']

        query_vector = get_query_embedding(query_raw)
        query_tokens = tokenize_text(query_raw)

        global_results = client.search(collection_name="police_sops_universal", query_vector=query_vector, limit=200)
        candidate_map = {str(pt.id): pt for pt in global_results}
        candidates = list(candidate_map.values())

        dense_sorted = sorted(candidates, key=lambda pt: float(pt.score), reverse=True)
        dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

        sparse_scored = []
        for pt in candidates:
            payload = pt.payload or {}
            full_str = f"{payload.get('source','')} {payload.get('document_title','')} {payload.get('text','')}"
            bm25 = compute_bm25_score(query_tokens, tokenize_text(full_str))
            sparse_scored.append((str(pt.id), bm25))

        sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
        sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

        rrf_scored = []
        for pt in candidates:
            pid = str(pt.id)
            r_d = dense_rank_map.get(pid, 100)
            r_s = sparse_rank_map.get(pid, 100)
            score = (1.0 / (60.0 + r_d)) + (1.0 / (60.0 + r_s))
            payload = pt.payload or {}
            rrf_scored.append({
                'id': pid,
                'rrf_score': score,
                'source': payload.get('source',''),
                'page': payload.get('page','1'),
                'text': payload.get('text','')
            })

        rrf_scored.sort(key=lambda x: x['rrf_score'], reverse=True)

        # RRF Rank of target
        rrf_target_ranks = []
        for i, c in enumerate(rrf_scored, 1):
            if str(c['source']).lower() == str(gt['source_document']).lower():
                pages = [int(p.strip()) for p in str(c['page']).split(',') if p.strip().isdigit()]
                if any(p in gt['allowed_page_window'] for p in pages):
                    rrf_target_ranks.append(i)

        # CrossEncoder scoring on top 40 RRF candidates
        candidate_pool = rrf_scored[:40]
        pairs_raw = [[query_raw, f"{c['source']} {c['text']}"] for c in candidate_pool]
        pairs_trans = [[query_trans, f"{c['source']} {c['text']}"] for c in candidate_pool]
        
        ce_scores_raw = model.predict(pairs_raw)
        ce_scores_trans = model.predict(pairs_trans)

        pool_ce_raw = []
        pool_ce_trans = []
        pool_blended = []

        for idx, c in enumerate(candidate_pool):
            s_raw = float(ce_scores_raw[idx])
            s_trans = float(ce_scores_trans[idx])
            # Blend score
            blended = c['rrf_score'] + (s_trans * 0.002)
            
            c_copy_raw = dict(c, ce_score=s_raw)
            c_copy_trans = dict(c, ce_score=s_trans)
            c_copy_blend = dict(c, blend_score=blended)
            
            pool_ce_raw.append(c_copy_raw)
            pool_ce_trans.append(c_copy_trans)
            pool_blended.append(c_copy_blend)

        sorted_ce_raw = sorted(pool_ce_raw, key=lambda x: x['ce_score'], reverse=True)
        sorted_ce_trans = sorted(pool_ce_trans, key=lambda x: x['ce_score'], reverse=True)
        sorted_blended = sorted(pool_blended, key=lambda x: x['blend_score'], reverse=True)

        ce_raw_target_ranks = [i for i, c in enumerate(sorted_ce_raw, 1) if str(c['source']).lower() == str(gt['source_document']).lower() and any(int(p.strip()) in gt['allowed_page_window'] for p in str(c['page']).split(',') if p.strip().isdigit())]
        ce_trans_target_ranks = [i for i, c in enumerate(sorted_ce_trans, 1) if str(c['source']).lower() == str(gt['source_document']).lower() and any(int(p.strip()) in gt['allowed_page_window'] for p in str(c['page']).split(',') if p.strip().isdigit())]
        blended_target_ranks = [i for i, c in enumerate(sorted_blended, 1) if str(c['source']).lower() == str(gt['source_document']).lower() and any(int(p.strip()) in gt['allowed_page_window'] for p in str(c['page']).split(',') if p.strip().isdigit())]

        print(f"[{tc_id}] Ground Truth: {gt['source_document']} Page {gt['page_number']}")
        print(f"  - Pure RRF Target Rank             : {rrf_target_ranks[:3]}")
        print(f"  - Pure CE (Raw Hinglish Query) Rank : {ce_raw_target_ranks[:3]}")
        print(f"  - Pure CE (Translated English) Rank: {ce_trans_target_ranks[:3]}")
        print(f"  - RRF + CE Blended Rank            : {blended_target_ranks[:3]}")
        print("  Top 3 Pure RRF Candidate Documents:")
        for c in rrf_scored[:3]:
            print(f"    * {c['source']} p.{c['page']} (RRF Score: {c['rrf_score']:.5f})")
        print("  Top 3 Pure CrossEncoder (Raw Query) Candidate Documents:")
        for c in sorted_ce_raw[:3]:
            print(f"    * {c['source']} p.{c['page']} (CE Logit: {c['ce_score']:.4f})")
        print("-------------------------------------------------------------------------\n")

if __name__ == "__main__":
    run_diagnostic()
