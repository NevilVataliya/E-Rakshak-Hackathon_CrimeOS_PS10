import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PoliceCase, InvestigationData, SubpoenaNotice, LinkageMatch, LinkageStats, AttachedFileMeta } from '../types';
import api from '../services/api';

export interface CaseIntakeRecord {
  manual_text: string;
  attached_files: AttachedFileMeta[];
  extracted_result: any;
}

interface CaseState {
  cases: PoliceCase[];
  activeCase: PoliceCase | null;
  investigationData: InvestigationData | null;
  legalRequests: SubpoenaNotice[];
  loading: boolean;
  error: string | null;
  selectedInspectorItem: any | null;

  // Per-case state mapping for multi-case isolation
  investigationsByCase: Record<string, InvestigationData>;
  loadingByCase: Record<string, boolean>;
  errorByCase: Record<string, string | null>;
  intakeDataByCase: Record<string, CaseIntakeRecord>;
  completedStepByCase: Record<string, number>;
  dispatchedDirectivesByCase: Record<string, any[]>;
  responseAnalyticsByCase: Record<string, any>;

  saveDispatchedDirectivesForCase: (caseNumber: string, directives: any[]) => void;
  getDirectivesForCase: (caseNumber: string) => any[];
  saveResponseAnalyticsForCase: (caseNumber: string, analyticsData: any) => void;

  // Linkage Module 2 State
  linkageMatches: LinkageMatch[];
  linkageStats: LinkageStats | null;
  linkageLoading: boolean;
  linkageError: string | null;

  fetchCases: () => Promise<void>;
  setActiveCase: (policeCase: PoliceCase | null) => void;
  addCaseFromComplaint: (complaintData: any, manualText?: string, attachedFiles?: AttachedFileMeta[]) => PoliceCase;
  runInvestigationStudio: (caseNumber: string, complaintText: string, category: string, subType: string, entities: any) => Promise<void>;
  dispatchLegalNotice: (id: string, payload: any) => Promise<void>;
  setSelectedInspectorItem: (item: any | null) => void;
  clearError: () => void;
  updateCompletedStep: (caseNumber: string, stepNumber: number) => void;
  updateCaseIntakeData: (caseNumber: string, manualText: string, attachedFiles: AttachedFileMeta[]) => void;

  // Linkage Module 2 Actions
  runLinkageSearch: (caseNumber: string, entities: any, searchQuery?: string, searchType?: string) => Promise<void>;
  clearLinkage: () => void;

  // Workflow Automator HITL Approval Queue & Policy State
  // Email Response Manager & Followback System State & Actions
  processedReplies: any[];
  processedRepliesByCase: Record<string, any[]>;
  replyLoading: boolean;

  checkInboxForReplies: (caseNumber?: string, smtpCredentials?: any) => Promise<any>;
  ingestSimulatedReply: (payload: { case_number: string; sender_email: string; subject: string; body_text: string; attachments?: any[] }) => Promise<any>;
  sendFollowbackEmail: (payload: { case_number: string; recipient_email: string; subject: string; body: string; smtp_credentials?: any }) => Promise<any>;
  registerCustomTemplate: (payload: { template_id: string; title: string; category?: string; subject_template: string; body_template: string; required_vars?: string[]; legal_statute_ref?: string }) => Promise<void>;
  addTimelineEvent: (event: any) => void;
}

const sampleImgDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlIC9QYWdlcyAvQ291bnQgMCAvS2lkcyBbXSA+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0Y=';
const sampleTxtDataUrl = 'data:text/plain;charset=utf-8,CrimeOS%20Evidence%20Log';

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
    created_at: '2026-07-24T10:00:00Z',
    manual_text: 'Victim reported Rs. 2,00,000 lost via fraudulent UPI link scammer@paytm and transfer to SBI A/C 30910293101 (IFSC: SBIN0001234). Suspect phone: +91 98765 43210.',
    attached_files: [
      { name: 'UPI_Payment_Screenshot_Paytm.png', size: 482100, type: 'image/png', dataUrl: sampleImgDataUrl },
      { name: 'Bank_Statement_RTGS_Extract.pdf', size: 1240500, type: 'application/pdf', dataUrl: samplePdfDataUrl }
    ],
    completed_step: 3
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
    created_at: '2026-07-23T14:30:00Z',
    manual_text: 'Victim threatened via WhatsApp messages demanding Rs. 50,000. Suspect phone: +91 94260 11223.',
    attached_files: [
      { name: 'WhatsApp_Chat_Export_Evidence.txt', size: 52400, type: 'text/plain', dataUrl: sampleTxtDataUrl }
    ],
    completed_step: 4
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
      legalRequests: [],
      loading: false,
      error: null,
      selectedInspectorItem: null,

      // Per-case mapping initial state
      investigationsByCase: {},
      loadingByCase: {},
      errorByCase: {},
      pendingApprovalsByCase: {},
      intakeDataByCase: {
        'CR-2026-9910': {
          manual_text: 'Victim reported Rs. 2,00,000 lost via fraudulent UPI link scammer@paytm and transfer to SBI A/C 30910293101 (IFSC: SBIN0001234). Suspect phone: +91 98765 43210.',
          attached_files: [
            { name: 'UPI_Payment_Screenshot_Paytm.png', size: 482100, type: 'image/png', dataUrl: sampleImgDataUrl },
            { name: 'Bank_Statement_RTGS_Extract.pdf', size: 1240500, type: 'application/pdf', dataUrl: samplePdfDataUrl }
          ],
          extracted_result: null
        },
        'CR-2026-8814': {
          manual_text: 'Victim threatened via WhatsApp messages demanding Rs. 50,000. Suspect phone: +91 94260 11223.',
          attached_files: [
            { name: 'WhatsApp_Chat_Export_Evidence.txt', size: 52400, type: 'text/plain', dataUrl: sampleTxtDataUrl }
          ],
          extracted_result: null
        }
      },
      completedStepByCase: {
        'CR-2026-9910': 3,
        'CR-2026-8814': 4
      },
      dispatchedDirectivesByCase: {},
      responseAnalyticsByCase: {},

      getDirectivesForCase: (caseNumber: string) => {
        return get().dispatchedDirectivesByCase[caseNumber] || [];
      },

      saveDispatchedDirectivesForCase: (caseNumber: string, newDirectives: any[]) => {
        set((state) => {
          const existing = state.dispatchedDirectivesByCase[caseNumber] || [];
          const existingMap = new Map(existing.map((item: any) => [item.id || item.title, item]));

          const merged = newDirectives.map((item: any) => {
            const key = item.id || item.title;
            const prev = existingMap.get(key);
            // Preserve dispatched status if previously dispatched or responded
            if (prev && (prev.status === 'DISPATCHED_SMTP' || prev.status === 'RESPONSE_RECEIVED' || prev.status === 'AWAITING_PROVIDER_REPLY' || prev.status === 'DEFECTIVE_AWAITING_CURE')) {
              return { ...item, ...prev, status: prev.status, dispatched_at: prev.dispatched_at || item.dispatched_at };
            }
            return item;
          });

          return {
            dispatchedDirectivesByCase: {
              ...state.dispatchedDirectivesByCase,
              [caseNumber]: merged
            }
          };
        });
      },

      saveResponseAnalyticsForCase: (caseNumber: string, analyticsData: any) => {
        set((state) => ({
          responseAnalyticsByCase: {
            ...state.responseAnalyticsByCase,
            [caseNumber]: analyticsData
          }
        }));
      },

      // Linkage Module 2 initial state
      linkageMatches: [],
      linkageStats: null,
      linkageLoading: false,
      linkageError: null,

      clearError: () => set({ error: null }),

      updateCaseIntakeData: (caseNumber: string, manualText: string, attachedFiles: AttachedFileMeta[]) => {
        set((state) => {
          const existing = state.intakeDataByCase[caseNumber] || { manual_text: '', attached_files: [], extracted_result: null };
          const updatedRecord: CaseIntakeRecord = {
            ...existing,
            manual_text: manualText,
            attached_files: attachedFiles
          };

          const updatedCases = state.cases.map(c =>
            c.case_number === caseNumber
              ? { ...c, manual_text: manualText, attached_files: attachedFiles }
              : c
          );

          const updatedActive = state.activeCase?.case_number === caseNumber
            ? { ...state.activeCase, manual_text: manualText, attached_files: attachedFiles }
            : state.activeCase;

          return {
            cases: updatedCases,
            activeCase: updatedActive,
            intakeDataByCase: {
              ...state.intakeDataByCase,
              [caseNumber]: updatedRecord
            }
          };
        });
      },

      updateCompletedStep: (caseNumber: string, stepNumber: number) => {
        set((state) => {
          const current = state.completedStepByCase[caseNumber] || 0;
          if (stepNumber > current) {
            const updatedCases = state.cases.map(c =>
              c.case_number === caseNumber ? { ...c, completed_step: stepNumber } : c
            );
            const active = state.activeCase?.case_number === caseNumber
              ? { ...state.activeCase, completed_step: stepNumber }
              : state.activeCase;

            return {
              cases: updatedCases,
              activeCase: active,
              completedStepByCase: { ...state.completedStepByCase, [caseNumber]: stepNumber }
            };
          }
          return state;
        });
      },

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
        const caseNo = policeCase?.case_number;
        const invMap = get().investigationsByCase || {};
        const loadMap = get().loadingByCase || {};
        const errMap = get().errorByCase || {};
        const stepMap = get().completedStepByCase || {};

        const updatedActiveCase = policeCase ? {
          ...policeCase,
          completed_step: stepMap[policeCase.case_number] ?? policeCase.completed_step ?? 1
        } : null;

        set({
          activeCase: updatedActiveCase,
          investigationData: caseNo ? (invMap[caseNo] || null) : null,
          loading: caseNo ? Boolean(loadMap[caseNo]) : false,
          error: caseNo ? (errMap[caseNo] || null) : null,
        });
      },

      addCaseFromComplaint: (complaintData: any, manualText?: string, attachedFiles?: AttachedFileMeta[]) => {
        const count = get().cases.length + 1;
        const newCaseNumber = `CR-2026-99${count + 10}`;
        const newFirNumber = `FIR-0${count + 40}/2026`;

        const newCaseManualText = manualText || complaintData.manual_text || complaintData.raw_text || '';
        const newCaseAttachedFiles = attachedFiles || complaintData.attached_files || [];

        const newCase: PoliceCase = {
          case_number: newCaseNumber,
          fir_number: newFirNumber,
          crime_category: complaintData.crime_category || 'CYBER',
          crime_sub_type: complaintData.crime_sub_type || 'UPI Financial Fraud',
          complaint_text: complaintData.translated_text || newCaseManualText || 'Complaint Statement Ingested.',
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
          created_at: new Date().toISOString(),
          manual_text: newCaseManualText,
          attached_files: newCaseAttachedFiles,
          extracted_result: complaintData,
          completed_step: 1
        };

        const updatedIntakeMap = {
          ...get().intakeDataByCase,
          [newCaseNumber]: {
            manual_text: newCaseManualText,
            attached_files: newCaseAttachedFiles,
            extracted_result: complaintData
          }
        };

        const updatedCompletedStepMap = {
          ...get().completedStepByCase,
          [newCaseNumber]: 1
        };

        const updatedCases = [newCase, ...get().cases];
        set({
          cases: updatedCases,
          activeCase: newCase,
          investigationData: null,
          intakeDataByCase: updatedIntakeMap,
          completedStepByCase: updatedCompletedStepMap,
          loading: false,
          error: null
        });
        return newCase;
      },

      runInvestigationStudio: async (caseNumber, complaintText, category, subType, entities) => {
        set((state) => ({
          loadingByCase: { ...state.loadingByCase, [caseNumber]: true },
          errorByCase: { ...state.errorByCase, [caseNumber]: null },
          ...(state.activeCase?.case_number === caseNumber ? { loading: true, error: null } : {})
        }));

        let resultingData: InvestigationData | null = null;
        let resultingError: string | null = null;

        try {
          const res = await api.post(`/api/cases/${caseNumber}/investigate`, {
            complaint_text: complaintText,
            crime_category: category,
            crime_sub_type: subType,
            entities
          });
          resultingData = res.data;
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

            resultingData = {
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
            };
          } else {
            resultingError = `[Agent Studio Error]: ${errorMsg}`;
          }
        } finally {
          set((state) => {
            const nextInvMap = resultingData
              ? { ...state.investigationsByCase, [caseNumber]: resultingData }
              : state.investigationsByCase;
            const nextErrMap = { ...state.errorByCase, [caseNumber]: resultingError };
            const nextLoadMap = { ...state.loadingByCase, [caseNumber]: false };

            const currStep = state.completedStepByCase[caseNumber] || 0;
            const nextStep = resultingData ? Math.max(currStep, 3) : currStep;
            const nextCompletedStepMap = { ...state.completedStepByCase, [caseNumber]: nextStep };

            const isCurrent = state.activeCase?.case_number === caseNumber;

            return {
              investigationsByCase: nextInvMap,
              errorByCase: nextErrMap,
              loadingByCase: nextLoadMap,
              completedStepByCase: nextCompletedStepMap,
              ...(isCurrent ? {
                investigationData: resultingData ?? state.investigationData,
                error: resultingError,
                loading: false,
                activeCase: state.activeCase ? { ...state.activeCase, completed_step: nextStep } : null
              } : {})
            };
          });
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
        } finally {
          const activeCaseNo = get().activeCase?.case_number;
          if (activeCaseNo) {
            get().updateCompletedStep(activeCaseNo, 4);
          }
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
          const rawMatches: LinkageMatch[] = res.data.matches || [];

          // Backend always returns stats now, but compute defensively if absent
          const backendStats: LinkageStats | null = res.data.stats || null;
          const computedStats: LinkageStats = backendStats ?? {
            total_entities_searched: (entities?.phone_numbers?.length || 0)
              + (entities?.vpas_upis?.length || 0)
              + (entities?.bank_accounts?.length || 0)
              + (searchQuery ? 1 : 0),
            total_matches: rawMatches.length,
            high_confidence: rawMatches.filter(m => m.confidence >= 0.85).length,
            medium_confidence: rawMatches.filter(m => m.confidence >= 0.70 && m.confidence < 0.85).length,
            low_confidence: rawMatches.filter(m => m.confidence < 0.70).length,
            unique_linked_cases: [...new Set(rawMatches.map(m => m.matched_case))].length,
            unique_police_stations: [...new Set(rawMatches.map(m => m.police_station))].length,
          };

          set({
            linkageMatches: rawMatches,
            linkageStats: computedStats,

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
          get().updateCompletedStep(caseNumber, 2);
          set({ linkageLoading: false });
        }
      },

      clearLinkage: () => {
        set({ linkageMatches: [], linkageStats: null, linkageError: null });
      },

      // --- Email Response Manager & Followback System ---
      processedReplies: [],
      processedRepliesByCase: {},
      replyLoading: false,

      checkInboxForReplies: async (caseNumber?: string, smtpCredentials?: any) => {
        const targetCase = caseNumber || get().activeCase?.case_number;
        set({ replyLoading: true });
        try {
          const res = await api.post('/api/email/check-inbox', {
            case_number: targetCase,
            smtp_credentials: smtpCredentials
          });
          if (res.data && Array.isArray(res.data.replies)) {
            const replies = res.data.replies;
            set((state) => {
              const existing = (targetCase && state.processedRepliesByCase[targetCase]) || state.processedReplies || [];
              const existingIds = new Set(existing.map((r: any) => r.id));
              const newItems = replies.filter((r: any) => !existingIds.has(r.id));
              const merged = [...newItems, ...existing];
              return {
                processedReplies: merged,
                processedRepliesByCase: targetCase ? {
                  ...(state.processedRepliesByCase || {}),
                  [targetCase]: merged
                } : (state.processedRepliesByCase || {})
              };
            });
          }
          return res.data;
        } catch (err: any) {
          console.warn('[Email Response Manager Inbox Check Error]:', err);
          return { status: 'error', replies: [] };
        } finally {
          set({ replyLoading: false });
        }
      },

      ingestSimulatedReply: async (payload) => {
        set({ replyLoading: true });
        try {
          const res = await api.post('/api/email/ingest-reply', payload);
          const replyObj = res.data?.reply;
          if (replyObj) {
            const targetCase = payload.case_number;
            const existing = get().processedRepliesByCase[targetCase] || get().processedReplies || [];
            const updated = [replyObj, ...existing];

            set((state) => ({
              processedReplies: updated,
              processedRepliesByCase: {
                ...state.processedRepliesByCase,
                [targetCase]: updated
              }
            }));
          }
          return res.data;
        } catch (err: any) {
          console.error('[Email Response Ingestion Error]:', err);
          return { status: 'error' };
        } finally {
          set({ replyLoading: false });
        }
      },

      sendFollowbackEmail: async (payload) => {
        set({ replyLoading: true });
        try {
          await api.post('/api/email/send-followback', payload);
          const targetCase = payload.case_number;
          const updated = get().processedReplies.map(r =>
            (r.case_number === payload.case_number && r.sender_email === payload.recipient_email)
              ? { ...r, status: 'FOLLOWBACK_SENT', followback_sent_at: new Date().toLocaleTimeString() }
              : r
          );
          set((state) => ({
            processedReplies: updated,
            processedRepliesByCase: {
              ...state.processedRepliesByCase,
              [targetCase]: updated
            }
          }));
        } catch (err: any) {
          console.error('[Send Followback Error]:', err);
          throw err;
        } finally {
          set({ replyLoading: false });
        }
      },

      registerCustomTemplate: async (payload) => {
        try {
          await api.post('/api/workflow/templates/custom', payload);
        } catch (err) {
          console.error('Register custom template error:', err);
        }
      },

      addTimelineEvent: (event: any) => {
        console.log('[addTimelineEvent]', event);
      }
    }),
    {
      name: 'crime-os-case-storage',
      partialize: (state) => ({
        cases: state.cases,
        activeCase: state.activeCase,
        investigationsByCase: state.investigationsByCase,
        intakeDataByCase: state.intakeDataByCase,
        completedStepByCase: state.completedStepByCase,
        legalRequests: state.legalRequests,
        linkageMatches: state.linkageMatches,
        linkageStats: state.linkageStats,
        processedReplies: state.processedReplies,
        processedRepliesByCase: state.processedRepliesByCase,
        dispatchedDirectivesByCase: state.dispatchedDirectivesByCase,
        responseAnalyticsByCase: state.responseAnalyticsByCase
      })
    }
  )
);


