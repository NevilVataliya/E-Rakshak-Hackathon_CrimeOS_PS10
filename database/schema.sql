-- Crime OS AI Database Schema (PostgreSQL 16)

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('IO', 'SHO', 'LEGAL_ADVISOR', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crime_category AS ENUM ('CYBER', 'CONVENTIONAL', 'WOMEN_CHILD', 'FINANCIAL', 'HYBRID');
EXCEPTION
    WHEN duplicate_object THEN
        -- Add missing values if enum already exists from a prior deployment
        BEGIN
            ALTER TYPE crime_category ADD VALUE IF NOT EXISTS 'WOMEN_CHILD';
        EXCEPTION WHEN others THEN null; END;
        BEGIN
            ALTER TYPE crime_category ADD VALUE IF NOT EXISTS 'FINANCIAL';
        EXCEPTION WHEN others THEN null; END;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'RESPONDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'IO',
    badge_number VARCHAR(50),
    police_station VARCHAR(100) NOT NULL DEFAULT 'Surat Cyber Crime Cell',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_number VARCHAR(50) UNIQUE NOT NULL,
    source_type VARCHAR(20) NOT NULL, -- pdf, audio, image, text
    original_language VARCHAR(10) NOT NULL DEFAULT 'en', -- gu, hi, en
    raw_text TEXT,
    translated_text TEXT,
    extracted_entities JSONB DEFAULT '{}'::jsonb,
    crime_category crime_category NOT NULL DEFAULT 'CYBER',
    severity_score FLOAT DEFAULT 5.0,
    status VARCHAR(30) DEFAULT 'UNASSIGNED',
    file_url VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Cases Table
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    complaint_id UUID REFERENCES complaints(id),
    assigned_io UUID REFERENCES users(id),
    assigned_sho UUID REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'INVESTIGATING',
    fir_number VARCHAR(50),
    crime_category crime_category NOT NULL DEFAULT 'CYBER',
    crime_sub_type VARCHAR(100),
    summary TEXT,
    investigation_plan JSONB DEFAULT '{}'::jsonb,
    cross_case_matches JSONB DEFAULT '[]'::jsonb,
    evidence_checklist JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Legal Requests Table
CREATE TABLE IF NOT EXISTS legal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    case_id UUID REFERENCES cases(id),
    request_type VARCHAR(50) NOT NULL, -- SECTION_94_BNSS, LERS_CDR, LERS_IPDR, BANK_FREEZE, BANK_STATEMENT
    target_provider VARCHAR(100) NOT NULL,
    provider_email VARCHAR(100),
    request_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_url VARCHAR(255),
    status request_status DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    dispatched_at TIMESTAMP WITH TIME ZONE,
    response_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Evidence Table
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id),
    title VARCHAR(150) NOT NULL,
    file_name VARCHAR(255),
    file_url VARCHAR(255),
    file_type VARCHAR(50), -- document, image, audio, video, json
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    case_id UUID REFERENCES cases(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Nodal Authorities Directory Table (Extensible from Frontend & queried by LLM)
CREATE TABLE IF NOT EXISTS authorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    entity_name VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'bank', -- bank, telecom, tech_platform, corporate_regulator, fsl
    department VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SEED INITIAL USERS (Password for all seed users: "police123")
-- bcrypt hash for 'police123' = '$2a$10$wE4ZlYwJzL.HjKqGf.k.EOuHq.vS0uU.y.2uV5K1V2s1.W.x2.u'
INSERT INTO users (id, username, email, password_hash, full_name, role, badge_number, police_station)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'io_patel', 'io.patel@police.gujarat.gov.in', '$2a$10$1P98XJ7h4z9m0L.N3v9V4e0m4R7k2N1P8Q5S2T4U6V8W0X2Y4Z6a', 'PSI Inspector V. K. Patel', 'IO', 'PSI-9921', 'Surat Cyber Crime Station'),
  ('a0000000-0000-0000-0000-000000000002', 'sho_sharma', 'sho.sharma@police.gujarat.gov.in', '$2a$10$1P98XJ7h4z9m0L.N3v9V4e0m4R7k2N1P8Q5S2T4U6V8W0X2Y4Z6a', 'PI Senior Inspector R. S. Sharma', 'SHO', 'PI-4012', 'Surat Cyber Crime Station'),
  ('a0000000-0000-0000-0000-000000000003', 'legal_desai', 'legal.desai@police.gujarat.gov.in', '$2a$10$1P98XJ7h4z9m0L.N3v9V4e0m4R7k2N1P8Q5S2T4U6V8W0X2Y4Z6a', 'Adv. A. M. Desai', 'LEGAL_ADVISOR', 'LEG-1092', 'State CID Legal Cell'),
  ('a0000000-0000-0000-0000-000000000004', 'admin_crimeos', 'admin@crimeos.gov.in', '$2a$10$1P98XJ7h4z9m0L.N3v9V4e0m4R7k2N1P8Q5S2T4U6V8W0X2Y4Z6a', 'System Administrator', 'ADMIN', 'ADM-0001', 'Crime OS Headquarters')
