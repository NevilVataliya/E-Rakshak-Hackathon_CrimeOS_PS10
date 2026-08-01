import sys
sys.path.append('/app')
import json
from app.rag.qdrant_client import get_query_embedding, get_qdrant_client, COLLECTION_NAME
from qdrant_client.models import Filter, FieldCondition, MatchValue

client = get_qdrant_client()
query = "I am Rohan Sharma, I saw a transaction of 10 lakh rupees in my bank account which was done from my friend Rahul's account. But when I talked to Rahul, he told me that his account was hacked and he didn't know where the money went. I informed my bank and they told me that the money was transferred to a designated person's account. FINANCIAL_FRAUD"

query_vector = get_query_embedding(query)
target_specialist = "cyber_financial_intel_specialist"

query_filter = Filter(
    should=[
        FieldCondition(key="target_specialist", match=MatchValue(value=target_specialist)),
        FieldCondition(key="doc_type", match=MatchValue(value="statute"))
    ]
)

res = client.search(
    collection_name=COLLECTION_NAME,
    query_vector=query_vector,
    query_filter=query_filter,
    limit=1000
)

target_id = "0020f55b-f382-d056-9404-1ffc276ece40"
found = False
for i, pt in enumerate(res):
    if str(pt.id) == target_id:
        print(f"Target found at dense rank {i+1} with score {pt.score}")
        found = True
        break
if not found:
    print("Target NOT in top 100 dense results!")
    # let's search it directly to see its dense score vs rank 100
    r2 = client.retrieve(collection_name=COLLECTION_NAME, ids=[target_id], with_vectors=True)
    if r2:
        tv = r2[0].vector
        # compute cosine similarity manually or via qdrant
        print("Target exists in DB.")
