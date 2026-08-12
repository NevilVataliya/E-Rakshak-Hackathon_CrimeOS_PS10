# 🛡️ Crime OS AI (E-Rakshak) — Next-Gen Intelligence-Led Police Investigation Platform

[![System Architecture](https://img.shields.io/badge/Architecture-Agentic%20Microservices-blue.svg)](#-system-architecture)
[![Python FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.11+-009688.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/AI%20Orchestration-LangGraph%20%7C%20Polyglot%20LLM-FF6F00.svg)](https://www.langchain.com/langgraph)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript%20%7C%20Vite-61DAFB.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016%20%7C%20JSONB-336791.svg)](https://www.postgresql.org/)
[![Qdrant Vector DB](https://img.shields.io/badge/Vector%20Search-Qdrant%20RAG-8A2BE2.svg)](https://qdrant.tech/)
[![Legal Compliance](https://img.shields.io/badge/Legal%20Framework-BNS%20%7C%20BNSS%20%7C%20BSA%202023-brightgreen.svg)](#-legal-statute--sop-grounding-framework-2023)

---

## 📌 Executive Summary & Project Motive

**Crime OS AI (E-Rakshak)** is an enterprise-grade, agentic AI platform specifically engineered for **Indian Police & Law Enforcement Agencies** (Cyber Crime Cells, State Police Departments, State CID, and Law Enforcement Intelligence Units). 

With the historical transition of Indian criminal jurisprudence from legacy laws (*IPC 1860, CrPC 1973, Indian Evidence Act 1872*) to the new statutory framework—**Bharatiya Nyaya Sanhita (BNS 2023)**, **Bharatiya Nagarik Suraksha Sanhita (BNSS 2023)**, and **Bharatiya Sakshya Adhiniyam (BSA 2023)**—law enforcement agencies face unprecedented operational challenges. Investigating Officers (IOs) handle overwhelming volumes of multilingual complaints, handwritten Panchnamas, complex cyber-financial fraud networks, telecom call detail records (CDR/IPDR), and bank statement logs, often leading to investigation delays, missed statutory deadlines, and fragmented intelligence.

**Crime OS AI** solves these critical pain points by delivering an end-to-end, multi-agent AI operating system that automates complaint ingestion, serial offender cross-case linkage, legal RAG reasoning, turnkey subpoena generation, automated compliance email tracking, forensic response analytics, and court-ready case diary generation.

---

## 🎯 Core Problems Solved & Value Proposition

| Key Challenge | Legacy Operational Process | Crime OS AI Solution |
| :--- | :--- | :--- |
| **New Law Transition (2023)** | Manual lookup of legacy IPC sections and mapping to BNS/BNSS/BSA; risk of procedural error. | **100% Native BNS/BNSS/BSA Statutory Grounding Engine** with payload-filtered RAG over legal codes. |
| **Multilingual Ingestion** | Scanned Indian police handwriting in Gujarati, Hindi, and English required manual translation and entry. | **Multimodal Ingestion Pipeline** combining Gemini 1.5/2.5 Flash Vision OCR, PyMuPDF, Docling, and Whisper audio transcription. |
| **AI Hallucinations & Wrongful Freezes** | Generic LLMs hallucinate non-existent account numbers or direct freezes on complainant/victim accounts. | **Anti-Laziness Evaluator Loop & Safety Filter** that deterministically strips ungrounded entities and prevents victim account freeze. |
| **Siloed Criminal Networks** | Fraudsters operate across multiple FIRs using recurring phone numbers, VPAs, and bank accounts undetected. | **Serial Entity Linkage Engine** with hybrid PostgreSQL exact matching + Qdrant vector similarity & dynamic network graph visualization. |
| **Legal Notice Burden** | Typing individual Section 94 BNSS notices to banks, TSPs, and platforms consumes hours per case. | **Turnkey PDF Subpoena Generator** rendering official ReportLab legal notices with police seals in 1 click. |
| **Nodal Compliance Tracking** | Manual monitoring of officer email inboxes for bank/TSP compliance responses. | **IMAP Inbox Monitor & Groq LLM Classifier** that auto-ingests replies, parses completeness, and drafts followback emails. |
| **Forensic Evidence Analytics** | Manual review of 1,000+ transaction rows in bank CSVs or telecom IPDR logs. | **Pandas Evidence Analytics Engine** identifying money-laundering layering, top B-parties, IP clusters, and risk scores. |
| **Courtroom Evidence Validity** | Electronic evidence rejected due to missing certificates under Section 63 BSA. | **Automated Section 63 BSA Certificate Generator** with SHA-256 digital hash verification chains. |

---

## 🏛️ Legal Statute & SOP Grounding Framework (2023)

Crime OS AI is grounded strictly in the modern legal jurisprudence of India:

```
                  ┌──────────────────────────────────────────────────┐
                  │       CRIME OS AI LEGAL GROUNDING ENGINE         │
                  └─────────────────────────┬────────────────────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         │                                  │                                  │
         ▼                                  ▼                                  ▼
┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
│  BNS (2023)      │               │  BNSS (2023)     │               │  BSA (2023)      │
│  Penal Code      │               │  Procedure Code  │               │  Evidence Act    │
└────────┬─────────┘               └────────┬─────────┘               └────────┬─────────┘
         │                                  │                                  │
         ├─ Sec 318(4): Cheating            ├─ Sec 94: Subpoena Notices        └─ Sec 63: Electronic
         ├─ Sec 319: Personation            ├─ Sec 105: Search/Panchnama          Evidence Certificate
         ├─ Sec 305/331: Theft/Housebreak   ├─ Sec 167: Case Diary Entry          & SHA-256 Hashes
         └─ Sec 351: Intimidation           └─ Sec 193: Charge Sheet
```

1. **Bharatiya Nyaya Sanhita (BNS, 2023)**:
   - **Section 318(4)**: Cheating and dishonestly inducing delivery of property (Financial & Cyber Fraud).
   - **Section 319**: Cheating by personation using computer resources / fake caller IDs.
   - **Section 305 / 331**: Housebreaking, theft, and extortion.
   - **Section 351**: Criminal intimidation via digital messages or calls.
2. **Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023)**:
   - **Section 94**: Order to produce documents or electronic records (Requisitions to Banks, TSPs, Social Media).
   - **Section 105**: Search & Seizure recording and mandatory Spot Panchnama procedures.
   - **Section 167 / 173 CrPC**: Case Diary maintenance and chronological activity tracking.
   - **Section 180**: Examination of witnesses by police officers.
   - **Section 193**: Submission of Final Police Report / Charge Sheet before Magistrate.
3. **Bharatiya Sakshya Adhiniyam (BSA, 2023)**:
   - **Section 63**: Admissibility of electronic records, mandatory SHA-256 hash chains, and electronic evidence certificates.
4. **Information Technology Act, 2000**:
   - **Section 66D**: Punishment for cheating by personation by using computer resource.

---

## 🛠️ Complete Technology Stack

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND LAYER                                     │
│   React 18  •  TypeScript  •  Vite  •  Tailwind CSS  •  Zustand  •  React Flow      │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ REST API / JWT
┌─────────────────────────────────────────▼─────────────────────────────────────────┐
│                                 API GATEWAY LAYER                                 │
│          Node.js  •  Express  •  PostgreSQL Client Pool  •  Nodemailer            │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │ HTTP Proxy / Async Worker
┌─────────────────────────────────────────▼─────────────────────────────────────────┐
│                           AI & FORENSIC BACKEND ENGINE                            │
│  FastAPI  •  LangGraph Orchestrator  •  Qdrant RAG Engine  •  Pandas Analytics    │
│  Gemini 2.5/1.5 Flash  •  Groq (Llama 3.1 8B)  •  ReportLab PDF Engine  • Whisper │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
    ┌─────────────────────────────────────┴─────────────────────────────────────┐
    │                               DATA STORES                                 │
    │  PostgreSQL 16 (Relational & JSONB)  •  Qdrant Vector DB  •  Redis Cache  │
    └───────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technologies & Frameworks | Description |
| :--- | :--- | :--- |
| **Frontend SPA** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Responsive modern UI featuring dark-mode glassmorphism, interactive case workspaces, and real-time alerts. |
| **State & Visualization** | Zustand (with localStorage persistence), Recharts, `@xyflow/react` | Dynamic multi-case state isolation, serial entity graph visualizations, transaction charts. |
| **API Gateway** | Node.js (v18+), Express, JWT Authentication, Multer | API proxying, Role-Based Access Control (`IO`, `SHO`, `LEGAL_ADVISOR`, `ADMIN`), file upload handling. |
| **AI Microservice** | Python 3.11+, FastAPI, Uvicorn, Pydantic | Asynchronous AI service powering multi-agent investigation graphs and data pipelines. |
| **Agent Orchestration** | LangGraph (StateGraph), LangChain | State machine governing dynamic routing, parallel specialist pods, anti-laziness evaluator, and HITL review. |
| **Polyglot LLM Factory** | Gemini 2.5 / 1.5 Flash, Groq API (Llama 3.1 8B), Claude 3.5, OpenAI GPT-4o | Specialized model dispatch based on task requirements (Vision OCR, fast classification, or legal reasoning). |
| **RAG & Vector Engine** | Qdrant Vector DB, Sentence-Transformers | Payload-filtered vector search over legal statutes and police SOP documents (`database/doc/*.pdf`). |
| **Document Processing** | PyMuPDF, python-docx, Tesseract OCR, Faster-Whisper | Multimodal document parsing for digital/scanned PDFs, DOCX, images, and audio complaints. |
| **Requisition & PDF Engine** | ReportLab PDF Library | Dynamic generation of court-ready Section 94 BNSS statutory legal notices with official seal headers. |
| **Forensic Analytics** | Pandas, NumPy | High-performance CSV/PDF transaction parsing, fraud pattern detection, and counterparty profiling. |
| **Database & Cache** | PostgreSQL 16 (with JSONB), Redis 7 | Dual-layer persistence combining ACID relational schema with flexible JSONB logs and Redis cache. |
| **Deployment** | Docker, Docker Compose, Nginx | Containerized deployment across 5 microservices for air-gapped local or cloud deployment. |

---

## 🏗️ System Architecture & Workflow Pipeline

### 1. High-Level Microservices Topology

```
                  ┌─────────────────────────────┐
                  │   Browser (React 18 SPA)    │
                  │   http://localhost:3000     │
                  └──────────────┬──────────────┘
                                 │
                                 ▼
                  ┌─────────────────────────────┐
                  │   Node.js Express Gateway   │
                  │   http://localhost:4000     │
                  └──────┬──────────────┬───────┘
                         │              │
        ┌────────────────┘              └────────────────┐
        ▼                                                ▼
┌───────────────────────────┐                ┌───────────────────────────┐
│   PostgreSQL 16 Database  │                │   FastAPI AI Service      │
│   (Users, Cases, Legal)   │                │   http://localhost:8000   │
└───────────────────────────┘                └──────┬────────────┬───────┘
                                                    │            │
                                     ┌──────────────┘            └──────────────┐
                                     ▼                                          ▼
                      ┌───────────────────────────┐              ┌───────────────────────────┐
                      │   Qdrant Vector Database  │              │   External LLM Providers  │
                      │   http://localhost:6333   │              │   (Gemini, Groq, OpenAI)  │
                      └───────────────────────────┘              └───────────────────────────┘
```

---

### 2. LangGraph Multi-Agent Investigation Graph Architecture

```
                    ┌───────────────────────────────────┐
                    │      START: Complaint Ingest      │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │      Cross-Case Memory Node       │
                    │   (Fetches Historical Links)      │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                    ┌───────────────────────────────────┐
                    │       Manager Router Node         │
                    │    (Evidence-Based Routing)       │
                    └─────────────────┬─────────────────┘
                                      │
             ┌────────────────────────┼────────────────────────┬────────────────────────┐
             │                        │                        │                        │
             ▼                        ▼                        ▼                        ▼
  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
  │   BNS Specialist   │   │   BSA Specialist   │   │  Cyber/Financial   │   │ Conventional Field │
  │    (BNS 2023 Law)  │   │  (Sec 63 BSA Cert) │   │     Specialist     │   │     Specialist     │
  └──────────┬─────────┘   └──────────┬─────────┘   └──────────┬─────────┘   └──────────┬─────────┘
             │                        │                        │                        │
             └────────────────────────┴───────────┬────────────┴────────────────────────┘
                                                  │
                                                  ▼
                                    ┌───────────────────────────┐
                                    │  Evaluator Node (Quality) │
                                    │ ┌───────────────────────┐ │
                                    │ │ Safety Guardrail:     │ │
                                    │ │ • Strip Hallucinations│ │
                                    │ │ • Block Victim Freeze │ │
                                    │ └───────────────────────┘ │
                                    └─────────────┬─────────────┘
                                                  │
                                  ┌───────────────┴───────────────┐
                                  │ Evaluation Status Check       │
                                  └───────┬───────────────┬───────┘
                               REJECTED   │               │ APPROVED
                          ┌───────────────┘               └──────────────┐
                          ▼                                              ▼
            ┌───────────────────────────┐                  ┌───────────────────────────┐
            │ Re-trigger Manager Router │                  │ Human-in-the-Loop (HITL)  │
            │  (With Evaluator Feedback)│                  │ Officer Approval & Notes  │
            └───────────────────────────┘                  └─────────────┬─────────────┘
                                                                         │
                                                                         ▼
                                                           ┌───────────────────────────┐
                                                           │     Synthesis Node        │
                                                           │ • Master FIR Generation   │
                                                           │ • Money Trail Tracing     │
                                                           │ • Turnkey ReportLab PDFs  │
                                                           └─────────────┬─────────────┘
                                                                         │
                                                                         ▼
                                                           ┌───────────────────────────┐
                                                           │            END            │
                                                           └───────────────────────────┘
```

---

## 💻 Module-by-Module Feature Breakdown

Crime OS AI is structured into 6 core investigation modules accessible seamlessly from the application interface:

### 📄 Module 1: Complaint Intake & Multimodal Data Extraction
* **Multimodal File Support**: Accepts raw complaint text, digital PDFs, scanned image panchnamas (`.jpg`, `.png`, `.webp`), DOCX documents, and audio recordings (`.mp3`, `.wav`, `.m4a`).
* **Multilingual Indian OCR & Transcription**: Employs Gemini 1.5/2.5 Flash Vision for scanned Gujarati, Hindi, and English handwritten text; utilizes Faster-Whisper for voice complaint transcription.
* **Deterministic Heuristic Entity Extractor**:
  * Normalizes Gujarati/Hindi numerical representations (e.g. converting `₹૯,૦૦,૦૦૦` or `9,00,000` accurately to `900000`).
  * Extracts target phone numbers, bank account numbers, IFSC codes, UPI VPAs, email addresses, suspect social media handles (`@username`), IP addresses, dates, and locations.
  * Deterministic monetary loss engine picks maximum loss figures directly from complaint text.
* **Offline Mode Capability**: Fully functional in air-gapped police stations using local PyMuPDF, python-docx, Tesseract OCR, and regex fallbacks.

---

### 🕸️ Module 2: Serial Linkage & Cross-FIR Pattern Analysis
* **Hybrid Entity Matching**:
  * **Primary Path**: PostgreSQL JSONB exact lookup across historical complaint records for matching phone numbers, bank accounts, UPI VPAs, and emails.
  * **Secondary Path**: Qdrant vector embedding similarity search for fuzzy/semantic entity matches.
* **Confidence Scoring Algorithm**:
  * Phone Number Overlap: **0.95** (CDR Recurrence)
  * UPI VPA Overlap: **0.92** (Recurring Mule Network)
  * Bank Account Overlap: **0.90** (Beneficiary Recurrence)
  * Email Address Overlap: **0.85** (Digital Footprint Overlap)
* **Interactive Network Link Graph**: Powered by React Flow, enabling Investigating Officers to visually inspect connected suspect nodes, shared bank accounts, recurring victim patterns, and police station origins.
* **Actionable Police Directives**: Suggests immediate statutory directives (e.g. *"Issue Section 94 BNSS Notice to Bank Nodal Cell for Mule Account 4092182012"*).

---

### 🔬 Module 3: AI Investigation Studio & Multi-Agent Pods
* **Agentic Execution Pipeline**: Executes compiled LangGraph multi-agent flow over ingested complaints.
* **Specialist Pod Capabilities**:
  * **BNS Legal Specialist**: Identifies applicable Bharatiya Nyaya Sanhita sections (BNS 318(4) Cheating, BNS 319 Personation, BNS 351 Intimidation, IT Act 66D) with legal rationale and ingredients of offense.
  * **BSA Evidence Specialist**: Formulates electronic evidence collection strategy, hash chain logging, panchnama guidelines, and Section 63 BSA certificate drafting.
  * **Cyber & Financial Specialist**: Performs end-to-end money-trail tracing (Victim Account ➔ Layer 1 Mule ➔ Layer 2 Mule ➔ ATM Cashout / Crypto VPA), drafts 1930 CFCFRMS portal freeze advisories, and formats IPDR/CDR requests.
  * **Conventional Field Specialist**: Generates guidelines for Spot Panchnama under BNSS 105, witness examination under BNSS 180, CCTV seizure, and physical surveillance.
* **Anti-Laziness Evaluator & Safety Guardrail**:
  * Inspects specialist drafts for complete statutory grounding.
  * **Victim Account Freeze Protection**: Automatically detects and strips directives attempting to freeze victim/complainant bank accounts.
  * **Phantom Entity Scrubbing**: Strips hallucinated phone numbers or bank accounts not present in ingested complaint evidence.
* **Master FIR & Turnkey PDF Generation**: Generates comprehensive FIR breakdown, step-by-step investigation checklist, and auto-compiles legal subpoena documents.

---

### ✉️ Module 4: Statutory Legal Subpoenas & Direct Reply Management
* **Turnkey ReportLab PDF Engine**: Produces official, high-resolution PDF legal notices complete with official police header seals, case reference numbers, statutory headers, and signature blocks.
* **Supported Requisition Templates**:
  1. **Section 94 BNSS Notice to Telecom Operators**: Requisitions Call Detail Records (CDR), Cell Tower Location Logs, IMEI history, and Customer Application Forms (CAF).
  2. **Section 94 BNSS Notice to Bank Nodal Officers**: Directs immediate debit freeze / lien mark on beneficiary accounts, UPI VPAs, and mandates 90-day transaction statement disclosure.
  3. **LERS IPDR & Social Media Preservation Notice**: Directs platforms (Google, Meta, Telegram, WhatsApp) to preserve IP login logs, registration emails, and subscriber details.
* **Custom Template Engine**: Allows officers to define and register custom statutory notice templates with dynamic variable placeholders.
* **Direct SMTP Dispatch**: Dispatches notices directly to Nodal Officer emails (e.g. `cgc.fraud@sbi.co.in`, `nodal@jio.com`) via backend SMTP integration.
* **IMAP Inbox Monitor & Groq LLM Classifier**:
  * Periodically polls police station inbox for incoming compliance replies.
  * Uses Groq LLM (`llama-3.1-8b-instant`) to classify reply status (`COMPLETE`, `PARTIAL_COMPLIANCE`, `REJECTED_FORMAT`).
  * **HITL Followback Email Generator**: Automatically drafts formal statutory followback emails when compliance data is incomplete, requiring 1-click officer approval to dispatch.

---

### 📊 Module 5: Forensic Response Analytics & Evidence Intelligence
* **Multi-Format Ingestion**: Ingests compliance data payloads received from external entities (Bank CSV/PDF statements, Telecom CDR CSVs, Social Media IPDR text logs).
* **Pandas Analytics Engine**:
  * Analyzes high-volume financial transactions to detect **Money Laundering Layering**, structuring, and rapid cash-outs.
  * Profiles top counterparties, beneficiary account frequency, and transaction velocity.
  * Groups telecom CDR data by top B-parties, call duration, nighttime activity, and cell tower clustering.
  * Geolocates IP login addresses to pinpoint VPN usage or geographic anomaly.
* **Risk Scoring & Flag Detection**: Assigns Fraud Confidence Scores (0–100) and highlights critical risk flags (e.g. *"Account balance emptied within 14 minutes of fraud credit"*).
* **Interactive Data Visualizations**: Rendered via Recharts (Transaction Volume Bar Charts, Counterparty Pie Charts, IP Login Timelines).

---

### 📓 Module 6: Court Case Diary & Judicial Register Timeline
* **Statutory Compliance**: Maintained strictly under **Section 167 BNSS** (formerly Section 173 CrPC) for production before Judicial Magistrates.
* **Chronological Activity Log**: Automatically aggregates every investigation event, ingested complaint, generated legal notice, dispatched email, and forensic analysis with timestamp and officer badge signatures.
* **Section 63 BSA Digital Evidence Certificate**:
  * Automatically compiles SHA-256 digital hashes for all uploaded electronic evidence, PDFs, and parsed logs.
  * Formats official Section 63 BSA admissibility certificate for court submission.
* **Final Charge Sheet Recommendation**: Synthesizes complete investigation findings into a formal charge sheet draft under Section 193 BNSS, ready for judicial filing.

---

## ⚡ Quick Start & Installation Guide

### Prerequisites
* **Docker Desktop** (v24.0+) & **Docker Compose** (v2.20+)
* *Alternative local run*: **Node.js** (v18+), **Python** (3.11+), **PostgreSQL** (v16), **Qdrant Vector DB**

---

### Method 1: One-Click Docker Deployment (Recommended)

1. **Clone Repository**:
   ```bash
   git clone https://github.com/NevilVataliya/comlpete-CrimeOS.git
   cd comlpete-CrimeOS
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory (copy from `.env.example`):
   ```env
   # API Keys (Provide at least one cloud key or use offline mode)
   GEMINI_API_KEY=your_gemini_api_key_here
   GROQ_API_KEY=your_groq_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   
   # System Configuration
   OFFLINE_MODE=false
   ENABLE_DEMO_FALLBACKS=false
   COLLECTION_NAME=police_sops_v2
   
   # Database Credentials
   POSTGRES_DB=crimeos_db
   POSTGRES_USER=crimeos_user
   POSTGRES_PASSWORD=crimeos_password
   DATABASE_URL=postgresql://crimeos_user:crimeos_password@postgres:5432/crimeos_db
   
   # SMTP Email Credentials (For Subpoena Dispatch & Followback)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_official_email@police.gov.in
   SMTP_PASS=your_app_password
   SENDER_EMAIL=your_official_email@police.gov.in
   SENDER_NAME="Cyber Crime Investigation Cell"
   ```

3. **Launch Container Suite**:
   ```bash
   docker-compose up --build -d
   ```

4. **Verify Running Containers**:
   ```bash
   docker ps
   ```
   *Services mapped:*
   * 🌐 **Frontend UI**: `http://localhost:3000`
   * 🔌 **Node Gateway**: `http://localhost:4000`
   * 🧠 **FastAPI AI Backend**: `http://localhost:8000`
   * 🔍 **Qdrant Vector Dashboard**: `http://localhost:6333/dashboard`
   * 🗄️ **PostgreSQL**: `localhost:5432`

---

### Method 2: Manual Local Development Setup

#### 1. Database Setup
Ensure PostgreSQL 16 is running locally and initialize the database schema:
```bash
psql -U postgres -d crimeos_db -f database/schema.sql
```

#### 2. AI Backend Setup (FastAPI)
```bash
cd ai-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. Ingest SOP Documents into Qdrant Vector Store
```bash
cd database
python ingest_pdfs.py
```

#### 4. API Gateway Setup (Node.js)
```bash
cd gateway
npm install
npm run dev
```

#### 5. Frontend Setup (React Vite)
```bash
cd frontend
npm install
npm run dev
```

Access the application at `http://localhost:5173` or `http://localhost:3000`.

---

## 🔑 Pre-Configured Test Credentials

For quick evaluation, use the following pre-seeded badge credentials (password for all seed accounts: `police123`):

| Role | Username | Badge ID | Designation & Station |
| :--- | :--- | :--- | :--- |
| **Investigating Officer (IO)** | `io_patel` | `PSI-9921` | PSI Inspector V. K. Patel (Surat Cyber Crime Cell) |
| **Station House Officer (SHO)** | `sho_sharma` | `PI-4012` | PI Senior Inspector R. S. Sharma (Surat Cyber Station) |
| **Legal Advisor** | `legal_desai` | `LEG-1092` | Adv. A. M. Desai (State CID Legal Cell) |
| **System Administrator** | `admin_crimeos` | `ADM-0001` | System Administrator (Crime OS Headquarters) |

---

## 🔄 End-to-End Operational Workflow Example

```
 1. Complaint Intake (Module 1)
    └── Upload Gujarati PDF / Handwritten Panchnama / Audio
    └── AI extracts monetary loss (e.g. ₹9,00,000), Phone + Bank Entities

 2. Serial Linkage Check (Module 2)
    └── System identifies matching VPA in 2 prior FIRs from Ahmedabad Cyber Cell
    └── Renders interactive network link graph & alerts officer

 3. Investigation Studio Execution (Module 3)
    └── LangGraph triggers Parallel Pods (BNS, BSA, Cyber, Field)
    └── BNS Specialist maps BNS 318(4) [Cheating] & BNS 319 [Personation]
    └── Evaluator Node verifies zero hallucinations & approves safe plan

 4. Turnkey Notice Dispatch (Module 4)
    └── Generates Section 94 BNSS Notice to Bank Nodal Officer
    └── Dispatches PDF via SMTP with police digital header

 5. Automated Compliance Ingestion & Followback (Module 4 & 5)
    └── IMAP monitor ingests Bank CSV response email
    └── Pandas analytics profiles 142 transactions; detects layering
    └── Groq LLM identifies missing account holder KYC & drafts followback email

 6. Case Diary & Charge Sheet Generation (Module 6)
    └── Compiles Section 167 BNSS chronological timeline
    └── Generates Section 63 BSA Certificate with SHA-256 evidence hashes
    └── Produces draft Charge Sheet under Section 193 BNSS for Magistrate
```

---

## 🌟 Unique Value & Technical Innovations

1. **Native Indian Criminal Law Compliance**: Uniquely tailored for the 2023 Bharatiya Nyaya Sanhita overhaul, ensuring all police outputs pass judicial scrutiny in court.
2. **Deterministic Anti-Hallucination & Victim Safety Filter**: Built-in safety guardrails in LangGraph prevent AI hallucinated accounts and strictly protect victim funds from wrongful lien marks.
3. **Multilingual Regional OCR Engine**: Handles handwritten police Panchnamas in regional Indian languages (Gujarati, Hindi, English) and normalizes Indian numerical formats.
4. **Turnkey Statutory PDF Requisition Engine**: Produces legal notices complete with official police seals, ready for immediate dispatch.
5. **Closed-Loop Inbox Monitor with Automated Followback**: Reads compliance emails, detects incomplete provider responses, and drafts statutory follow-up notices without officer typing.
6. **Air-Gapped Local Offline Capability**: Capable of executing 100% locally on local GPUs/CPUs without cloud API dependency for high-security environments.

---

## 🚀 Future Roadmap & Vision

- 🔗 **CCTNS & ICJS Seamless Integration**: Direct API sync with Crime and Criminal Tracking Network & Systems (CCTNS) and Inter-operable Criminal Justice System (ICJS).
- 🚨 **1930 CFCFRMS Automated Integration**: Instant 1-click trigger to National Cyber Crime Reporting Portal (NCRP) for immediate bank account freezing within the golden hour.
- 🖧 **Local GPU Model Fine-Tuning**: On-premise quantized LLM deployment (via Ollama / vLLM) with fine-tuned Indian Legal Llama 3 models for zero-cloud data privacy.
- 🕸️ **Advanced Graph Neural Networks (GNN)**: Deep PyTorch Geometric GNN integration for multi-bank mule account ring detection across state borders.
- 📱 **Voice-to-Panchnama Field Mobile App**: Mobile application enabling IOs to dictate scene findings and instantly generate BNSS 105 Panchnama drafts on site.

---

## 🛡️ License & Legal Disclaimer

* **License**: Open-source under the **MIT License**.
* **Disclaimer**: *Crime OS AI is an investigative decision-support platform designed to assist authorized law enforcement officers. All statutory notices, legal decisions, and charge sheets generated by the system require final review and official authorization by a qualified Police Officer (IO/SHO) under applicable law.*
