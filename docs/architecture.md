# Crime OS AI — Architectural Documentation

## 1. Executive System Overview

**Crime OS AI** is an agentic AI platform engineered for intelligence-led police investigations across cyber and conventional crime domains. 

Key Architectural Innovations:
- **Polyglot LLM Factory**: Gemini 2.5 / 1.5 Flash for vision and audio ingestion + Claude 3.5 / OpenAI GPT-4o / Groq API for zero-hallucination LangGraph reasoning.
- **Smart Multimodal Document Router**: Local PyMuPDF / Docling for digital text PDFs and Gemini 1.5 Flash Vision for scanned Indian police handwriting in Gujarati, Hindi, and English.
- **Qdrant Vector Search Engine**: Payload-filtered RAG over legal statutes (BNS, BNSS, BSA, IT Act) and SOP documents in `/database/doc/*.pdf`.
- **Anti-Laziness Evaluator Loop**: Quality node in LangGraph that checks specialist drafts for complete statutory grounding and mandatory Section 63 BSA evidence compliance.
- **Turnkey PDF Requisition Engine**: ReportLab-based generator for Section 94 BNSS notices, LERS CDR/IPDR requests, and bank debit freeze letters.
- **Unified PostgreSQL + JSONB Data Layer**: Dual benefits of relational integrity for users/cases and JSONB flexibility for evidence metadata and LLM logs.

---

## 2. Component Diagram

```
[React 18 SPA Frontend] ---> [Node.js Express Gateway] ---> [FastAPI AI Backend]
                                    |                             |
                                    v                             v
                             [PostgreSQL 16]              [Qdrant Vector Store]
                                                                  |
                                                                  v
                                                        [Polyglot LLM Factory]
```
