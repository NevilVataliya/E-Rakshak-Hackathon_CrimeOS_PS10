import os
import re
import uuid
import hashlib
import concurrent.futures
import json
import fitz  # PyMuPDF
from pathlib import Path
from typing import List, Dict, Any, Tuple

from qdrant_client.models import PointStruct, VectorParams, Distance
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

# --- ZERO-HARDCODE HIGH-PERFORMANCE UNIVERSAL CONFIGURATION ---
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "police_sops_v2")
TRACKING_FILE = f"ingested_history_{COLLECTION_NAME}.json"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "database", "doc")
if not os.path.exists(DOCS_DIR):
    alt_docs = os.path.join(os.path.dirname(BASE_DIR), "database", "doc")
    if os.path.exists(alt_docs):
        DOCS_DIR = alt_docs

QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant" if os.getenv("PORT") else "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/app/models_cache")

BATCH_SIZE = 100
MAX_EMBEDDING_THREADS = 4

_embed_model = None

def get_embed_model():
    global _embed_model
    if _embed_model is None:
        print(f"[*] Initializing SentenceTransformer ('BAAI/bge-m3') for universal PDF ingestion...")
        _embed_model = SentenceTransformer("BAAI/bge-m3", cache_folder=MODEL_CACHE_DIR)
    return _embed_model

def get_ingested_files():
    tracking_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), TRACKING_FILE)
    if os.path.exists(tracking_path):
        try:
            with open(tracking_path, 'r') as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_ingested_files(processed_files: list):
    tracking_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), TRACKING_FILE)
    ingested = get_ingested_files()
    ingested.update(processed_files)
    with open(tracking_path, 'w') as f:
        json.dump(list(ingested), f)

def determine_doc_type(filename: str) -> str:
    fname = filename.upper()
    if any(x in fname for x in ["ACT", "CODE", "SANHITA", "ADHINIYAM"]): return "statute"
    if any(x in fname for x in ["SOP", "HANDBOOK", "MANUAL", "CIRCULAR", "DIRECTION", "FAQ", "GUIDELINE"]): return "sop"
    return "legal_document"

def determine_target_specialist(filename: str) -> str:
    fname = filename.upper()
    if any(x in fname for x in ["BSA", "EVIDENCE", "CERTIFICATE"]):
        return "bsa_specialist"
    if any(x in fname for x in ["CFCFRMS", "CYBER", "CRYPTO", "FINANCIAL", "IT_ACT", "FAQ", "DPDP", "TELECOMMUNICATIONS", "KYC", "LIABILITY"]):
        return "cyber_financial_intel_specialist"
    if any(x in fname for x in ["BNS_", "BNS.", "PENAL", "OFFENCE", "CRIME"]):
        return "bns_specialist"
    return "conventional_field_specialist"

def split_parent_into_children(parent_text: str, child_word_size: int = 120) -> List[str]:
    words = parent_text.split()
    if len(words) <= child_word_size:
        return [parent_text]
        
    children = []
    step = max(40, child_word_size - 30)
    for i in range(0, len(words), step):
        child_words = words[i:i + child_word_size]
        if len(child_words) >= 20:
            children.append(" ".join(child_words))
    return children if children else [parent_text]

def parse_single_pdf(pdf_file: str, docs_dir: str) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    pdf_path = os.path.join(docs_dir, pdf_file)
    doc_type = determine_doc_type(pdf_file)
    target_specialist = determine_target_specialist(pdf_file)
    document_title = pdf_file.replace(".pdf", "").replace("_", " ")
    
    chunks, metadatas = [], []
    try:
        doc = fitz.open(pdf_path)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_num = page_idx + 1
            page_text = page.get_text("text").strip()
            if len(page_text) < 50:
                continue

            page_str = str(page_num)
            parent_id = f"{pdf_file}_P{page_num:04d}"
            parent_full_text = f"[Document: {document_title} | Page: {page_str}]\n{page_text}"

            child_texts = split_parent_into_children(page_text)

            for c_idx, c_text in enumerate(child_texts):
                child_formatted_payload = f"[Source: {pdf_file}, Page: {page_str}]\n{c_text}"
                chunks.append(child_formatted_payload)
                metadatas.append({
                    "source": pdf_file,
                    "document_title": document_title,
                    "doc_type": doc_type,
                    "target_specialist": target_specialist,
                    "page": page_str,
                    "section_path": f"Page {page_str}",
                    "parent_id": parent_id,
                    "parent_text": parent_full_text,
                    "granularity": "child_128t",
                    "child_index": c_idx
                })
        print(f"       [+] Worker Parsed '{pdf_file}': {len(chunks)} Child Vectors compiled ({target_specialist}).")
    except Exception as exc:
        print(f"       [-] Worker Error parsing {pdf_file}: {exc}")

    return pdf_file, chunks, metadatas

