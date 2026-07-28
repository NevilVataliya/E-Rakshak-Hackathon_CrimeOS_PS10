import os
import re
import uuid
import hashlib
import ollama
import concurrent.futures
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple

from qdrant_client.models import PointStruct, VectorParams, Distance
from qdrant_client import QdrantClient

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, AcceleratorOptions
from docling.chunking import HybridChunker
from transformers import AutoTokenizer

# --- ZERO-HARDCODE HIGH-PERFORMANCE UNIVERSAL CONFIGURATION ---
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "police_sops_v2")
TRACKING_FILE = f"ingested_history_{COLLECTION_NAME}.json"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS_DIR = os.path.join(BASE_DIR, "database", "doc")

QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant" if os.getenv("PORT") else "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

EMBEDDING_MODEL = "bge-m3:latest"
PARENT_CHUNK_TOKENS = 1024
CHILD_CHUNK_TOKENS = 128
BATCH_SIZE = 100
MAX_EMBEDDING_THREADS = 4

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

def extract_pages(chunk) -> str:
    pages = set()
    try:
        if hasattr(chunk.meta, 'doc_items'):
            for item in chunk.meta.doc_items:
                if hasattr(item, 'prov') and item.prov:
                    for p in item.prov:
                        if hasattr(p, 'page_no'):
                            pages.add(p.page_no)
    except Exception:
        pass
    return ", ".join(str(p) for p in sorted(pages)) if pages else "1"

def split_parent_into_children(parent_text: str, child_word_size: int = 40) -> List[str]:
    words = parent_text.split()
    if len(words) <= child_word_size:
        return [parent_text]
        
    children = []
    step = max(15, child_word_size // 2)
    for i in range(0, len(words), step):
        child_words = words[i:i + child_word_size]
        if len(child_words) >= 10:
            children.append(" ".join(child_words))
    return children if children else [parent_text]

def parse_single_pdf(pdf_file: str, docs_dir: str) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    pdf_path = os.path.join(docs_dir, pdf_file)
    doc_type = determine_doc_type(pdf_file)
    document_title = pdf_file.replace(".pdf", "").replace("_", " ")
    
    chunks, metadatas = [], []
    try:
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(num_threads=1)
        converter = DocumentConverter(
            allowed_formats=[InputFormat.PDF],
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
        )
        tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-m3")
        parent_chunker = HybridChunker(tokenizer=tokenizer, max_tokens=PARENT_CHUNK_TOKENS)

        conversion_result = converter.convert(pdf_path)
        parent_chunks = list(parent_chunker.chunk(dl_doc=conversion_result.document))

        for p_idx, p_chunk in enumerate(parent_chunks):
            headings = [h.strip() for h in p_chunk.meta.headings] if hasattr(p_chunk.meta, 'headings') and p_chunk.meta.headings else []
            headings_path = " > ".join(headings) if headings else "General Legal Provisions"
            page_str = extract_pages(p_chunk)
            
            parent_id = f"{pdf_file}_P{p_idx:04d}_pg{page_str}"
            parent_full_text = f"[Document: {document_title} | Section: {headings_path} | Page: {page_str}]\n{p_chunk.text}"
            
            child_texts = split_parent_into_children(p_chunk.text)
            
            for c_idx, c_text in enumerate(child_texts):
                child_formatted_payload = f"[Source: {pdf_file}, Page: {page_str}, Section: {headings_path}]\n{c_text}"
                chunks.append(child_formatted_payload)
                metadatas.append({
                    "source": pdf_file,
                    "document_title": document_title,
                    "doc_type": doc_type,
                    "page": page_str,
                    "section_path": headings_path,
                    "parent_id": parent_id,
                    "parent_text": parent_full_text,
                    "granularity": "child_128t",
                    "child_index": c_idx
                })
        print(f"       [+] Worker Parsed '{pdf_file}': {len(chunks)} Child Vectors compiled.")
    except Exception as exc:
        print(f"       [-] Worker Error parsing {pdf_file}: {exc}")

    return pdf_file, chunks, metadatas

def process_embedding_batch(qdrant_client, batch_chunks, batch_meta):
    try:
        response = ollama.embed(model=EMBEDDING_MODEL, input=batch_chunks)
        batch_vectors = response['embeddings']
        
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
        print(f"[-] Ollama Embedding/Upsert Error: {e}")
        return 0

def ingest_all_docs(docs_dir=DOCS_DIR):
    if not os.path.exists(docs_dir):
        print(f"[-] Directory '{docs_dir}' not found at '{docs_dir}'.")
        return
        
    all_pdf_files = [f for f in os.listdir(docs_dir) if f.lower().endswith('.pdf')]
    if not all_pdf_files:
        print(f"[-] No valid PDFs found in '{docs_dir}'.")
        return

    ingested_files = get_ingested_files()
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

    if not qdrant_client.collection_exists(COLLECTION_NAME):
        print(f"\n[*] Creating pristine target collection '{COLLECTION_NAME}'...")
        sample_vec = ollama.embed(model=EMBEDDING_MODEL, input=all_child_chunks[0])['embeddings'][0]
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=len(sample_vec), distance=Distance.COSINE)
        )
    else:
        print(f"\n[*] Target collection detected. Appending updates to '{COLLECTION_NAME}'...")

    print(f"\n[*] HIGH-THROUGHPUT PARALLEL EMBEDDING: Processing {total_payloads} child vectors in batches of {BATCH_SIZE}...")
    processed_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_EMBEDDING_THREADS) as executor:
        futures = []
        for i in range(0, total_payloads, BATCH_SIZE):
            batch_chunks = all_child_chunks[i:i + BATCH_SIZE]
            batch_meta = all_child_metadatas[i:i + BATCH_SIZE]
            futures.append(executor.submit(process_embedding_batch, qdrant_client, batch_chunks, batch_meta))
            
        for future in concurrent.futures.as_completed(futures):
            processed = future.result()
            processed_count += processed
            print(f"    -> Progress: {processed_count}/{total_payloads} child vectors secured in Qdrant '{COLLECTION_NAME}'.")

    save_ingested_files(new_pdf_files)
    print(f"\n[+] SUCCESS! All {len(new_pdf_files)} legal files ingested into pristine collection '{COLLECTION_NAME}' with Multi-Core Parallel Acceleration!")

if __name__ == "__main__":
    ingest_all_docs()
