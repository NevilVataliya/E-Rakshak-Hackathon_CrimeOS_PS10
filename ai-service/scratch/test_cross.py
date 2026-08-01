import sys
sys.path.append('/app')
import json
from app.rag.qdrant_client import search_legal_sops

query = "I am Rohan Sharma, I saw a transaction of 10 lakh rupees in my bank account which was done from my friend Rahul's account. But when I talked to Rahul, he told me that his account was hacked and he didn't know where the money went. I informed my bank and they told me that the money was transferred to a designated person's account. FINANCIAL_FRAUD"

retrieved = search_legal_sops(query, target_specialist="cyber_financial_intel_specialist", top_k=20, use_hyde=True)

target_id = "0020f55b-f382-d056-9404-1ffc276ece40"
found = False
for idx, chunk in enumerate(retrieved):
    if str(chunk.get("id")) == target_id:
        print(f"Target found at FINAL RERANKED rank {idx+1}")
        found = True
        break
if not found:
    print("Target NOT in final top 20!")
