import os
import sys
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client

def inspect_gpm_target_chunks():
    client = get_qdrant_client()
    
    scroll_resp, _ = client.scroll(
        collection_name="police_sops_universal",
        limit=10000,
        with_payload=True,
        with_vectors=False
    )
    
    print("=========================================================================")
    print("[*] INSPECTING EXACT CHUNK PAYLOADS IN QDRANT FOR GUJARAT POLICE MANUAL TARGETS")
    print("=========================================================================\n")

    target_pages = [496, 26, 430, 271, 402, 414, 304, 481, 212, 46]

    for page_num in target_pages:
        matching = []
        for pt in scroll_resp:
            payload = pt.payload or {}
            source = str(payload.get("source", "")).lower()
            if "gujarat" in source or "gpm" in source:
                p_str = str(payload.get("page", ""))
                pages = [int(p.strip()) for p in p_str.split(",") if p.strip().isdigit()]
                if page_num in pages:
                    matching.append(pt)

        print(f"--- TARGET PAGE {page_num} in THE_GUJARAT_POLICE_MANUAL.pdf ---")
        if not matching:
            print("  ❌ NO MATCHING CHUNK FOUND IN QDRANT!")
        else:
            for idx, pt in enumerate(matching, 1):
                payload = pt.payload or {}
                text = payload.get("text", "")
                print(f"  [Chunk {idx}] Point ID: {pt.id}")
                print(f"            Granularity: {payload.get('granularity', 'N/A')}")
                print(f"            Parent ID:   {payload.get('parent_id', 'N/A')}")
                print(f"            Page Field:  {payload.get('page', 'N/A')}")
                print(f"            Text Length: {len(text)}")
                print(f"            Text Snippet: \"{text[:200]}...\"\n")

if __name__ == "__main__":
    inspect_gpm_target_chunks()
