"""Check duplicate chunks in police_sops collection"""
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

pts, _ = client.scroll('police_sops', limit=1000, with_payload=True, with_vectors=False)
print(f"Total scrolled: {len(pts)}")

page_counts = {}
for p in pts:
    key = (p.payload.get("source"), str(p.payload.get("page")))
    page_counts[key] = page_counts.get(key, 0) + 1

duplicates = {k: v for k, v in page_counts.items() if v > 1}
print(f"Found {len(duplicates)} duplicate document-page keys out of {len(page_counts)} unique keys!")
for k, v in list(duplicates.items())[:10]:
    print(f"  {k[0]} p.{k[1]}: {v} copies")
