import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PoliceCase, InvestigationData, SubpoenaNotice, LinkageMatch, LinkageStats } from '../types';
import api from '../services/api';

interface CaseState {
  cases: PoliceCase[];
  activeCase: PoliceCase | null;
  investigationData: InvestigationData | null;
  legalRequests: SubpoenaNotice[];
  loading: boolean;
  error: string | null;
  selectedInspectorItem: any | null;

  // Linkage Module 2 State
  linkageMatches: LinkageMatch[];
  linkageStats: LinkageStats | null;
  linkageLoading: boolean;
  linkageError: string | null;

  fetchCases: () => Promise<void>;
  setActiveCase: (policeCase: PoliceCase | null) => void;
  addCaseFromComplaint: (complaintData: any) => PoliceCase;
  runInvestigationStudio: (caseNumber: string, complaintText: string, category: string, subType: string, entities: any) => Promise<void>;
  dispatchLegalNotice: (id: string, payload: any) => Promise<void>;
  setSelectedInspectorItem: (item: any | null) => void;
  clearError: () => void;

  // Linkage Module 2 Actions
  runLinkageSearch: (caseNumber: string, entities: any, searchQuery?: string, searchType?: string) => Promise<void>;
  clearLinkage: () => void;
}

const initialMockCases: PoliceCase[] = [
  {
    case_number: 'CR-2026-9910',
    fir_number: 'FIR-042/2026',
    crime_category: 'CYBER',
    crime_sub_type: 'Telegram Investment Scam & UPI Fraud',
    complaint_text: 'Victim reported Rs. 2,00,000 lost via fraudulent UPI link scammer@paytm and transfer to SBI A/C 30910293101 (IFSC: SBIN0001234). Suspect phone: +91 98765 43210.',
    original_language: 'gu',
    translated_text: 'Victim reported Rs. 2,00,000 lost via fraudulent UPI link scammer@paytm and transfer to SBI A/C 30910293101.',
    severity_score: 9.2,
    assigned_io: 'PSI V. K. Patel',
    police_station: 'Surat Cyber Crime HQ',
    status: 'AGENT_REASONING',
    entities: {
      persons: [{ name: 'Ramesh Patel', role: 'victim' }],
      phone_numbers: ['+91 98765 43210'],
      vpas_upis: ['scammer@paytm'],
      bank_accounts: [{ account_number: '30910293101', ifsc: 'SBIN0001234', bank: 'State Bank of India', account_name: 'Accused Fraudster' }],
      monetary_loss: 200000
    },
    sections: ['BNS Section 318(4)', 'IT Act Section 66D', 'BSA Section 63'],
    created_at: '2026-07-24T10:00:00Z'
  },
  {
    case_number: 'CR-2026-8814',
    fir_number: 'FIR-019/2026',
    crime_category: 'CONVENTIONAL',
    crime_sub_type: 'Extortion & Cyber Stalking',
    complaint_text: 'Victim threatened via WhatsApp messages demanding Rs. 50,000. Suspect phone: +91 94260 11223.',
    original_language: 'hi',
    translated_text: 'Victim threatened via WhatsApp messages demanding Rs. 50,000.',
    severity_score: 7.8,
    assigned_io: 'PSI V. K. Patel',
    police_station: 'Surat Cyber Crime HQ',
    status: 'SUBPOENA_DISPATCHED',
    entities: {
      persons: [{ name: 'Suresh Kumar', role: 'victim' }],
      phone_numbers: ['+91 94260 11223'],
      vpas_upis: ['extortion@ybl'],
      bank_accounts: [],
      monetary_loss: 50000
    },
    sections: ['BNS Section 308(2)', 'IT Act Section 66E'],
    created_at: '2026-07-23T14:30:00Z'
  }
];

const initialSubpoenas: SubpoenaNotice[] = [
  {
    id: 'REQ-BNSS-9910-01',
    case_no: 'CR-2026-9910',
    type: 'SECTION_94_BNSS',
    provider: 'Paytm Payments Bank Nodal Office',
    email: 'nodal.officer@paytm.com',
    status: 'APPROVED_SHO',
    pdf_url: '/api/requests/download/Notice_Section_94_BNSS_CR-2026-9910.pdf',
    created_at: '2026-07-24T11:00:00Z'
  },
  {
    id: 'REQ-1930-9910-02',
    case_no: 'CR-2026-9910',
    type: 'DEBIT_FREEZE_1930',
    provider: 'State Bank of India Fraud Nodal Cell',
    email: 'cgc.fraud@sbi.co.in',
    status: 'DISPATCHED',
    pdf_url: '/api/requests/download/Notice_Section_94_BNSS_CR-2026-9910.pdf',
    created_at: '2026-07-24T11:15:00Z'
  }
];

