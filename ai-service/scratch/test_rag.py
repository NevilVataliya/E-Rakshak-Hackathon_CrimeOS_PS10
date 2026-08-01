import sys
import os

sys.path.append('/app')

from app.rag.qdrant_client import search_legal_sops

query = "Respected Sir, I am running a telecommunications distribution and internet service business here in Surat, Gujarat. Recently, there has been a major security breach and unauthorized intrusion into our telecom network services, threatening public safety and network security. Furthermore, some entities are flouting the notified standards for telecommunication equipment and encryption processing. We need urgent action and investigation under the relevant provisions of the Telecommunications Act, 2023 regarding standards, public safety, and network protection."
specialist = "Legal Agent"

results = search_legal_sops(query=query, target_specialist=specialist, top_k=20)
for r in results:
    print(f"[{r['id']}] Score: {r['score']} | DenseRank: {r['dense_rank']} | SparseRank: {r['sparse_rank']} | Spec: {r.get('target_specialist')} | Source: {r.get('source')} | Page: {r.get('page')}")
