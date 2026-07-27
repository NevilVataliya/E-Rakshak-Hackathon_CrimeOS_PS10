export type CrimeCategory = 'CYBER' | 'CONVENTIONAL' | 'WOMEN_CHILD' | 'FINANCIAL';

export interface BankAccount {
  account_number: string;
  ifsc: string;
  bank: string;
  account_name?: string;
}

export interface ExtractedEntities {
  persons: Array<{ name: string; role: 'victim' | 'suspect' | 'witness' }>;
  phone_numbers: string[];
  vpas_upis: string[];
  bank_accounts: BankAccount[];
  monetary_loss: number;
}

export interface PoliceCase {
  case_number: string;
  fir_number: string;
  crime_category: CrimeCategory;
  crime_sub_type: string;
  complaint_text: string;
  original_language: string;
  translated_text: string;
  severity_score: number;
  assigned_io: string;
  police_station: string;
  status: 'INTAKE' | 'LINKED' | 'AGENT_REASONING' | 'SUBPOENA_DISPATCHED' | 'CDR_PARSED' | 'COURT_READY';
  entities: ExtractedEntities;
  sections: string[];
  created_at: string;
}

export interface GroundedSOPStep {
  step_number: number;
  title: string;
  description: string;
  sop_reference: string;
  document_name: string;
  page_number: string;
  section_path: string;
  raw_citation_text: string;
}

export interface InvestigationData {
  case_number: string;
  investigation_steps: GroundedSOPStep[];
  cross_case_matches: Array<{
    match_type: string;
    matched_value: string;
    previous_case_no: string;
    police_station: string;
    confidence: number;
  }>;
  sections: string[];
  evaluator_status: 'APPROVED' | 'RETRYING';
}

export interface SubpoenaNotice {
  id: string;
  case_no: string;
  type: 'SECTION_94_BNSS' | 'DEBIT_FREEZE_1930' | 'SECTION_91_CRPC' | 'NODAL_SUBPOENA';
  provider: string;
  email: string;
  status: 'DRAFT' | 'APPROVED_SHO' | 'DISPATCHED';
  pdf_url: string;
  created_at: string;
}

export interface User {
  username: string;
  full_name: string;
  role: 'IO' | 'SHO' | 'LEGAL_ADVISOR' | 'ADMIN';
  police_station: string;
}