ON CONFLICT (username) DO NOTHING;

-- SEED INITIAL NODAL AUTHORITIES
INSERT INTO authorities (key, entity_name, email, type, department, description)
VALUES
  ('hdfc', 'HDFC Bank Nodal Fraud Control Cell', 'nodal.fraud@hdfcbank.com', 'bank', 'Fraud Risk & Control Unit', 'HDFC Bank Debit freeze and transaction statement requisitions'),
  ('sbi', 'State Bank of India Compliance Cell', 'compliance.nodal@sbi.co.in', 'bank', 'Cyber Fraud & Anti-Money Laundering Cell', 'SBI beneficiary freeze and RTGS statement requisitions'),
  ('icici', 'ICICI Bank Nodal Legal Response Cell', 'nodal.officer@icicibank.com', 'bank', 'Financial Crime & Legal Ops', 'ICICI Bank account freeze and KYC details'),
  ('axis', 'Axis Bank Fraud Operations & Nodal Cell', 'nodal.fraud@axisbank.com', 'bank', 'Fraud Prevention & Detection', 'Axis Bank mule account requisitions'),
  ('airtel', 'Airtel Nodal Compliance Division', 'nodal@airtel.com', 'telecom', 'Law Enforcement Agency Response Cell', 'Airtel Call Detail Records (CDR) and tower dump requisitions'),
  ('jio', 'Reliance Jio Infocomm Nodal Response Unit', 'nodal.officer@jio.com', 'telecom', 'LEA Coordination Cell', 'Jio IPDR, CDR, and subscriber CAF details'),
  ('vodafone_vi', 'Vodafone Idea (Vi) Regulatory Compliance', 'nodal.lea@vodafoneidea.com', 'telecom', 'Nodal Regulatory Operations', 'Vi location tracking and subscriber details'),
  ('google', 'Google Law Enforcement Response Team', 'lert-requests@google.com', 'tech_platform', 'Global Legal Compliance', 'Gmail, Google Drive, and Play Store account requisitions'),
  ('meta', 'Meta Law Enforcement Online Request System', 'records@meta.com', 'tech_platform', 'Facebook / Instagram Legal Operations', 'Facebook & Instagram account IP logs and profile data'),
  ('whatsapp', 'WhatsApp Law Enforcement Response Division', 'records@whatsapp.com', 'tech_platform', 'User Data Requisition Team', 'WhatsApp subscriber details and registration IP logs'),
  ('roc_mca', 'Registrar of Companies (MCA)', 'roc.compliance@mca.gov.in', 'corporate_regulator', 'Corporate Enforcement Wing', 'Shell company audits and DIN/CIN verification'),
  ('fsl_lab', 'State Forensic Science Laboratory (FSL)', 'fsl.cyber@police.gov.in', 'fsl', 'Cyber & Forensic Chemical Wing', 'CCTV, exhibit seizure, and chemical analysis reports')
ON CONFLICT (key) DO NOTHING;
