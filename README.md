<div align="center">

# 🛡️ Crime OS (E-Rakshak)
### **Next-Generation AI-Powered Criminal Investigation & Intelligence Operating System**
*Purpose-built for Law Enforcement Agencies (LEAs), State Police Departments & Cyber Crime Cells*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.3.1-61DAFB.svg?style=flat&logo=React&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg?style=flat&logo=TypeScript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_Alpine-336791.svg?style=flat&logo=PostgreSQL&logoColor=white)](https://www.postgresql.org/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector_Engine-DC2626.svg?style=flat&logo=Qdrant&logoColor=white)](https://qdrant.tech/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic_Workflow-FF6F00.svg?style=flat)](https://langchain-ai.github.io/langgraph/)
[![Docker](https://img.shields.io/badge/Docker-Compose_Ready-2496ED.svg?style=flat&logo=Docker&logoColor=white)](https://www.docker.com/)

---
</div>

## 📑 Table of Contents
- [Executive Overview](#-executive-overview)
- [Key Problems Solved](#-key-problems-solved)
- [System Architecture](#-system-architecture)
- [Core Modules & Deep Feature Breakdown](#-core-modules--deep-feature-breakdown)
  - [1. Multimodal Intake & Ingestion Engine](#1-multimodal-intake--ingestion-engine-ai-serviceappingestion)
  - [2. Multi-Agent Legal & Investigation Orchestrator](#2-multi-agent-legal--investigation-orchestrator-ai-serviceappagents)
  - [3. RAG & SOP Legal Vector Store](#3-rag--sop-legal-vector-store-ai-serviceapprag)
  - [4. Legal Notice & Section 94 BNSS Generator](#4-legal-notice--section-94-bnss-generator-ai-serviceapppdf_generator)
  - [5. Workflow Automator, SMTP & IMAP Monitor](#5-workflow-automator-smtp--imap-monitor-ai-serviceappworkflow_automator)
  - [6. Forensic Analytics & Evidence Parsers](#6-forensic-analytics--evidence-parsers-ai-serviceappanalytics)
  - [7. Cross-Case Entity Linkage & Syndicate Graph](#7-cross-case-entity-linkage--syndicate-graph-ai-servicemainpy--ui)
  - [8. API Gateway & Microservice Layer](#8-api-gateway--microservice-layer-gateway)
  - [9. Tactical Police Frontend UI](#9-tactical-police-frontend-ui-frontend)
  - [10. Mock Intermediary APIs](#10-mock-intermediary-apis-mock-apis)
- [Complete Project Directory Structure](#-complete-project-directory-structure)
- [Statutory & Legal Compliance Matrix](#-statutory--legal-compliance-matrix)
- [Prerequisites & System Requirements](#-prerequisites--system-requirements)
- [Setup & Installation Guide](#-setup--installation-guide)
  - [Option A: One-Click Docker Compose Setup (Recommended)](#option-a-one-click-docker-compose-setup-recommended)
  - [Option B: Manual Local Development Setup](#option-b-manual-local-development-setup)
- [Environment Configuration Reference (.env)](#-environment-configuration-reference-env)
- [Default Seed Credentials & User Roles](#-default-seed-credentials--user-roles)
- [API Reference & Key Endpoints](#-api-reference--key-endpoints)
- [Verification & Testing](#-verification--testing)
- [Security, Privacy & Air-Gap Offline Capabilities](#-security-privacy--air-gap-offline-capabilities)

---

## 🏛️ Executive Overview

**Crime OS (E-Rakshak)** is a modern, enterprise-grade, intelligence-led police investigation and case automation operating system. Engineered specifically for **Investigating Officers (IOs)**, **Station House Officers (SHOs)**, and **Cyber Crime Units**, Crime OS replaces fragmented legacy policing workflows with an autonomous, agentic system tailored to modern criminal law.

### ⚖️ Full Alignment with India's New Criminal Laws:
- **Bharatiya Nyaya Sanhita, 2023 (BNS)**: Automatic penal section classification, replacing IPC sections (e.g., Section 318(4) Cheating, Section 319 Impersonation, Section 336 Forgery, Section 111 Organized Crime).
- **Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)**: Standardized digital notices and statutory directives under **Section 94 BNSS** (formerly Section 91 CrPC) for immediate requisition of documents/data from third-party intermediaries.
- **Bharatiya Sakshya Adhiniyam, 2023 (BSA)**: Autonomous compliance with **Section 63 BSA** (formerly Section 65B IEA), including cryptographic SHA-256 hashing, chain-of-custody tracking, and instant generation of admissible electronic evidence certificates.
- **Information Technology Act, 2000 (Amended 2008)**: Direct mapping to Sections 43, 66, 66C, 66D, 67, and Section 79(3)(b) intermediary takedown notices.

---

## 🚨 Key Problems Solved

| Problem in Conventional Policing | Crime OS (E-Rakshak) Autonomous Solution |
| :--- | :--- |
| **Multilingual Voice/Text Complaints**: Handwritten Gujarati/Hindi complaints and regional audio recordings cause severe intake delays. | **Multimodal Ingestion Engine**: Optical Character Recognition (OCR) + Indic Speech-to-Text (STT) + Entity-Preserving Neural Machine Translation (Gujarati/Hindi ↔ English). |
| **Slow Subpoena Drafting**: IOs spend hours manually typing Section 94 BNSS notices for Banks, Telecoms, and Social Media intermediaries. | **One-Click Subpoena Generator**: Produces tamper-evident, watermarked official PDF notices with pre-verified Nodal Officer directory lookups. |
| **Manual Follow-ups & Lost Responses**: Nodal officer replies sit in email inboxes; partial data replies go unnoticed for weeks. | **Autonomous 2-Way Workflow Automator**: Background IMAP inbox monitoring + Groq LLM reply classification + automated followback generation for deficient responses. |
| **Gigabytes of Complex Forensic Dumps**: Analyzing raw CDRs, IPDRs, and 5,000+ line Bank CSV dumps manually takes days. | **Forensic Analytics Agents**: Instant Pandas-driven mule account detection, layering tracing, night calling analysis, and VPN/Proxy detection in seconds. |
| **Siloed Investigations**: Gangs using the same mule bank accounts or SIM cards across different districts go undetected. | **Cross-Case Entity Linkage Graph**: Automated entity overlap matching (Phone, UPI VPA, Bank Account, IMEI, Email) across all complaints in real time. |

---

## 📐 System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer["Tactical Frontend Layer (React 18 + TS + Tailwind + XYFlow)"]
        UI["Investigator Web Console (Port 3000)<br/>• Intake Terminal • Investigation Graph • Subpoena Center<br/>• Forensic Analytics • Entity Linkage • Tri-lingual (EN/HI/GU)"]
    end

    subgraph GatewayLayer["API Gateway & Auth Layer (Node.js + Express - Port 4000)"]
        GW["Express Gateway / BFF<br/>• JWT & RBAC Middleware (IO, SHO, Legal, Admin)<br/>• Supabase S3 File Storage Proxy<br/>• Audit Logger & Case Event Dispatcher"]
    end

    subgraph IntelligenceLayer["AI Intelligence Service (Python 3.11 + FastAPI - Port 8000)"]
        SR["Multimodal Smart Router<br/>(PyMuPDF, Docx, Tesseract, Whisper)"]
        
        subgraph LangGraphEngine["LangGraph Multi-Agent Orchestrator"]
            MR["Manager Router"]
            BNS["BNS Specialist"]
            BSA["BSA Evidence Specialist"]
            CYB["Cyber Forensic Specialist"]
            CONV["Conventional Crime Specialist"]
            SYN["Synthesis Node"]
            EVAL["Evaluator & HITL Node"]
        end

        subgraph ForensicEngines["Forensic Parsing & Analytics Suite"]
            BP["Bank Statement Parser<br/>(Mule & Layering)"]
            CP["CDR Telecom Parser<br/>(Frequency & Geolocations)"]
            IP["IP Forensics Parser<br/>(ASN, VPN, ISP)"]
            CERT["Section 63 BSA<br/>Certificate Generator"]
        end

        subgraph AutomationSuite["2-Way Workflow & Inbox Automator"]
            IMAP["IMAP Inbox Monitor"]
            RC["Groq LLM Reply Classifier"]
            SMTP["SMTP Directive Mailer"]
            FB["Follow-back Generator"]
        end
    end

    subgraph DataStorageLayer["Data & Persistence Layer"]
        PG[("PostgreSQL 16 Database<br/>Cases, Complaints, Evidence,<br/>Legal Requests, Users, Audits")]
        QD[("Qdrant Vector DB<br/>Police SOPs, Legal Statutes,<br/>Semantic Case Embeddings")]
        RD[("Redis 7 In-Memory<br/>Translation Cache & State Queue")]
        MOCK["Mock Intermediaries API<br/>(Port 5000 - Telecom/Bank/LERT)"]
    end

    %% Flows
    UI <-->|"REST / Multipart / JWT"| GW
    GW <-->|"Internal Proxied Requests"| IntelligenceLayer
    GW <-->|"SQL Queries"| PG
    SR --> LangGraphEngine
    LangGraphEngine <-->|"Hybrid Search"| QD
    AutomationSuite <-->|"Dispatch & Poll"| MOCK
    IntelligenceLayer <-->|"Read / Write"| PG
    IntelligenceLayer <-->|"Cache Tokens & Strings"| RD
```

---

## 📦 Core Modules & Deep Feature Breakdown

### 1. Multimodal Intake & Ingestion Engine (`/ai-service/app/ingestion`)
Processes unstructured raw complaints from any medium into structured intelligence:
- **Supported File Formats**:
  - **Documents**: PDF (`pymupdf` / `pdfplumber`), DOCX (`python-docx`), TXT/CSV/MD.
  - **Images**: Scanned FIRs, screenshots, WhatsApp chat exports via `Tesseract OCR` & `PIL`.
  - **Audio**: Recorded phone extortion, voice notes via `Faster-Whisper` / `Indic-Conformer` with Voice Activity Detection (VAD) and auto-chunking.
- **Heuristic Regex & Entity Extractor (`heuristic_extractor.py`)**:
  - Automatically extracts: Phone numbers, IMEIs, Bank Account numbers, IFSC codes, UPI VPAs, Email addresses, IP addresses, URLs, Transaction IDs (UTR/RRN), and suspect names.
- **Multilingual Offline Translation (`/ai-service/app/services/offline_translator.py`)**:
  - Real-time neural translation between **Gujarati, Hindi, and English**.
  - **Entity-Preserving Translation**: Uses placeholder masking (`__ENTITY_PHONE_1__`, `__ENTITY_VPA_2__`) to guarantee that critical evidence numbers, accounts, and names are never mangled by the translation model.
  - Redis-backed response caching for instant sub-millisecond translations.

### 2. Multi-Agent Legal & Investigation Orchestrator (`/ai-service/app/agents`)
Built on **LangGraph**, orchestrating specialized legal and investigative reasoning agents:
- **`manager_router.py`**: Assesses incoming crime narratives and dynamically classifies category: `CYBER`, `CONVENTIONAL`, or `HYBRID`.
- **Specialist Agents**:
  - **`bns_agent.py`**: Identifies cognizable sections under the Bharatiya Nyaya Sanhita, 2023 with statutory rationale and severity rating.
  - **`bsa_agent.py`**: Identifies mandatory digital evidence requirements, hash tracking, and compliance checklists under BSA 2023.
  - **`cyber_agent.py`**: Formulates cyber forensic investigation roadmaps (domain preservation, server logs, gateway tracing, 1930 portal reporting).
  - **`conventional_agent.py`**: Formulates field SOPs (crime scene preservation, CDR tower dumping, witness examination).
- **`synthesis.py`**: Compiles specialist drafts into a **Master FIR Document**, an **Investigation Action Plan**, and **Legal Requisition Directives**.
- **`evaluator.py` & `hitl.py`**: Performs automated quality checks, verifying legal statutory citations. Supports Human-in-the-Loop (HITL) approval gates before case finalization.

### 3. RAG & SOP Legal Vector Store (`/ai-service/app/rag`)
- **Qdrant Vector Database**: Indexes standard operating procedures (SOPs), Gujarat Police Cyber Crime guidelines, RBI master directions on banking fraud, and LERS guidelines.
- **Embedding Models**: Powered by `sentence-transformers/all-MiniLM-L6-v2` / `BAAI/bge-small-en-v1.5`.
- **Query Optimizer (`query_optimizer.py`)**: Expands colloquial police terminology into statutory legal queries.
- **Cross-Encoder Reranker (`reranker.py`)**: Reranks top-k retrieved chunks to ensure zero-hallucination compliance with legal procedures.

### 4. Legal Notice & Section 94 BNSS Generator (`/ai-service/app/pdf_generator`)
- **Automated Requisition Drafting**: Generates formal, legally-binding requisition orders under **Section 94 BNSS**.
- **Supported Notice Types**:
  - `SECTION_94_BNSS`: General requisition of records, server logs, and user identification.
  - `LERS_CDR` / `LERS_IPDR`: Telecom Service Provider (TSP) call details and IP detail records.
  - `BANK_FREEZE`: Immediate debit-freeze directive under 1930 / Section 106 BNSS.
  - `BANK_STATEMENT`: Detailed transaction statement and beneficiary KYC requisition.
  - `SECTION_79_3_B_IT_ACT`: Intermediary takedown and content preservation notice.
- **PDF Stamping & Watermarking**: Uses `ReportLab` to inject official Gujarat Police letterhead, emblem watermark, issuing officer badge number, and tamper-evident SHA-256 verification barcodes.
- **Nodal Directory (`notice_directory.json`)**: Built-in, searchable registry of 100+ verified Nodal Officers across Indian Banks (SBI, HDFC, ICICI, IndusInd), TSPs (Jio, Airtel, Vi, BSNL), and Social Tech Giants (Meta, Google, Telegram, WhatsApp).

### 5. Workflow Automator, SMTP & IMAP Monitor (`/ai-service/app/workflow_automator`)
- **Two-Way Asynchronous Communication**:
  - **`smtp_mailer.py`**: Dispatches signed PDF notices directly to nodal officer emails via secure TLS/SSL SMTP with official reference tags `[CrimeOS-REF: {case_number}]`.
  - **`inbox_monitor.py`**: Background IMAP agent that polls police inboxes for incoming compliance replies.
- **Groq LLM Reply Classifier (`reply_classifier.py` / `email_response_manager.py`)**:
  - Classifies incoming emails into: `FULFILLED` (Complete data provided), `PARTIAL` (Deficient response), `REJECTED` (Jurisdiction/Technical objection), or `DEFICIENT`.
  - Extracts attached CSVs/PDFs and routes them directly to forensic parsers.
- **Automated Follow-back Generator**:
  - When an intermediary sends an incomplete reply (e.g., missing IP logs or partial bank statements), the system drafts a statutory escalation notice citing Section 94(2) BNSS and Indian Penal liabilities for non-compliance.

### 6. Forensic Analytics & Evidence Parsers (`/ai-service/app/analytics`)
Automated extraction and anomaly detection on high-volume forensic dumps:
- **Bank Statement Parser (`bank_statement_parser.py`)**:
  - Rapidly detects **Mule Accounts** based on transaction velocity, sudden turnover spikes, micro-deposit testing, and rapid fund dissipation.
  - Generates beneficiary transaction flows and visual money trails.
- **CDR / Telecom Parser (`cdr_telecom_parser.py`)**:
  - Analyzes thousands of call records to calculate top frequency contacts, call duration anomalies, IMEI swapping, night calling patterns (11 PM – 5 AM), and cell-tower movement.
- **IP Forensics Parser (`ip_forensics_parser.py`)**:
  - Resolves IP addresses, detects VPN/Tor/Proxy exit nodes, analyzes Autonomous System Numbers (ASN), and pinpoints geographic ISP allocations.
- **Section 63 BSA Electronic Evidence Certificate Generator (`certificate_generator.py`)**:
  - Computes SHA-256 cryptographic hashes for all uploaded evidence files.
  - Automatically drafts an official **Section 63 BSA Admissibility Certificate** containing hash signatures, system parameters, extraction timestamp, and certifying officer credentials.

### 7. Cross-Case Entity Linkage & Syndicate Graph (`/ai-service/main.py` + UI)
- **Real-Time Cross-Case Linkage**:
  - Runs automated correlation checks across the entire PostgreSQL database.
  - Matches shared Phone Numbers, IMEIs, Bank Account Numbers, UPI IDs, and Email Addresses across unrelated FIRs.
- **Syndicate & Organized Crime Detection**:
  - Identifies recurring mule accounts used across multiple cyber fraud cases.
  - Calculates confidence scores (0.80 to 0.95) and highlights links to interstate organized crime rings.
  - Visualized via interactive network node graphs on the frontend.

### 8. API Gateway & Microservice Layer (`/gateway`)
- **Technology**: Node.js, Express, PostgreSQL (`pg`), JWT, Multer, Axios.
- **Security & RBAC**:
  - Role-Based Access Control protecting routes for `IO` (Investigating Officer), `SHO` (Station House Officer), `LEGAL_ADVISOR`, and `ADMIN`.
  - HTTP-Only secure cookie sessions + Bearer JWT tokens.
- **Evidence Storage**: Integrates with Supabase Cloud S3 bucket storage with fallback to local persistent volume storage.
- **Comprehensive Audit Trail**: Records every investigator action, evidence upload, notice dispatch, and report generation in `audit_logs`.

### 9. Tactical Police Frontend UI (`/frontend`)
- **Technology**: React 18, Vite, TypeScript, TailwindCSS, Lucide Icons, `@xyflow/react`.
- **Views & Screens**:
  - **`DashboardView.tsx`**: High-level station command center, active caseloads, urgency metrics, and priority queues.
  - **`IntakeView.tsx`**: Drag-and-drop multimodal complaint intake with audio recording, live preview, OCR, and entity extraction tags.
  - **`InvestigationView.tsx`**: Master investigation workspace with LangGraph visual execution steps, FIR review, and interactive SOP checklists.
  - **`SubpoenasView.tsx`**: Requisition control hub with Nodal Directory lookup, PDF preview, SMTP dispatch trigger, live IMAP reply tracker, and follow-back editor.
  - **`AnalyticsView.tsx`**: Forensic workbench for Bank CSV, CDR, and IP log parsing, featuring transaction graphs and Section 63 BSA certificate generation.
  - **`LinkageView.tsx`**: Entity relationship graph showing syndicate connections, cross-FIR overlaps, and confidence matrices.
  - **`AdminView.tsx`**: System control panel for LLM provider selection (Groq, OpenAI, Gemini, Ollama), user management, and audit inspection.
- **Trilingual Localization (`/frontend/src/locales/`)**: Instant dynamic switching between **English (`en`)**, **Hindi (`hi`)**, and **Gujarati (`gu`)**.

### 10. Mock Intermediary APIs (`/mock-apis`)
- Emulates live external third-party servers on port `5000`:
  - **Telecom Gateway**: Simulates Jio/Airtel CDR/IPDR responses.
  - **Banking Gateway**: Simulates NPCI/UPI lookup, balance verification, and simulated debit-freeze confirmation.
  - **Social Media LERT**: Simulates Meta/Google Law Enforcement Request Tool responses.

---

## 📂 Complete Project Directory Structure

```text
comlpete-CrimeOS/
├── .env                              # Active environment configuration (API keys, DB, SMTP)
├── .env.example                      # Template environment configuration
├── .gitignore                        # Git exclusion rules
├── docker-compose.yml                # Multi-container orchestration specification
├── README.md                         # Master documentation (this file)
│
├── ai-service/                       # Python 3.11 FastAPI Intelligence Microservice
│   ├── Dockerfile                    # Container definition for AI Service
│   ├── requirements.txt              # Python package dependencies
│   ├── config.py                     # Centralized settings & LLM provider configurations
│   ├── main.py                       # FastAPI application entry point & API routes
│   ├── preload_models.py             # HuggingFace & sentence-transformer preloading script
│   ├── uploads/                      # Temporary evidence storage directory
│   ├── generated_pdfs/               # Rendered Section 94 BNSS notice PDFs
│   └── app/
│       ├── agents/                   # LangGraph Multi-Agent Orchestration
│       │   ├── orchestrator.py       # LangGraph state machine & graph compilation
│       │   ├── state.py              # Investigation state typed dictionary
│       │   ├── nodes/                # Graph execution nodes
│       │   │   ├── manager_router.py # Crime categorization & routing node
│       │   │   ├── synthesis.py      # Master FIR & investigation step compiler
│       │   │   ├── evaluator.py      # Legal evaluation & verification node
│       │   │   ├── hitl.py           # Human-in-the-loop inspection node
│       │   │   └── cross_memory.py   # Cross-case historical memory lookup
│       │   └── specialists/          # Domain-specific legal & forensic agents
│       │       ├── bns_agent.py      # Bharatiya Nyaya Sanhita (BNS) reasoning
│       │       ├── bsa_agent.py      # Bharatiya Sakshya Adhiniyam (BSA) reasoning
│       │       ├── cyber_agent.py    # IT Act & cyber forensics reasoning
│       │       └── conventional_agent.py # IPC / conventional police SOP reasoning
│       ├── analytics/                # High-throughput data processing
│       │   └── response_agent.py     # Pandas provider response analyzer
│       ├── ingestion/                # Multimodal Intake & Entity Extraction
│       │   ├── base_processor.py     # Base processor interface
│       │   ├── smart_router.py       # Filetype routing (Audio, Image, PDF, Docx)
│       │   ├── heuristic_extractor.py # Regex & regex-heuristic entity extraction
│       │   ├── processors/           # Format-specific file parsers
│       │   │   ├── audio_processor.py # Audio transcription pipeline
│       │   │   ├── docx_processor.py  # DOCX extractor
│       │   │   ├── image_processor.py # Tesseract OCR image extractor
│       │   │   ├── pdf_processor.py   # PyMuPDF / pdfplumber document parser
│       │   └── text_processor.py     # TXT / CSV raw parser
│       │   └── stt/                  # Speech-to-Text & Indic Speech Models
│       │       ├── audio_loader.py   # Audio loading & normalization
│       │       ├── chunker.py        # Voice chunker & splitter
│       │       ├── indic_conformer.py # Indic Conformer speech pipeline
│       │       └── vad.py            # Voice Activity Detection (VAD)
│       ├── pdf_generator/            # Official Legal PDF Document Generation
│       │   └── legal_notices.py      # Section 94 BNSS & Section 79(3)(b) PDF builder
│       ├── rag/                      # Vector Retrieval & Hybrid Search
│       │   ├── qdrant_client.py      # Qdrant client connection & collection management
│       │   ├── query_optimizer.py    # Legal query expansion engine
│       │   └── reranker.py           # Cross-encoder semantic reranker
│       ├── services/                 # Utility & External Cloud Connectors
│       │   ├── offline_translator.py # Offline neural translation (EN <-> HI <-> GU)
│       │   └── supabase_storage.py   # Supabase S3 file storage connector
│       └── workflow_automator/       # Subpoena Automation & Inbox Monitoring
│           ├── analytics_agent.py    # Multi-type forensic coordinator
│           ├── automator_agent.py    # Workflow orchestration agent
│           ├── bank_statement_parser.py # Bank CSV mule detection & layering parser
│           ├── cdr_telecom_parser.py # CDR call frequency & geolocation analyzer
│           ├── certificate_generator.py # Section 63 BSA Hash Certificate builder
│           ├── email_response_manager.py # Groq LLM reply classifier & followback agent
│           ├── inbox_monitor.py      # Background IMAP email polling agent
│           ├── ip_forensics_parser.py # IP, ASN, ISP & VPN analyzer
│           ├── notice_directory.json # Registry of 100+ verified Nodal Officers
│           ├── reply_classifier.py   # Reply classification prompt templates
│           ├── smtp_mailer.py        # TLS/SSL SMTP notice dispatcher
│           ├── summarizer_agent.py   # Hierarchical multi-module summarizer
│           └── template_engine.py    # Statutory notice templating engine
│
├── gateway/                          # Node.js Express API Gateway & Authentication Service
│   ├── Dockerfile                    # Container definition for Gateway
│   ├── package.json                  # Gateway Node dependencies
│   ├── server.js                     # Main Express server, RBAC, routes & controllers
│   ├── uploads/                      # Ingested upload cache
│   └── src/
│       └── services/
│           ├── emailService.js       # Nodemailer SMTP gateway service
│           └── supabaseStorage.js    # Supabase cloud file storage integration
│
├── frontend/                         # React 18 + Vite + TypeScript Web Application
│   ├── Dockerfile                    # Container definition for Frontend (Nginx)
│   ├── nginx.conf                    # Nginx reverse proxy configuration
│   ├── package.json                  # Frontend dependencies
│   ├── tsconfig.json                 # TypeScript compiler configuration
│   ├── vite.config.ts                # Vite build configuration
│   ├── public/                       # Static public assets & emblems
│   └── src/
│       ├── main.tsx                  # React DOM root entry point
│       ├── App.tsx                   # Main routing, authentication & layout wrapper
│       ├── index.css                 # Global Tailwind and custom tactical theme CSS
│       ├── xyflow-types.d.ts         # Type definitions for React Flow / XYFlow
│       ├── components/
│       │   ├── common/               # Badges, loaders, status indicators
│       │   ├── layout/               # Navigation rails, tactical steppers, headers
│       │   │   ├── CommandHeader.tsx # Top tactical status & search header
│       │   │   ├── CommandPaletteDialog.tsx # Global quick action palette (Cmd+K)
│       │   │   ├── InspectorDrawer.tsx # Sliding context & metadata inspector
│       │   │   ├── LanguageSelector.tsx # EN/HI/GU language switcher
│       │   │   ├── PipelineNavRail.tsx # Side navigation bar
│       │   │   └── TacticalStepperHeader.tsx # Step-by-step case investigation stepper
│       │   └── ui/                   # Reusable buttons, cards, modals, dropdowns
│       ├── locales/                  # Trilingual i18n dictionary files
│       │   ├── en.json               # English language bundle
│       │   ├── hi.json               # Hindi language bundle
│       │   └── gu.json               # Gujarati language bundle
│       ├── services/
│       │   └── api.ts                # Centralized Axios API client
│       ├── store/                    # Zustand & React state stores
│       │   ├── authStore.ts          # Authentication token & user role state
│       │   ├── caseStore.ts          # Active case data & investigation state
│       │   ├── langStore.ts          # Current language preference store
│       │   ├── translationStore.ts   # Dynamic UI translation store
│       │   └── uiStore.ts            # Sidebar, drawer, and modal UI states
│       ├── types/                    # Core TypeScript interfaces & models
│       └── views/                    # Primary Application Views & Workbenches
│           ├── AdminView.tsx         # System control, LLM provider & user management
│           ├── AnalyticsView.tsx     # Bank, CDR & IP forensic analysis workbench
│           ├── DashboardView.tsx     # Police station overview & priority caseloads
│           ├── IntakeView.tsx        # Multimodal complaint intake terminal
│           ├── InvestigationView.tsx # LangGraph multi-agent investigation workspace
│           ├── LinkageView.tsx       # Cross-case entity linkage & syndicate graph
│           ├── LoginView.tsx         # Secure tactical officer authentication
│           └── SubpoenasView.tsx     # Subpoena hub, Nodal directory & inbox tracker
│
├── database/                         # PostgreSQL Database Schemas & Migrations
│   ├── schema.sql                    # Database tables, enums, triggers & seed users
│   ├── ingest_pdfs.py                # Standalone script to ingest legal PDFs into Qdrant
│   └── doc/                          # Standard operating procedure PDF resources
│
└── mock-apis/                        # Mock External Intermediary Microservice
    ├── Dockerfile                    # Container definition for Mock APIs
    ├── package.json                  # Dependencies for Mock APIs
    └── server.js                     # Express mock endpoints (Telecom, Bank, LERT)
```

---

## ⚖️ Statutory & Legal Compliance Matrix

| Legal Statute | Crime OS Technical Implementation | Output Artifact |
| :--- | :--- | :--- |
| **Section 94 BNSS, 2023** *(Summons to produce document/data)* | Automated drafting with dynamic case reference metadata, statutory warnings, and officer credentials. | Official Watermarked Section 94 BNSS Notice (PDF). |
| **Section 63 BSA, 2023** *(Admissibility of electronic records)* | Automated SHA-256 cryptographic hashing of raw files, system environment capture, and chain-of-custody logging. | Signed Section 63 BSA Certificate of Admissibility. |
| **Section 106 BNSS, 2023** *(Power of police to seize property/accounts)* | Automated debit-freeze requisition generation targeting mule accounts identified via forensic parsing. | Bank Debit Freeze Directive Notice. |
| **Section 79(3)(b) IT Act, 2000** *(Intermediary liability & takedown)* | Automated generation of preservation and content takedown notices to social media platforms and ISPs. | Intermediary Compliance Notice. |
| **Section 318(4) & 319 BNS, 2023** *(Cheating & Impersonation)* | Specialized BNS Agent maps modus operandi (phishing, spoofing, lottery scam) directly to modern penal sections. | Master First Information Report (FIR) Draft. |

---

## 💻 Prerequisites & System Requirements

### Hardware Requirements:
- **CPU**: 4 Cores minimum (8 Cores recommended for local Whisper/Ollama).
- **RAM**: 8 GB RAM minimum (16 GB recommended).
- **Disk Space**: 10 GB free disk space for Docker containers and model cache.

### Software Prerequisites:
- **Docker & Docker Compose**: Docker Desktop 4.20+ or Docker Engine 24+
- *(Optional for manual local run)*:
  - **Node.js**: v18.0.0 or higher
  - **Python**: v3.11.x (Python 3.11 is strongly recommended)
  - **PostgreSQL**: v16.x
  - **Qdrant**: v1.7.0+
  - **Redis**: v7.x
  - **Tesseract OCR**: Installed with English, Hindi (`hin`), and Gujarati (`guj`) language packs.

---

## 🚀 Setup & Installation Guide

### Option A: One-Click Docker Compose Setup (Recommended)

The easiest and most reliable way to launch the entire Crime OS ecosystem is using Docker Compose.

#### Step 1: Clone Repository
```bash
git clone https://github.com/NevilVataliya/comlpete-CrimeOS.git
cd comlpete-CrimeOS
```

#### Step 2: Configure Environment Variables
Copy the template `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and set your API keys (e.g., `GROQ_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`) and SMTP credentials. *(See [Environment Configuration Reference](#-environment-configuration-reference-env) below).*

#### Step 3: Build & Launch All Containers
```bash
docker-compose up --build
```
*Docker will automatically initialize PostgreSQL, run `database/schema.sql` to seed initial users and tables, start Qdrant, Redis, AI Service, API Gateway, Mock APIs, and Frontend.*

#### Step 4: Access Services
| Service | URL | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | [http://localhost:3000](http://localhost:3000) | `3000` | Tactical Police Web Console |
| **API Gateway** | [http://localhost:4000](http://localhost:4000) | `4000` | Express REST Gateway |
| **AI Intelligence Service** | [http://localhost:8000/docs](http://localhost:8000/docs) | `8000` | FastAPI Swagger Documentation |
| **Mock Intermediaries API** | [http://localhost:5000](http://localhost:5000) | `5000` | Simulated Telecom & Bank APIs |
| **Qdrant Vector DB** | [http://localhost:6333/dashboard](http://localhost:6333/dashboard) | `6333` | Vector Search Dashboard |

---

### Option B: Manual Local Development Setup

If running services directly on your host machine:

#### 1. Start Storage Services (Postgres, Qdrant, Redis)
You can start just the database dependencies with Docker:
```bash
docker run -d --name crimeos_postgres -e POSTGRES_DB=crimeos_db -e POSTGRES_USER=crimeos_user -e POSTGRES_PASSWORD=crimeos_password -p 5432:5432 postgres:16-alpine
docker run -d --name crimeos_qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest
docker run -d --name crimeos_redis -p 6379:6379 redis:7-alpine
```
Apply the database schema:
```bash
# On Linux / macOS:
psql -h localhost -U crimeos_user -d crimeos_db -f database/schema.sql

# On Windows PowerShell:
Get-Content database\schema.sql | psql -h localhost -U crimeos_user -d crimeos_db
```

#### 2. Setup & Run AI Intelligence Service (`/ai-service`)
```bash
cd ai-service

# Create and activate Python virtual environment
python -m venv venv
# Linux / macOS:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Setup & Run API Gateway (`/gateway`)
```bash
cd gateway

# Install dependencies
npm install

# Start Express server
npm run dev # or node server.js
```

#### 4. Setup & Run Mock Intermediaries (`/mock-apis`)
```bash
cd mock-apis
npm install
node server.js
```

#### 5. Setup & Run Frontend Client (`/frontend`)
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Environment Configuration Reference (.env)

Create a `.env` file in the root directory:

```env
# ==========================================
# 1. DATABASE & PERSISTENCE
# ==========================================
DATABASE_URL=postgresql://crimeos_user:crimeos_password@localhost:5432/crimeos_db
POSTGRES_DB=crimeos_db
POSTGRES_USER=crimeos_user
POSTGRES_PASSWORD=crimeos_password

QDRANT_HOST=localhost
QDRANT_PORT=6333
COLLECTION_NAME=police_sops_v2

REDIS_HOST=localhost
REDIS_PORT=6379

# ==========================================
# 2. MICROSERVICE PORTS & URLS
# ==========================================
PORT=4000
GATEWAY_PORT=4000
AI_SERVICE_URL=http://localhost:8000
MOCK_APIS_URL=http://localhost:5000
JWT_SECRET=crimeos_secret_jwt_key_2026_investigation_suite

# ==========================================
# 3. LLM ENGINE & AI PROVIDERS
# ==========================================
# Set LLM_PROVIDER to: auto | groq | openai | gemini | anthropic | ollama
LLM_PROVIDER=auto
ENABLE_DEMO_FALLBACKS=false
OFFLINE_MODE=auto

# Cloud Provider API Keys (Fill at least one):
GROQ_API_KEY=gsk_your_groq_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
HF_TOKEN=hf_your_huggingface_token_here

# Local Offline Ollama Configuration (Optional):
USE_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3:latest

# ==========================================
# 4. SMTP & IMAP (2-WAY SUBPOENA AUTOMATION)
# ==========================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_official_police_email@gmail.com
SMTP_PASS=your_gmail_app_password_here
SENDER_EMAIL=your_official_police_email@gmail.com
SENDER_NAME=Surat Cyber Crime Police Station

IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USERNAME=your_official_police_email@gmail.com
IMAP_PASSWORD=your_gmail_app_password_here

# ==========================================
# 5. SUPABASE CLOUD STORAGE (OPTIONAL)
# ==========================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
SUPABASE_BUCKET_NAME=crimeos-evidence
```

---

## 👥 Default Seed Credentials & User Roles

When the database is initialized, four standard police accounts are automatically created.

| Username | Password | Role | Designation | Police Station |
| :--- | :--- | :--- | :--- | :--- |
| `io_patel` | `police123` | **IO** | PSI Inspector V. K. Patel | Surat Cyber Crime Station |
| `sho_sharma` | `police123` | **SHO** | PI Senior Inspector R. S. Sharma | Surat Cyber Crime Station |
| `legal_desai` | `police123` | **LEGAL_ADVISOR** | Adv. A. M. Desai | State CID Legal Cell |
| `admin_crimeos`| `police123` | **ADMIN** | System Administrator | Crime OS Headquarters |

---

## 🔌 API Reference & Key Endpoints

### Gateway Endpoints (Port `4000`)
- `POST /api/auth/login`: Authenticates officer, issues JWT token and cookie.
- `GET /api/auth/me`: Returns currently logged-in user profile and role.
- `GET /api/complaints`: Lists all registered complaints.
- `POST /api/complaints`: Ingests and stores a new complaint.
- `GET /api/cases`: Fetches all active investigation cases.
- `POST /api/cases`: Creates a new case and assigns IO/SHO.
- `GET /api/cases/:id`: Detailed view of a case, investigation steps, and evidence list.
- `POST /api/cases/:id/requests`: Registers a new Section 94 BNSS legal notice.
- `PATCH /api/cases/:id/requests/:reqId/approve`: SHO one-click approval for legal notices.
- `POST /api/cases/:id/evidence`: Uploads digital evidence to Supabase / local storage.
- `GET /api/audit-logs`: Retrieves immutable audit trail for legal compliance.

### AI Intelligence Service Endpoints (Port `8000`)
- `POST /api/ingest`: Multipart endpoint accepting Audio/PDF/Images/Text for OCR, Speech-to-Text, and entity extraction.
- `POST /api/investigate`: Executes the LangGraph multi-agent graph (BNS, BSA, Cyber, Conventional) to generate the Master FIR and step-by-step SOP plan.
- `POST /api/linkage/search`: Searches for cross-case entity overlaps (Phone, VPA, Bank Account, Email).
- `POST /api/requests/generate-notice`: Builds and watermarks a Section 94 BNSS Notice PDF.
- `POST /api/requests/dispatch-email`: Sends the notice PDF via SMTP to the Nodal Officer.
- `POST /api/email/check-inbox`: Polls IMAP for incoming replies, classifies response via Groq LLM.
- `POST /api/email/send-followback`: Dispatches an automated escalation notice for partial/deficient replies.
- `POST /api/analytics/upload-and-parse`: Uploads Bank/CDR/IP files, parses anomalies, and returns a signed Section 63 BSA Certificate.
- `POST /api/analytics/generate-certificate`: Generates a standalone Section 63 BSA Admissibility Certificate.
- `POST /api/translate/batch`: Entity-preserving batch translation across Hindi, Gujarati, and English.

---

## 🧪 Verification & Testing

### 1. Test Gateway Health
```bash
curl -X GET http://localhost:4000/api/config
```

### 2. Test AI Service Health & Offline Capabilities
```bash
curl -X GET http://localhost:8000/api/system/status
```

### 3. Test Cross-Case Linkage Endpoint
```bash
curl -X POST http://localhost:8000/api/linkage/search \
  -H "Content-Type: application/json" \
  -d '{
    "case_number": "CR-2026-9910",
    "entities": {
      "phone_numbers": ["9876543210"],
      "vpas_upis": ["fraudster@paytm"]
    }
  }'
```

### 4. Run Frontend Test Suite & Linter
```bash
cd frontend
npm run build
```

---

## 🔒 Security, Privacy & Air-Gap Offline Capabilities

- **Air-Gapped & Offline Ready**:
  - The AI Service can operate completely offline in disconnected police intranet environments.
  - Set `OFFLINE_MODE=true` in `.env` to enable local models: `Faster-Whisper` (STT), `Tesseract` (OCR), `Ollama Llama3` (Local LLM), and local regex-heuristic extractors.
- **Data Protection**:
  - PII and sensitive investigation records are stored in PostgreSQL with field-level encryption capabilities.
  - Passwords hashed using salted `bcrypt`.
- **Chain of Custody**:
  - Every file upload generates a unique cryptographic SHA-256 digest stored permanently in the database and embedded in Section 63 BSA certificates.
- **Audit Logging**:
  - All officer logins, file views, notice dispatches, and case modifications are logged with timestamps and client IP addresses in the `audit_logs` table.

---

<div align="center">

**Crime OS (E-Rakshak)** — Developed with dedication for modern policing and digital justice.

*Designed for Law Enforcement • Compliant with BNS, BNSS & BSA 2023*

</div>
