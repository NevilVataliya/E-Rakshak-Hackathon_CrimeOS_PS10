import os
import sys
import json
import time
import random

# Ensure root directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from qdrant_client import QdrantClient
from config import QDRANT_HOST, QDRANT_PORT, get_agent_llm
from langchain_core.prompts import PromptTemplate

def build_document_grounded_investigation_gold():
    """
    Extracts ground-truth legal sections directly from the official PDFs in Qdrant,
    then uses Gemini/LLM to safely generate a test query while strictly grounding
    the expected answers to the exact text.
    """
    print(f"[+] Connecting to Qdrant vector store at {QDRANT_HOST}:{QDRANT_PORT}...")
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    
    collection = "police_sops_v2" if client.collection_exists("police_sops_v2") else COLLECTION_NAME
    
    scroll_res, _ = client.scroll(
        collection_name=collection,
        limit=2000,
        with_payload=True,
        with_vectors=False
    )
    
    if not scroll_res:
        print("[-] Error: No points found in Qdrant collection!")
        return

    # To ensure varied test cases for Indian police stations:
    target_topics = ["theft", "murder", "rape", "cyber", "missing", "fraud", "assault", "narcotics", "dowry", "scam"]
    selected_chunks = []
    seen_texts = set()
    
    for pt in scroll_res:
        payload = pt.payload or {}
        text = payload.get("text", "")
        source = payload.get("source", "")
        page = payload.get("page", 1)
        
        if len(text) < 150 or text in seen_texts:
            continue
            
        text_lower = text.lower()
        
        # We prefer chunks that mention "section" or are from an SOP
        is_legal_or_sop = "section" in text_lower or "sop" in source.lower()
        
        for topic in target_topics:
            if topic in text_lower and is_legal_or_sop:
                selected_chunks.append({
                    "category": topic,
                    "source": source,
                    "text": text,
                    "page": page
                })
                seen_texts.add(text)
                target_topics.remove(topic) # Try to get diverse ones
                break
                
        if len(selected_chunks) >= 15:
            break

    # If we didn't get enough varied topics, fill up to 15 with random legal chunks
    for pt in scroll_res:
        if len(selected_chunks) >= 15:
            break
        payload = pt.payload or {}
        text = payload.get("text", "")
        if len(text) >= 150 and text not in seen_texts and "section" in text.lower():
            selected_chunks.append({
                "category": "general",
                "source": payload.get("source", ""),
                "text": text,
                "page": payload.get("page", 1)
            })
            seen_texts.add(text)

    print(f"[+] Selected {len(selected_chunks)} chunks for grounded dataset generation.")

    llm = get_agent_llm(temperature=0.1)
    prompt = PromptTemplate.from_template('''
You are an expert Indian legal assistant preparing a test dataset for an AI system.
You are given a raw chunk of text from an official legal document (BNS, BNSS, SOP, etc.).

Your task is to generate EXACTLY ONE realistic police investigation scenario (query) based strictly on this text.
The query should sound like a citizen reporting this crime at a police station in Surat, Gujarat.

Then, extract the exact legal sections, SOP procedures, or evidence requirements mentioned IN THIS TEXT.
Do NOT hallucinate or add any sections or procedures that are not explicitly stated in the provided text.

Text chunk from {source} (Page {page}):
"""
{text}
"""

Output a JSON object with this exact structure:
{{
  "query": "A detailed, realistic scenario of a citizen reporting this crime at a police station in Surat, Gujarat.",
  "expected_specialists": ["List of relevant specialist agents, e.g., 'Legal Agent', 'Cyber Crime Specialist'"],
  "expected_legal_sections": ["Short section codes mentioned in text, e.g., 'Section 303 BNS', 'Section 157 CrPC'"],
  "expected_sop_procedures": ["Concise 2-4 word key action phrases mentioned in text, e.g., 'shelter home', 'within 24 hours', 'woman officer', 'debit freeze', 'seize hard drive'"],
  "expected_evidence_requirements": ["Short key evidence items mentioned in text"]
}}

If no legal sections are in the text, leave the list empty []. Same for SOPs and Evidence.
Ensure the JSON is valid and do not output markdown code blocks. Just the raw JSON object.
''')

    dataset = []
    for i, chunk in enumerate(selected_chunks):
        print(f"[*] Generating test case {i+1}/{len(selected_chunks)} from {chunk['source']}")
        chain = prompt | llm
        try:
            response = chain.invoke({"source": chunk["source"], "page": chunk["page"], "text": chunk["text"]})
            content = response.content.strip()
            
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            case_data = json.loads(content.strip())
            
            # Ground it with metadata
            case_data["id"] = f"INV-GRND-{i+1:03d}"
            case_data["grounded_source"] = chunk["source"]
            case_data["grounded_page"] = chunk["page"]
            case_data["grounded_text"] = chunk["text"][:200] + "..."
            
            dataset.append(case_data)
            
            print("    [!] Sleeping for 5 seconds to respect rate limits...")
            time.sleep(5)
            
        except Exception as e:
            print(f"[-] Error parsing response for chunk {i+1}: {e}")

    final_dataset = {
        "benchmark_metadata": {
            "version": "1.0",
            "created_at": time.strftime("%Y-%m-%d"),
            "description": "100% Grounded Gold standard dataset for evaluating CrimeOS Investigation Path Quality",
            "total_test_cases": len(dataset)
        },
        "test_cases": dataset
    }

    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval_dataset", "investigation_gold.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_dataset, f, indent=4)
        
    print(f"\n[+] Successfully generated {len(dataset)} 100% grounded test cases at {output_path}")

if __name__ == "__main__":
    build_document_grounded_investigation_gold()
