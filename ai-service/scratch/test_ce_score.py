import sys
sys.path.append('/app')
import json
from app.rag.qdrant_client import get_query_embedding, get_qdrant_client, COLLECTION_NAME, get_cross_encoder, compute_bm25_score
from app.rag.query_optimizer import enrich_query_for_universal_rag
from qdrant_client.models import Filter, FieldCondition, MatchValue

client = get_qdrant_client()
query = "I am Rohan Sharma, I saw a transaction of 10 lakh rupees in my bank account which was done from my friend Rahul's account. But when I talked to Rahul, he told me that his account was hacked and he didn't know where the money went. I informed my bank and they told me that the money was transferred to a designated person's account. FINANCIAL_FRAUD"
dense_q = enrich_query_for_universal_rag(query)
target_id = "0020f55b-f382-d056-9404-1ffc276ece40"

r2 = client.retrieve(collection_name=COLLECTION_NAME, ids=[target_id])
txt = r2[0].payload.get("text", "")
print("Target Text:")
print(txt)

ce = get_cross_encoder()
score = ce.predict([[dense_q, txt]])
raw_score = ce.predict([[query, txt]])
print(f"CE Score (Enriched): {score[0]}")
print(f"CE Score (Raw): {raw_score[0]}")