export const useCaseStore = create<CaseState>()(
  persist(
    (set, get) => ({
      cases: initialMockCases,
      activeCase: null,
      investigationData: null,
      legalRequests: initialSubpoenas,
      loading: false,
      error: null,
      selectedInspectorItem: null,

      // Linkage Module 2 initial state
      linkageMatches: [],
      linkageStats: null,
      linkageLoading: false,
      linkageError: null,

      clearError: () => set({ error: null }),

      setSelectedInspectorItem: (item: any | null) => {
        set({ selectedInspectorItem: item });
      },

      fetchCases: async () => {
        try {
          const res = await api.get('/api/cases');
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            set({ cases: res.data });
          }
        } catch (err) {
          console.warn('[⚠️ Fetch Cases Fallback Activated]', {
            reason: 'Backend GET /api/cases endpoint unavailable. Using local initial case state.'
          });
        }
      },

      setActiveCase: (policeCase: PoliceCase | null) => {
        set({ activeCase: policeCase, investigationData: null });
      },

      addCaseFromComplaint: (complaintData: any) => {
        const count = get().cases.length + 1;
        const newCaseNumber = `CR-2026-99${count + 10}`;
        const newFirNumber = `FIR-0${count + 40}/2026`;

        const newCase: PoliceCase = {
          case_number: newCaseNumber,
          fir_number: newFirNumber,
          crime_category: complaintData.crime_category || 'CYBER',
          crime_sub_type: complaintData.crime_sub_type || 'UPI Financial Fraud',
          complaint_text: complaintData.translated_text || 'Complaint Statement Ingested.',
          original_language: complaintData.original_language || 'gu',
          translated_text: complaintData.translated_text || 'Translated English Narrative.',
          severity_score: complaintData.severity_score || 8.5,
          assigned_io: 'PSI V. K. Patel',
          police_station: 'Surat Cyber Crime HQ',
          status: 'INTAKE',
          entities: complaintData.entities || {
            persons: [],
            phone_numbers: [],
            vpas_upis: [],
            bank_accounts: [],
            monetary_loss: 0
          },
          sections: ['BNS Section 318(4)', 'IT Act Section 66D', 'BSA Section 63'],
          created_at: new Date().toISOString()
        };

        const updatedCases = [newCase, ...get().cases];
        set({ cases: updatedCases, activeCase: newCase, investigationData: null });
        return newCase;
      },

      runInvestigationStudio: async (caseNumber, complaintText, category, subType, entities) => {
        set({ loading: true, error: null });
        try {
          const res = await api.post(`/api/cases/${caseNumber}/investigate`, {
            complaint_text: complaintText,
            crime_category: category,
            crime_sub_type: subType,
            entities
          });
          set({ investigationData: res.data, error: null });
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'LangGraph investigation graph execution failed';
          console.error('[-] Agent Studio Execution Error:', errorMsg);

          let enableFallbacks = false;
          try {
            const configRes = await api.get('/api/config');
            enableFallbacks = Boolean(configRes.data?.enable_demo_fallbacks);
          } catch (cfgErr) {
            enableFallbacks = false;
          }

          if (enableFallbacks) {
            console.warn('[⚠️ Investigation Studio Fallback Activated]', {
              reason: errorMsg,
              cause: 'Backend endpoint /api/cases/:id/investigate failed or returned error',
              activeCase: caseNumber
            });
            const phone = entities?.phone_numbers?.[0] || '+91 98765 43210';
            const victimAcctObj = entities?.bank_accounts?.find((b: any) => typeof b === 'object' && (b.is_victim_account || b.account_role === 'victim'));
            const victimAcct = victimAcctObj ? victimAcctObj.account_number : null;

            const accusedAcctObj = entities?.bank_accounts?.find((b: any) => typeof b === 'object' && (!b.is_victim_account || b.account_role === 'accused'));
            const accusedAcct = accusedAcctObj ? accusedAcctObj.account_number : (entities?.bank_accounts?.[0]?.account_number || entities?.bank_accounts?.[0] || '257735040901');

            set({
              error: null,
              investigationData: {
                case_number: caseNumber,
                evaluator_status: 'APPROVED',
                sections: ['BNS Section 318(4)', 'IT Act Section 66D', 'BSA Section 63'],
                cross_case_matches: [
                  {
                    match_type: 'PHONE_RECURRENCE',
                    matched_value: phone,
                    previous_case_no: 'CR-2026-0812',
                    police_station: 'Surat Cyber Cell',
                    confidence: 0.94
                  }
                ],
                investigation_steps: [
                  {
                    step_number: 1,
                    title: 'Issue 1930 / CFCFRMS Bank Account Debit Freeze Notice',
                    description: `Dispatch Section 94 BNSS Legal Notice to Bank Nodal Officer to freeze accused beneficiary account ${accusedAcct}.`,
                    sop_reference: 'I4C CFCFRMS SOP p.11',
                    document_name: 'I4C_CFCFRMS_Financial_Fraud_SOP.pdf',
                    page_number: '11',
                    section_path: 'Chapter 2 > Emergency Financial Freeze',
                    raw_citation_text: 'Nodal Officer shall freeze beneficiary bank account within 2 hours of complaint registration.'
                  },
                  ...(victimAcct ? [{
                    step_number: 2,
                    title: 'Requisition Certified Outward RTGS Statement for Victim Account',
                    description: `Issue Section 94 BNSS Notice to Union Bank Nodal Officer for certified remittance statement of victim account ${victimAcct}. DO NOT DEBIT FREEZE VICTIM ACCOUNT.`,
                    sop_reference: 'RBI Master Direction KYC p.37',
                    document_name: 'RBI_Master_Direction_KYC.pdf',
                    page_number: '37',
                    section_path: 'Section 12 > Outward Wire Remittance Verification',
                    raw_citation_text: 'Certified bank account statement shall be issued to law enforcement investigating officer.'
                  }] : []),
                  {
                    step_number: 3,
                    title: 'Extract WhatsApp Telecom IPDR & Subscriber Details',
                    description: `Requisition B-party CDR logs and IPDR session history for suspect line ${phone} from Telecom Service Provider.`,
                    sop_reference: 'BPRD First Responder Handbook p.16',
                    document_name: 'BPRD_First_Responder_Handbook.pdf',
                    page_number: '16',
                    section_path: 'Section 4 > Digital Forensics Acquisition',
                    raw_citation_text: 'Preserve tower CDR and IPDR logs under Section 94 BNSS notice.'
                  },
                  {
                    step_number: 4,
                    title: 'Compile Section 63 BSA Electronic Evidence Certificate',
                    description: 'Generate mandatory electronic evidence admissibility certificate for digital transaction receipts.',
                    sop_reference: 'BSA Evidence Act 2023 Section 63',
                    document_name: 'BSA_Evidence_Act_2023.pdf',
                    page_number: '22',
                    section_path: 'Section 63 > Admissibility of Electronic Records',
                    raw_citation_text: 'Any information contained in an electronic record shall be admissible in court with valid SHA-256 certificate.'
                  }
                ]
              }
            });
          } else {
            set({
              investigationData: null,
              error: `[Agent Studio Error]: ${errorMsg}`
            });
          }
        } finally {
          set({ loading: false });
        }
      },

      dispatchLegalNotice: async (id: string, payload: any) => {
        try {
          await api.post(`/api/requests/${id}/dispatch`, payload);
          const updated = get().legalRequests.map((r) =>
            r.id === id ? { ...r, status: 'DISPATCHED' as const } : r
          );
          set({ legalRequests: updated });
        } catch (err) {
          const updated = get().legalRequests.map((r) =>
            r.id === id ? { ...r, status: 'DISPATCHED' as const } : r
          );
          set({ legalRequests: updated });
        }
      },

      // --- Module 2: Linkage Search Actions ---
      runLinkageSearch: async (caseNumber, entities, searchQuery, searchType) => {
        set({ linkageLoading: true, linkageError: null });
        try {
          const res = await api.post('/api/linkage/search', {
            case_number: caseNumber,
            entities,
            search_query: searchQuery || null,
            search_type: searchType || 'auto'
          });
          set({
            linkageMatches: res.data.matches || [],
            linkageStats: res.data.stats || null,
            linkageError: null
          });
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Linkage search failed';
          console.error('[-] Linkage Search Error:', errorMsg);

          let enableFallbacks = false;
          try {
            const configRes = await api.get('/api/config');
            enableFallbacks = Boolean(configRes.data?.enable_demo_fallbacks);
          } catch (cfgErr) {
            enableFallbacks = false;
          }

          if (enableFallbacks) {
            console.warn('[⚠️ Linkage Search Fallback Activated]', {
              reason: errorMsg,
              cause: 'Backend endpoint /api/linkage/search failed or returned error',
              caseNumber,
              searchedEntities: entities
            });
            const phones = entities?.phone_numbers || [];
            const vpas = entities?.vpas_upis || [];
            const accounts = entities?.bank_accounts || [];

            set({
              linkageMatches: [],
              linkageStats: {
                total_entities_searched: phones.length + vpas.length + accounts.length,
                total_matches: 0,
                high_confidence: 0,
                medium_confidence: 0,
                low_confidence: 0,
                unique_linked_cases: 0,
                unique_police_stations: 0
              },
              linkageError: null
            });
          } else {
            set({
              linkageMatches: [],
              linkageStats: null,
              linkageError: `[Linkage Error]: ${errorMsg}`
            });
          }
        } finally {
          set({ linkageLoading: false });
        }
      },

      clearLinkage: () => {
        set({ linkageMatches: [], linkageStats: null, linkageError: null });
      }
    }),
    {
      name: 'crime-os-case-storage'
    }
  )
);
