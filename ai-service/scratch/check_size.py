import sys
sys.path.append('/app')
from app.rag.qdrant_client import get_qdrant_client, COLLECTION_NAME
client = get_qdrant_client()
count = client.count(collection_name=COLLECTION_NAME)
print(f"Collection size: {count.count}")
