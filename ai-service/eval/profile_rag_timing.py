"""
Quick timing profiler for the RAG pipeline.
Runs a single test case and prints detailed timing for each step.
"""
import os, sys, time, json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load one test case from benchmark
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for version in ["rag_benchmark_v3.json", "rag_benchmark_v2.json"]:
    path = os.path.join(base_dir, "eval_dataset", version)
    if os.path.exists(path):
        break

data = json.load(open(path, "r", encoding="utf-8"))
tc = data["test_cases"][0]
narrative = tc["synthetic_complaint"].get("translated_text") or tc["synthetic_complaint"].get("raw_text") or ""
crime_sub = tc["synthetic_complaint"].get("crime_sub_type", "")
crime_cat = tc["synthetic_complaint"].get("crime_category", "")
spec = tc.get("specialist_domain", None)

print(f"=== RAG PIPELINE TIMING PROFILE ===")
print(f"Test case: {tc['test_case_id']}")
print(f"Crime: {crime_sub} | Narrative length: {len(narrative)} chars\n")

# Step 1: LLM Query Decomposition
from app.rag.query_decomposer import decompose_complaint_to_legal_queries
t0 = time.time()
sub_queries = decompose_complaint_to_legal_queries(
    complaint_text=narrative[:600],
    crime_sub_type=crime_sub,
    crime_category=crime_cat,
    specialist_domain=spec or "",
    max_queries=4
)
t1 = time.time()
print(f"[1] LLM Query Decomposition: {t1 - t0:.2f}s  ({len(sub_queries)} sub-queries)")

# Step 2: Embedding per sub-query (Dense Vector)
from app.rag.qdrant_client import get_query_embedding, RAG_ENABLE_HYDE
embed_times = []
for i, sq in enumerate(sub_queries):
    dense_text = sq.get("hyde_passage") if RAG_ENABLE_HYDE else sq.get("query")
    te0 = time.time()
    vec = get_query_embedding(dense_text)
    te1 = time.time()
    embed_times.append(te1 - te0)
    print(f"    [2.{i+1}] Embedding sub-query {i+1}: {te1 - te0:.3f}s  (text len: {len(dense_text)} chars, vec dim: {len(vec)})")

t2 = time.time()
print(f"[2] Total Embedding time: {sum(embed_times):.2f}s  (avg: {sum(embed_times)/len(embed_times):.3f}s per query)")

# Step 3: Qdrant Search per sub-query
from app.rag.qdrant_client import _single_query_rrf_search, get_qdrant_client
from config import RAG_CANDIDATES_PER_QUERY
client = get_qdrant_client()
search_times = []
all_results = []
for i, sq in enumerate(sub_queries):
    ts0 = time.time()
    results = _single_query_rrf_search(client, sq["query"], sq.get("hyde_passage"), spec, RAG_CANDIDATES_PER_QUERY)
    ts1 = time.time()
    search_times.append(ts1 - ts0)
    all_results.append(results)
    print(f"    [3.{i+1}] Qdrant search + BM25 + RRF for sub-query {i+1}: {ts1 - ts0:.3f}s  ({len(results)} results)")

t3 = time.time()
print(f"[3] Total Search time: {sum(search_times):.2f}s  (avg: {sum(search_times)/len(search_times):.3f}s per query)")

# Step 4: Cross-Query RRF Fusion (this is just dict merging, should be fast)
t4_start = time.time()
cross_query_scores = {}
for q_idx, q_results in enumerate(all_results):
    sorted_results = sorted(q_results, key=lambda x: x["score"], reverse=True)
    for rank, result in enumerate(sorted_results, 1):
        pid = result["id"]
        if pid not in cross_query_scores:
            cross_query_scores[pid] = {**result, "cross_rrf_score": 0.0, "appeared_in_queries": 0}
        cross_query_scores[pid]["cross_rrf_score"] += 1.0 / (60.0 + rank)
        cross_query_scores[pid]["appeared_in_queries"] += 1
candidates = sorted(cross_query_scores.values(), key=lambda x: x["cross_rrf_score"], reverse=True)[:45]
t4 = time.time()
print(f"[4] Cross-Query RRF Fusion: {t4 - t4_start:.3f}s  ({len(candidates)} candidates)")

# Step 5: Cross-Encoder Reranking
from app.rag.reranker import rerank_chunks
t5_start = time.time()
reranked = rerank_chunks(f"{crime_sub} {narrative[:800]}", candidates, top_k=15)
t5 = time.time()
print(f"[5] Cross-Encoder Reranking: {t5 - t5_start:.2f}s  ({len(candidates)} pairs scored)")

total = t5 - t0
print(f"\n=== TOTAL: {total:.2f}s per test case ===")
print(f"=== Projected for 40 cases: {total * 40 / 60:.1f} minutes ===")
print(f"\nBreakdown:")
print(f"  LLM Decomposition:    {t1-t0:.2f}s  ({(t1-t0)/total*100:.1f}%)")
print(f"  Dense Embedding:      {sum(embed_times):.2f}s  ({sum(embed_times)/total*100:.1f}%)")
print(f"  Qdrant+BM25+RRF:      {sum(search_times):.2f}s  ({sum(search_times)/total*100:.1f}%)")
print(f"  Cross-Query Fusion:   {t4-t4_start:.3f}s  ({(t4-t4_start)/total*100:.1f}%)")
print(f"  Cross-Encoder Rerank: {t5-t5_start:.2f}s  ({(t5-t5_start)/total*100:.1f}%)")
