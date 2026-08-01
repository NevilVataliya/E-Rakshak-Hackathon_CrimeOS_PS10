import sys
import os
sys.path.append('/app')
from app.rag.qdrant_client import get_qdrant_client

client = get_qdrant_client()
res = client.scroll(
    collection_name="police_sops_v2",
    scroll_filter=None,
    limit=10,
    with_payload=True
)
for pt in res[0]:
    p = pt.payload
    if 'RBI_Master' in p.get('source', ''):
        print(f"[{pt.id}] Source: {p.get('source')} | Spec: {p.get('target_specialist')} | DocType: {p.get('doc_type')}")
        break
else:
    # scroll more to find it
    res = client.scroll(
        collection_name="police_sops_v2",
        scroll_filter={"must": [{"key": "source", "match": {"value": "RBI_Master_Direction_KYC.pdf"}}]},
        limit=5,
        with_payload=True
    )
    for pt in res[0]:
        p = pt.payload
        print(f"[{pt.id}] Source: {p.get('source')} | Spec: {p.get('target_specialist')} | DocType: {p.get('doc_type')}")