def process_embedding_batch(qdrant_client, batch_chunks, batch_meta):
    try:
        model = get_embed_model()
        batch_vectors = model.encode(batch_chunks).tolist()
        
        points = []
        for chunk, meta, vector in zip(batch_chunks, batch_meta, batch_vectors):
            meta['text'] = chunk
            unique_string = f"{meta['source']}_{meta['page']}_{meta['parent_id']}_{chunk}"
            md5_hash = hashlib.md5(unique_string.encode('utf-8')).hexdigest()
            valid_uuid = str(uuid.UUID(hex=md5_hash))
            points.append(PointStruct(id=valid_uuid, vector=vector, payload=meta))
            
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
        return len(points)
    except Exception as e:
        print(f"[-] SentenceTransformer Embedding/Upsert Error: {e}")
        return 0

def ingest_all_docs(docs_dir=DOCS_DIR, force_reingest=False):
    if not os.path.exists(docs_dir):
        print(f"[-] Directory '{docs_dir}' not found at '{docs_dir}'.")
        return
        
    all_pdf_files = [f for f in os.listdir(docs_dir) if f.lower().endswith('.pdf')]
    if not all_pdf_files:
        print(f"[-] No valid PDFs found in '{docs_dir}'.")
        return

    ingested_files = get_ingested_files() if not force_reingest else set()
    new_pdf_files = [f for f in all_pdf_files if f not in ingested_files]
    
    if not new_pdf_files:
        print(f"\n[+] No new PDFs detected. Collection '{COLLECTION_NAME}' is fully synchronized!")
        return

    qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    print(f"\n[*] MULTI-CORE PARALLEL SYNC FOR '{COLLECTION_NAME}': Indexing {len(new_pdf_files)} legal files.")
    
    all_child_chunks, all_child_metadatas = [], []

    print(f"[*] Booting Parallel Document Parsers across CPU cores...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(new_pdf_files))) as executor:
        futures = {executor.submit(parse_single_pdf, pdf_file, docs_dir): pdf_file for pdf_file in new_pdf_files}
        for future in concurrent.futures.as_completed(futures):
            pdf_file, chunks, metadatas = future.result()
            all_child_chunks.extend(chunks)
            all_child_metadatas.extend(metadatas)

    total_payloads = len(all_child_chunks)
    if total_payloads == 0:
        print("[-] No new text elements extracted. Aborting sync.")
        return

    model = get_embed_model()
    sample_vec = model.encode(all_child_chunks[0]).tolist()

    if force_reingest and qdrant_client.collection_exists(COLLECTION_NAME):
        print(f"\n[*] Resetting existing collection '{COLLECTION_NAME}' for clean sync...")
        qdrant_client.delete_collection(COLLECTION_NAME)

    if not qdrant_client.collection_exists(COLLECTION_NAME):
        print(f"\n[*] Creating pristine target collection '{COLLECTION_NAME}' (Vector dim: {len(sample_vec)})...")
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=len(sample_vec), distance=Distance.COSINE)
        )
    else:
        print(f"\n[*] Target collection detected. Appending updates to '{COLLECTION_NAME}'...")

    print(f"\n[*] HIGH-THROUGHPUT EMBEDDING & UPSERT: Processing {total_payloads} child vectors in batches of {BATCH_SIZE}...")
    processed_count = 0
    for i in range(0, total_payloads, BATCH_SIZE):
        batch_chunks = all_child_chunks[i:i + BATCH_SIZE]
        batch_meta = all_child_metadatas[i:i + BATCH_SIZE]
        processed = process_embedding_batch(qdrant_client, batch_chunks, batch_meta)
        processed_count += processed
        print(f"    -> Progress: {processed_count}/{total_payloads} child vectors secured in Qdrant '{COLLECTION_NAME}'.")

    save_ingested_files(new_pdf_files)
    print(f"\n[+] SUCCESS! All {len(new_pdf_files)} legal files ingested into pristine collection '{COLLECTION_NAME}'!")

if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    ingest_all_docs(force_reingest=force)

