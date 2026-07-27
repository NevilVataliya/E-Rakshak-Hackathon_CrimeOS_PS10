"""
Diagnostic: What is the multi-query decomposer actually retrieving vs what the
simple single-query fallback retrieves? And what did the OLD system (police_sops
collection with single Dense+BM25) retrieve?
"""
import os, sys, json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import search_legal_sops, get_qdrant_client
from app.rag.query_decomposer import _fallback_decomposition
from config import COLLECTION_NAME

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(base_dir, "eval_dataset", "rag_benchmark_v2.json"), "r", encoding="utf-8"))

# Check what collection we're hitting
client = get_qdrant_client()
collections = [c.name for c in client.get_collections().collections]
print(f"Available collections: {collections}")
print(f"Current COLLECTION_NAME: {COLLECTION_NAME}")

# Check point counts
for col in collections:
    info = client.get_collection(col)
    print(f"  {col}: {info.points_count} points")

# For first 5 atomic test cases, compare: what does SIMPLE single-query retrieve?
print(f"\n{'='*80}")
print(f"DIAGNOSTIC: Simple single-query search vs Ground Truth")
print(f"Collection: {COLLECTION_NAME}")
print(f"{'='*80}\n")

for tc in data["test_cases"][:10]:
    if tc["case_type"] != "ATOMIC_SINGLE_CHUNK":
        continue
    
    gt = tc["ground_truth_binding"]
    synth = tc["synthetic_complaint"]
    narrative = synth.get("translated_text") or synth.get("raw_text") or ""
    crime_sub = synth.get("crime_sub_type", "")
    
    # Simple single-query: just use complaint text directly
    simple_query = f"{narrative[:500]} {crime_sub}"
    simple_results = search_legal_sops(
        query=simple_query,
        target_specialist=None,  # No specialist filter
        top_k=5,
        sub_queries=None  # Force single-query mode
    )
    
    # Check if target document + page is in results
    target_doc = gt["source_document"].lower()
    target_page = gt["page_number"]
    target_window = gt.get("allowed_page_window", [target_page - 2, target_page - 1, target_page, target_page + 1, target_page + 2])
    
    found = False
    found_rank = None
    for idx, r in enumerate(simple_results, 1):
        r_doc = r["source"].lower()
        r_pages = set()
        page_str = str(r.get("page", "1"))
        for n in page_str.replace(",", " ").split():
            try: r_pages.add(int(n.strip()))
            except: pass
        
        if r_doc == target_doc and r_pages.intersection(set(target_window)):
            found = True
            found_rank = idx
            break
    
    status = f"✓ Rank {found_rank}" if found else "✗ MISS"
    print(f"[{status}] {tc['test_case_id']}: target={gt['source_document']} p.{target_page} | crime={crime_sub}")
    print(f"  Query: {simple_query[:100]}...")
    for i, r in enumerate(simple_results[:3], 1):
        print(f"  [{i}] {r['source']} p.{r['page']} (score: {r['score']:.4f})")
    print()
