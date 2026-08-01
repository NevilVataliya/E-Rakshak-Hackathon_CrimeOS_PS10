import sys
sys.path.append('/app')
import json
from app.rag.qdrant_client import get_query_embedding, get_qdrant_client, COLLECTION_NAME, compute_bm25_score
from qdrant_client.models import Filter, FieldCondition, MatchValue

client = get_qdrant_client()
# Original: "I am Rohan Sharma, I saw a transaction of 10 lakh rupees in my bank account which was done from my friend Rahul's account. But when I talked to Rahul, he told me that his account was hacked and he didn't know where the money went. I informed my bank and they told me that the money was transferred to a designated person's account. FINANCIAL_FRAUD"

# Stripped Query
query = "transaction designated person account financial fraud freeze funds KYC"

query_vector = get_query_embedding(query)
query_filter = Filter(should=[FieldCondition(key="doc_type", match=MatchValue(value="statute"))])

candidates = client.search(
    collection_name=COLLECTION_NAME,
    query_vector=query_vector,
    query_filter=query_filter,
    limit=300
)

dense_sorted = sorted(candidates, key=lambda x: x.score, reverse=True)
dense_rank_map = {str(pt.id): r for r, pt in enumerate(dense_sorted, 1)}

query_tokens = set(query.lower().split())
sparse_scored = []
for pt in candidates:
    txt = pt.payload.get("text", "").lower()
    c_tokens = txt.split()
    bm25_val = compute_bm25_score(query_tokens, c_tokens)
    sparse_scored.append((str(pt.id), bm25_val))

sparse_sorted = sorted(sparse_scored, key=lambda x: x[1], reverse=True)
sparse_rank_map = {item[0]: r for r, item in enumerate(sparse_sorted, 1)}

rrf_scored = []
for pt in candidates:
    pid = str(pt.id)
    r_dense = dense_rank_map.get(pid, 1000)
    r_sparse = sparse_rank_map.get(pid, 1000)
    rrf_score = (1.0 / (60.0 + r_dense)) + (1.0 / (60.0 + r_sparse))
    rrf_scored.append((pid, rrf_score, r_dense, r_sparse))

rrf_scored.sort(key=lambda x: x[1], reverse=True)

target_id = "0020f55b-f382-d056-9404-1ffc276ece40"
found = False
for idx, item in enumerate(rrf_scored):
    if item[0] == target_id:
        print(f"Target found at RRF Rank {idx+1} | RRF Score: {item[1]} | DenseRank: {item[2]} | SparseRank: {item[3]}")
        found = True
        break

if not found:
    print("Target NOT in RRF candidates!")
