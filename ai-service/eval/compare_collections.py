"""Compare chunk text format between police_sops, police_sops_v2, and police_sops_v3"""
import os, sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT

client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

target_doc = "BNSS_Procedural_Code_2023.pdf"
target_page = 39

for col in ["police_sops", "police_sops_v2", "police_sops_v3"]:
    info = client.get_collection(col)
    print(f"\n{'='*60}")
    print(f"Collection: {col} ({info.points_count} points)")
    print(f"Looking for {target_doc} near page {target_page}")
    print(f"{'='*60}")
    
    # Scroll all points (paginated)
    all_pts = []
    offset = None
    while True:
        pts, next_offset = client.scroll(
            col, limit=500, offset=offset, with_payload=True, with_vectors=False
        )
        all_pts.extend(pts)
        if next_offset is None or len(pts) == 0:
            break
        offset = next_offset
    
    matches = []
    for p in all_pts:
        src = p.payload.get("source", "")
        page_str = str(p.payload.get("page", ""))
        if src == target_doc:
            pages = set()
            for n in page_str.replace(",", " ").split():
                try: pages.add(int(n.strip()))
                except: pass
            if pages.intersection({38, 39, 40}):
                matches.append(p)
    
    if matches:
        for m in matches[:2]:
            text = m.payload.get("text", "")
            print(f"\n  ID: {m.id}")
            print(f"  Page: {m.payload.get('page')}")
            print(f"  Specialist: {m.payload.get('target_specialist')}")
            print(f"  Text (first 400 chars):")
            print(f"  {text[:400]}")
            print(f"  --- (total {len(text)} chars, ~{len(text.split())} words) ---")
    else:
        print(f"  No chunks found covering pages 38-40")
