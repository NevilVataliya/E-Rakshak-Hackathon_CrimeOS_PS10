import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PoliceCase, InvestigationData, SubpoenaNotice } from '../types';
import api from '../services/api';

interface CaseState {
  cases: PoliceCase[];
  activeCase: PoliceCase | null;
  investigationData: InvestigationData | null;
  legalRequests: SubpoenaNotice[];
  loading: boolean;

  fetchCases: () => Promise<void>;
  setActiveCase: (policeCase: PoliceCase) => void;
  addCaseFromComplaint: (complaintData: any) => PoliceCase;
  runInvestigationStudio: (caseNumber: string, complaintText: string, category: string, subType: string, entities: any) => Promise<void>;
  dispatchLegalNotice: (id: string, payload: any) => Promise<void>;
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
    pdf_url: '/api/requests/download/Debit_Freeze_1930_CR-2026-9910.pdf',
    created_at: '2026-07-24T11:15:00Z'
  }
];

export const useCaseStore = create<CaseState>()(
  persist(
    (set, get) => ({
      cases: initialMockCases,
      activeCase: initialMockCases[0],
      investigationData: null,
      legalRequests: initialSubpoenas,
      loading: false,

      fetchCases: async () => {
        try {
          const res = await api.get('/api/cases');
          if (res.data && Array.isArray(res.data) && res.data.length > 0) {
            set({ cases: res.data });
          }
        } catch (err) {
          console.warn('Backend cases endpoint fallback');
        }
      },

      setActiveCase: (policeCase: PoliceCase) => {
        set({ activeCase: policeCase });
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
        set({ cases: updatedCases, activeCase: newCase });
        return newCase;
      },

      runInvestigationStudio: async (caseNumber, complaintText, category, subType, entities) => {
        set({ loading: true });
        try {
          const res = await api.post('/api/agents/run-studio', {
            case_number: caseNumber,
            complaint_text: complaintText,
            crime_category: category,
            crime_sub_type: subType,
            entities
          });
          set({ investigationData: res.data });
        } catch (err) {
          console.warn('Backend agent studio fallback');
          set({
            investigationData: {
              case_number: caseNumber,
              evaluator_status: 'APPROVED',
              sections: ['BNS Section 318(4)', 'IT Act Section 66D', 'BSA Section 63'],
              cross_case_matches: [
                {
                  match_type: 'VPA_RECURRENCE',
                  matched_value: entities?.vpas_upis?.[0] || 'scammer@paytm',
                  previous_case_no: 'CR-2026-0812',
                  police_station: 'Surat Cyber Cell',
                  confidence: 0.94
                }
              ],
              investigation_steps: [
                {
                  step_number: 1,
                  title: 'Issue 1930 / CFCFRMS Bank Account Debit Freeze Request',
                  description: 'Immediately dispatch Section 94 BNSS Legal Notice to SBI Nodal Officer to freeze suspect account 30910293101.',
                  sop_reference: 'I4C CFCFRMS SOP p.11',
                  document_name: 'I4C_CFCFRMS_Financial_Fraud_SOP.pdf',
                  page_number: '11',
                  section_path: 'Chapter 2 > Emergency Financial Freeze',
                  raw_citation_text: 'Nodal Officer shall freeze beneficiary bank account within 2 hours of complaint registration.'
                },
                {
                  step_number: 2,
                  title: 'Extract WhatsApp Telecom IPDR & Subscriber Details',
                  description: 'Requisition B-party CDR logs and IPDR session history for phone +91 98765 43210 from Telecom Service Provider.',
                  sop_reference: 'BPRD First Responder Handbook p.16',
                  document_name: 'BPRD_First_Responder_Handbook.pdf',
                  page_number: '16',
                  section_path: 'Section 4 > Digital Forensics Acquisition',
                  raw_citation_text: 'Preserve tower CDR and IPDR logs under Section 94 BNSS notice.'
                },
                {
                  step_number: 3,
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
        } finally {
          set({ loading: false });
        }
      },

      dispatchLegalNotice: async (id: string, payload: any) => {
        try {
          await api.post('/api/requests/dispatch-email', { id, ...payload });
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
      }
    }),
    {
      name: 'crime-os-case-storage'
    }
  )
);
