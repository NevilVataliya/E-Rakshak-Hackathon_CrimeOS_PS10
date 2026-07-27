"""
Crime OS AI — Eval Ingestion Script v3

Mirrors the production ingestion script (database/ingest_pdfs.py) for evaluation purposes.
Uses parent-only 1024-token chunks with lightweight inline metadata.
"""

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

# --- CONFIGURATION ---
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "police_sops")
TRACKING_FILE = f"ingested_history_{COLLECTION_NAME}.json"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOCS_DIR = os.path.join(BASE_DIR, "database", "doc")

QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant" if os.getenv("PORT") else "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

EMBEDDING_MODEL = "bge-m3:latest"
CHUNK_MAX_TOKENS = 1024
BATCH_SIZE = 100
MAX_EMBEDDING_THREADS = 4

# Specialist domain auto-detection map
SPECIALIST_MAP = {
    "IT_Act": "cyber_financial_intel_specialist",
    "CFCFRMS": "cyber_financial_intel_specialist",
    "Cryptocurrency": "cyber_financial_intel_specialist",
    "BPRD": "cyber_financial_intel_specialist",
    "Telecommunications": "cyber_financial_intel_specialist",
    "DPDP": "cyber_financial_intel_specialist",
    "RBI": "cyber_financial_intel_specialist",
    "BNS": "bns_specialist",
    "Penal": "bns_specialist",
    "BSA": "bsa_specialist",
    "Evidence": "bsa_specialist",
    "Sakshya": "bsa_specialist",
    "BNSS": "bns_specialist",
    "Procedural": "bns_specialist",
    "Suraksha": "bns_specialist",
    "Gujarat_Police": "conventional_field_specialist",
    "MISSING_CHILD": "conventional_field_specialist",
    "POCSO": "conventional_field_specialist",
    "SOP_Investigation": "conventional_field_specialist",
    "SOP_Ranking": "conventional_field_specialist",
    "First_Responder": "conventional_field_specialist",
    "FAQ": "cyber_financial_intel_specialist",
}

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

def determine_specialist(filename: str) -> str:
    for pattern, specialist in SPECIALIST_MAP.items():
        if pattern.lower() in filename.lower():
            return specialist
    return "bns_specialist"

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

def parse_single_pdf(pdf_file: str, docs_dir: str) -> Tuple[str, List[str], List[Dict[str, Any]]]:
    pdf_path = os.path.join(docs_dir, pdf_file)
    doc_type = determine_doc_type(pdf_file)
    specialist = determine_specialist(pdf_file)
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
        chunker = HybridChunker(tokenizer=tokenizer, max_tokens=CHUNK_MAX_TOKENS)

        conversion_result = converter.convert(pdf_path)
        parent_chunks = list(chunker.chunk(dl_doc=conversion_result.document))

        for idx, chunk in enumerate(parent_chunks):
            headings = [h.strip() for h in chunk.meta.headings] if hasattr(chunk.meta, 'headings') and chunk.meta.headings else []
            headings_path = " > ".join(headings) if headings else "General Legal Provisions"
            page_str = extract_pages(chunk)

            # Lightweight inline tag
            inline_tag = f"[Source: {pdf_file}, Page: {page_str}]"
            chunk_with_tag = f"{inline_tag}\n{chunk.text}"

            chunks.append(chunk_with_tag)
            metadatas.append({
                "source": pdf_file,
                "document_title": document_title,
                "doc_type": doc_type,
                "page": page_str,
                "section_path": headings_path,
                "target_specialist": specialist,
                "chunk_index": idx,
                "clean_text": chunk.text
            })
        print(f"       [+] Worker Parsed '{pdf_file}': {len(chunks)} parent chunks compiled.")
    except Exception as exc:
        print(f"       [-] Worker Error parsing {pdf_file}: {exc}")

    return pdf_file, chunks, metadatas

_st_model = None
_model_lock = threading.Lock()

def get_bge_model():
    global _st_model
    if _st_model is None:
        with _model_lock:
            if _st_model is None:
                model_cache_dir = os.getenv("MODEL_CACHE_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models_cache"))
                hf_token = os.getenv("HF_TOKEN", "")
                print(f"[*] Loading SentenceTransformer ('BAAI/bge-m3') from cache '{model_cache_dir}'...")
                from sentence_transformers import SentenceTransformer
                st_kwargs = {'cache_folder': model_cache_dir}
                if hf_token:
                    st_kwargs['token'] = hf_token
                _st_model = SentenceTransformer("BAAI/bge-m3", **st_kwargs)
    return _st_model

def process_embedding_batch(qdrant_client, batch_chunks, batch_meta):
    try:
        model = get_bge_model()
        batch_vectors = model.encode(batch_chunks, show_progress_bar=False).tolist()

        points = []
        for chunk, meta, vector in zip(batch_chunks, batch_meta, batch_vectors):
            meta['text'] = chunk
            unique_string = f"{meta['source']}_{meta['page']}_{chunk}"
            md5_hash = hashlib.md5(unique_string.encode('utf-8')).hexdigest()
            valid_uuid = str(uuid.UUID(hex=md5_hash))
            points.append(PointStruct(id=valid_uuid, vector=vector, payload=meta))

        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
        return len(points)
    except Exception as e:
        print(f"[-] Embedding/Upsert Error: {e}")
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
    print(f"\n[*] PARENT-ONLY INGESTION FOR '{COLLECTION_NAME}': Indexing {len(new_pdf_files)} legal files.")

    all_chunks, all_metadatas = [], []

    print(f"[*] Booting Parallel Document Parsers...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(new_pdf_files))) as executor:
        futures = {executor.submit(parse_single_pdf, pdf_file, docs_dir): pdf_file for pdf_file in new_pdf_files}
        for future in concurrent.futures.as_completed(futures):
            pdf_file, chunks, metadatas = future.result()
            all_chunks.extend(chunks)
            all_metadatas.extend(metadatas)

    total_payloads = len(all_chunks)
    if total_payloads == 0:
        print("[-] No new text elements extracted. Aborting sync.")
        return

    if not qdrant_client.collection_exists(COLLECTION_NAME):
        print(f"\n[*] Creating collection '{COLLECTION_NAME}'...")
        sample_vec = ollama.embed(model=EMBEDDING_MODEL, input=all_chunks[0])['embeddings'][0]
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=len(sample_vec), distance=Distance.COSINE)
        )

    print(f"\n[*] Embedding {total_payloads} parent chunks in batches of {BATCH_SIZE}...")
    processed_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_EMBEDDING_THREADS) as executor:
        futures = []
        for i in range(0, total_payloads, BATCH_SIZE):
            batch_chunks = all_chunks[i:i + BATCH_SIZE]
            batch_meta = all_metadatas[i:i + BATCH_SIZE]
            futures.append(executor.submit(process_embedding_batch, qdrant_client, batch_chunks, batch_meta))

        for future in concurrent.futures.as_completed(futures):
            processed = future.result()
            processed_count += processed
            print(f"    -> Progress: {processed_count}/{total_payloads} parent chunks in '{COLLECTION_NAME}'.")

    save_ingested_files(new_pdf_files)
    print(f"\n[+] SUCCESS! All {len(new_pdf_files)} legal files ingested into '{COLLECTION_NAME}' ({processed_count} chunks)!")

if __name__ == "__main__":
    ingest_all_docs()
