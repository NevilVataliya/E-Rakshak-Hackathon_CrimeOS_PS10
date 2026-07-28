import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client

def cleanup_collections():
    client = get_qdrant_client()
    stale_collections = ["police_sops", "police_sops_v2", "police_sops_v3"]
    
    print("=========================================================================")
    print("[*] CLEANING UP OBSOLETE QDRANT COLLECTIONS...")
    print("=========================================================================")

    for col in stale_collections:
        try:
            client.delete_collection(collection_name=col)
            print(f"  [✓] Deleted obsolete collection '{col}' successfully.")
        except Exception as e:
            print(f"  [!] Collection '{col}' deletion warning: {e}")

    cols = client.get_collections().collections
    print("\n=========================================================================")
    print("[*] REMAINING ACTIVE COLLECTIONS IN QDRANT:")
    print("=========================================================================")
    for c in cols:
        info = client.get_collection(collection_name=c.name)
        print(f"  • Collection: '{c.name}' | Points Count: {info.points_count} | Vectors Count: {info.indexed_vectors_count}")
    print("=========================================================================\n")

if __name__ == "__main__":
    cleanup_collections()
