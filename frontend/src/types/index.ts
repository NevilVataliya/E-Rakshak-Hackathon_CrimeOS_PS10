export type CrimeCategory = 'CYBER' | 'CONVENTIONAL' | 'WOMEN_CHILD' | 'FINANCIAL' | 'HYBRID';

export interface PersonEntity {
  name: string;
  role: 'victim' | 'accused' | 'suspect' | 'witness';
}

export interface BankAccountEntity {
  account_number: string;
  ifsc: string;
  bank: string;
  account_name?: string;
}

export interface ExtractedEntities {
  persons: PersonEntity[];
  phone_numbers: string[];
  online_handles?: string[];
  vpas_upis: string[];
  bank_accounts: BankAccountEntity[];
  imei_numbers?: string[];
  monetary_loss: number;
  crime_locations?: string[];
  date_time_of_incident?: string;
}

export interface CaseActivityLog {
  timestamp: string;
  module: string;
  step_title: string;
  details: string;
  officer?: string;
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
  activity_timeline?: CaseActivityLog[];
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

export interface CrossCaseMatch {
  match_type: string;
  matched_value: string;
  previous_case_no: string;
  police_station: string;
  confidence: number;
}

export interface InvestigationData {
  case_number: string;
  investigation_steps: GroundedSOPStep[];
  cross_case_matches: CrossCaseMatch[];
  sections: string[];
  evaluator_status: 'APPROVED' | 'RETRYING';
  summary?: string;
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

export interface BPartyRecord {
  phone: string;
  call_count: number;
  total_duration_min: number;
}

export interface TowerLocationRecord {
  tower_id: string;
  location_name: string;
  frequency: number;
}

export interface CDRAnalysisResult {
  status: string;
  response_type: string;
  total_records: number;
  date_range: string;
  top_b_parties: BPartyRecord[];
  night_calls_count: number;
  top_tower_locations: TowerLocationRecord[];
  imei_history: string[];
  executive_summary: string;
  recommended_next_action: string;
}

export interface LinkageMatch {
  entity_type: 'phone' | 'vpa' | 'bank_account' | 'manual';
  entity_value: string;
  match_type: string;
  matched_case: string;
  matched_fir: string;
  police_station: string;
  confidence: number;
  description: string;
  recommended_action: string;
}

export interface LinkageStats {
  total_entities_searched: number;
  total_matches: number;
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  unique_linked_cases: number;
  unique_police_stations: number;
}

export interface LinkageSearchResult {
  status: string;
  case_number: string;
  matches: LinkageMatch[];
  stats: LinkageStats;
}

export interface User {
  username: string;
  full_name: string;
  role: 'IO' | 'SHO' | 'LEGAL_ADVISOR' | 'ADMIN';
  police_station: string;
}

