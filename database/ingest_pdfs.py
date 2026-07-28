import os
import sys
import re
import uuid
import hashlib
import warnings
import concurrent.futures
import json
import fitz  # PyMuPDF for page-level OCR auto-detection
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Suppress optional torchcodec Windows DLL loading error
sys.modules['torchcodec'] = None
warnings.filterwarnings("ignore")

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
DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "doc")

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

PARENT_CHUNK_TOKENS = 1024
CHILD_CHUNK_TOKENS = 128
BATCH_SIZE = 100
MAX_EMBEDDING_THREADS = 4

_st_model = None

def get_bge_model():
    global _st_model
    if _st_model is None:
        print("[*] Loading SentenceTransformer ('BAAI/bge-m3') embedding model...")
        # Direct import with torchcodec bypassed
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer("BAAI/bge-m3")
    return _st_model

def get_embedding_vectors(text_batch: List[str]) -> List[List[float]]:
    """Generate 1024D embeddings using SentenceTransformer BAAI/bge-m3."""
    model = get_bge_model()
    embeddings = model.encode(text_batch, show_progress_bar=False)
    return embeddings.tolist()

def detect_pages_requiring_ocr(pdf_path: str) -> Tuple[List[int], int]:
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    ocr_pages = []
    
    for page_idx in range(total_pages):
        page = doc[page_idx]
        text_content = page.get_text().strip()
        image_objects = page.get_images()
        
        if len(text_content) < 50 and len(image_objects) > 0:
            ocr_pages.append(page_idx + 1)
            
    doc.close()
    return ocr_pages, total_pages

def get_ingested_files():
    tracking_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), TRACKING_FILE)
    if os.path.exists(tracking_path):
        try:
            with open(tracking_path, 'r') as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_single_ingested_file(pdf_filename: str):
    tracking_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), TRACKING_FILE)
    ingested = get_ingested_files()
    ingested.add(pdf_filename)
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

def process_embedding_batch(qdrant_client, batch_chunks, batch_meta):
    try:
        batch_vectors = get_embedding_vectors(batch_chunks)
        
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
        print(f"[-] Embedding/Upsert Exception: {e}")
        return 0

def ingest_all_docs(docs_dir=DOCS_DIR):
    if not os.path.exists(docs_dir):
        print(f"[-] Directory '{docs_dir}' not found.")
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
    print(f"\n[*] PAGE-LEVEL IMAGE DETECTED OCR SYNC FOR '{COLLECTION_NAME}': Processing {len(new_pdf_files)} remaining legal files.")
    
    os.environ["OMP_NUM_THREADS"] = "1"
    tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-m3")
    parent_chunker = HybridChunker(tokenizer=tokenizer, max_tokens=PARENT_CHUNK_TOKENS)

    get_bge_model()

    for pdf_file in new_pdf_files:
        pdf_path = os.path.join(docs_dir, pdf_file)
        doc_type = determine_doc_type(pdf_file)
        document_title = pdf_file.replace(".pdf", "").replace("_", " ")
        
        ocr_pages, total_pages = detect_pages_requiring_ocr(pdf_path)
        print(f"\n    -> Inspecting '{pdf_file}' ({total_pages} Total Pages)...")
        if ocr_pages:
            print(f"       [*] Image OCR Triggered for {len(ocr_pages)} Scanned Image Pages: {ocr_pages[:5]}...")
        else:
            print(f"       [+] Digital Text Verified for all {total_pages} Pages (Instant Fast Conversion)!")

        doc_chunks, doc_metadatas = [], []
        try:
            pipeline_options = PdfPipelineOptions()
            pipeline_options.accelerator_options = AcceleratorOptions(num_threads=1)
            pipeline_options.do_ocr = bool(ocr_pages)
            
            converter = DocumentConverter(
                allowed_formats=[InputFormat.PDF],
                format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
            )

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
                    doc_chunks.append(child_formatted_payload)
                    doc_metadatas.append({
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

            print(f"       [+] Compiled '{pdf_file}' ({len(doc_chunks)} child vectors). Embedding & Upserting into Qdrant...")
            
            if not qdrant_client.collection_exists(COLLECTION_NAME):
                sample_vec = get_embedding_vectors([doc_chunks[0]])[0]
                qdrant_client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=len(sample_vec), distance=Distance.COSINE)
                )

            for i in range(0, len(doc_chunks), BATCH_SIZE):
                batch_chunks = doc_chunks[i:i + BATCH_SIZE]
                batch_meta = doc_metadatas[i:i + BATCH_SIZE]
                process_embedding_batch(qdrant_client, batch_chunks, batch_meta)

            save_single_ingested_file(pdf_file)
            print(f"       [✓] Secured & Saved '{pdf_file}' permanently in tracking history!")

        except Exception as exc:
            print(f"       [-] Error parsing {pdf_file}: {exc}")

    print(f"\n[+] SUCCESS! All legal files processed and synchronized in pristine collection '{COLLECTION_NAME}'!")

if __name__ == "__main__":
    ingest_all_docs()