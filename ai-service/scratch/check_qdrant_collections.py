import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.rag.qdrant_client import get_qdrant_client

def check_collections():
    client = get_qdrant_client()
    cols = client.get_collections().collections
    col_names = [c.name for c in cols]
    
    print("=========================================================================")
    print("[*] QDRANT COLLECTIONS CURRENTLY PRESENT:")
    print("=========================================================================")
    for c in col_names:
        info = client.get_collection(collection_name=c)
        print(f"  • Collection: '{c}' | Points Count: {info.points_count} | Vectors Count: {info.indexed_vectors_count}")
    print("=========================================================================\n")

if __name__ == "__main__":
    check_collections()
