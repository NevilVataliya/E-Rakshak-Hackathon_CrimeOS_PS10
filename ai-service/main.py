import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.ingestion.smart_router import process_multimodal_complaint
from app.agents.orchestrator import investigation_graph
from app.rag.qdrant_client import search_legal_sops
from app.analytics.response_agent import analyze_large_provider_csv

app = FastAPI(
    title="Crime OS AI — Intelligence Backend Service",
    description="Agentic AI Platform for Intelligence-led Police Investigations",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
PDF_DIR = os.path.join(os.getcwd(), "generated_pdfs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PDF_DIR, exist_ok=True)

class ComplaintTextRequest(BaseModel):
    raw_text: str
    language: Optional[str] = "auto"
    officer_id: Optional[str] = "io_patel"

class InvestigationRequest(BaseModel):
    case_number: str
    complaint_text: str
    crime_category: Optional[str] = "CYBER"
    crime_sub_type: Optional[str] = None
    entities: Optional[Dict[str, Any]] = None

class ResponseParseRequest(BaseModel):
    file_path: Optional[str] = None
    response_type: Optional[str] = "CDR"

@app.get("/health")
def health_check():
    return {"status": "online", "service": "Crime OS AI Backend", "engine": "FastAPI + LangGraph + Pandas Analytics"}

@app.post("/api/ingest")
async def ingest_complaint(
    input_type: str = Form("text"),
    raw_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    file_path = None
    if file:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

    result = process_multimodal_complaint(
        file_path=file_path,
        raw_text=raw_text,
        input_type=input_type
    )
    return result

@app.post("/api/investigate")
async def run_investigation(req: InvestigationRequest):
    initial_state = {
        "case_id": req.case_number,
        "case_number": req.case_number,
        "complaint_text": req.complaint_text,
        "translated_text": req.complaint_text,
        "original_language": "en",
        "crime_category": req.crime_category or "CYBER",
        "crime_sub_type": req.crime_sub_type or "General Police Investigation",
        "entities": req.entities or {},
        "active_specialists": [],
        "cross_case_matches": [],
        "bns_draft": None,
        "bsa_draft": None,
        "cyber_draft": None,
        "conventional_draft": None,
        "evaluation_status": "PENDING",
        "evaluation_feedback": [],
        "iteration_count": 0,
        "hitl_approved": False,
        "io_custom_notes": "",
        "master_fir_details": {},
        "investigation_steps": [],
        "legal_requests_to_generate": [],
        "summary": ""
    }

    try:
        final_state = investigation_graph.invoke(initial_state)
        return {
            "status": "success",
            "case_number": final_state.get("case_number"),
            "master_fir": final_state.get("master_fir_details"),
            "investigation_steps": final_state.get("investigation_steps"),
            "cross_case_matches": final_state.get("cross_case_matches"),
            "legal_requests": final_state.get("legal_requests_to_generate"),
            "summary": final_state.get("summary")
        }
    except Exception as e:
        print(f"[-] LangGraph Graph Execution Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analytics/parse-response")
async def parse_provider_response(req: ResponseParseRequest):
    """
    Parses messy or large provider response files (CSV, Excel, PDF) using Hybrid Pandas + LLM Synthesizer.
    """
    result = analyze_large_provider_csv(file_path=req.file_path, response_type=req.response_type)
    return result

@app.get("/api/search-sops")
def search_sops_endpoint(query: str, specialist: Optional[str] = None):
    results = search_legal_sops(query=query, target_specialist=specialist, top_k=5)
    return {"query": query, "results": results}

@app.get("/api/requests/download/{filename}")
def download_legal_pdf(filename: str):
    path = os.path.join(PDF_DIR, filename)
    if not os.path.exists(path):
        from app.pdf_generator.legal_notices import generate_section_94_bnss_pdf
        generate_section_94_bnss_pdf(
            output_path=path,
            case_data={"case_number": "CR-2026-9910", "fir_number": "FIR-9910/2026", "crime_sub_type": "Cyber Fraud"},
            request_details={"target_provider": "Reliance Jio", "items": ["Target: +91 98765 43210"]}
        )

    return FileResponse(path=path, filename=filename, media_type="application/pdf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
