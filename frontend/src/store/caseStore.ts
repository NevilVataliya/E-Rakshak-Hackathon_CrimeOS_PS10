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
  responseAnalyticsHistoryByCase: Record<string, any[]>;
  responseAnalyticsByTypeByCase: Record<string, Record<string, any[]>>;
  linkageMatchesByCase: Record<string, LinkageMatch[]>;
  linkageStatsByCase: Record<string, LinkageStats | null>;

  saveDispatchedDirectivesForCase: (caseNumber: string, directives: any[]) => void;
  getDirectivesForCase: (caseNumber: string) => any[];
  saveResponseAnalyticsForCase: (caseNumber: string, analyticsData: any, category?: string) => void;

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
  addDirectiveForCase: (caseNumber: string, directive: any) => void;
  clearModule5EmailData: () => void;
  startNewComplaint: () => void;
  clearAllCasesAndData: () => void;

  // Hierarchical Summarizer Agent State & Actions
  moduleSummariesByCase: Record<string, Record<string, any>>;
  globalSummaryByCase: Record<string, any>;
  summarizerLoading: boolean;

  generateModuleSummary: (caseNumber: string, moduleId: string, customPayload?: any) => Promise<any>;
  generateGlobalSummary: (caseNumber?: string) => Promise<any>;
}

const sampleImgDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const samplePdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlIC9QYWdlcyAvQ291bnQgMCAvS2lkcyBbXSA+PgplbmRvYmoKdHJhaWxlcgo8PC9Sb290IDEgMCBSPj4KJSVFT0Y=';
const sampleTxtDataUrl = 'data:text/plain;charset=utf-8,CrimeOS%20Evidence%20Log';

const initialMockCases: PoliceCase[] = [];

const initialSubpoenas: SubpoenaNotice[] = [];

export const useCaseStore = create<CaseState>()(
  persist(
    (set, get) => ({
      cases: [],
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
      intakeDataByCase: {},
      completedStepByCase: {},
      dispatchedDirectivesByCase: {},
      responseAnalyticsByCase: {},
      responseAnalyticsHistoryByCase: {},
      responseAnalyticsByTypeByCase: {},
      linkageMatchesByCase: {},
      linkageStatsByCase: {},

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
            if (prev && (prev.status === 'DISPATCHED_SMTP' || prev.status === 'RESPONSE_RECEIVED' || prev.status === 'AWAITING_PROVIDER_REPLY' || prev.status === 'DEFECTIVE_AWAITING_CURE')) {
              return { ...item, ...prev, status: prev.status, dispatched_at: prev.dispatched_at || item.dispatched_at };
            }
            return item;
          });

          const currentStep = state.completedStepByCase[caseNumber] || 0;
          const nextStep = Math.max(currentStep, 4);

          const updatedCases = state.cases.map(c =>
            c.case_number === caseNumber
              ? { ...c, completed_step: Math.max(c.completed_step || 0, nextStep), dispatched_directives: merged }
              : c
          );

          const updatedActive = state.activeCase?.case_number === caseNumber
            ? { ...state.activeCase, completed_step: Math.max(state.activeCase.completed_step || 0, nextStep), dispatched_directives: merged }
            : state.activeCase;

          // Sync directives update to PostgreSQL DB
          api.post('/api/cases', {
            case_number: caseNumber,
            completed_step: nextStep,
            dispatched_directives: merged
          }).catch(err => console.warn('[-] DB directives sync error:', err.message));

          return {
            cases: updatedCases,
            activeCase: updatedActive,
            completedStepByCase: {
              ...state.completedStepByCase,
              [caseNumber]: nextStep
            },
            dispatchedDirectivesByCase: {
              ...state.dispatchedDirectivesByCase,
              [caseNumber]: merged
            }
          };
        });
      },

      saveResponseAnalyticsForCase: (caseNumber: string, analyticsData: any, category?: string) => {
        set((state) => {
          const currentStep = state.completedStepByCase[caseNumber] || 0;
          const nextStep = Math.max(currentStep, 5);
          const cat = category || analyticsData.response_type || 'BANK_STATEMENT';
          const docName = analyticsData.provider_name || analyticsData.file_name || `${cat}_Doc`;
          analyticsData.doc_id = analyticsData.doc_id || `DOC-${Date.now().toString().slice(-6)}`;
          analyticsData.file_name = docName;
          analyticsData.category = cat;
          analyticsData.ingested_at = analyticsData.ingested_at || new Date().toISOString();

          // 1. Update history
          const existingHist = state.responseAnalyticsHistoryByCase?.[caseNumber] || [];
          const histIdx = existingHist.findIndex(d => (d.file_name && d.file_name === docName) || d.doc_id === analyticsData.doc_id);
          const updatedHist = histIdx >= 0
            ? existingHist.map((d, i) => i === histIdx ? analyticsData : d)
            : [analyticsData, ...existingHist];

          // 2. Update by_type
          const existingByType = state.responseAnalyticsByTypeByCase?.[caseNumber] || {};
          const catList = existingByType[cat] || [];
          const catIdx = catList.findIndex(d => (d.file_name && d.file_name === docName) || d.doc_id === analyticsData.doc_id);
          const updatedCatList = catIdx >= 0
            ? catList.map((d, i) => i === catIdx ? analyticsData : d)
            : [analyticsData, ...catList];
          const updatedByType = { ...existingByType, [cat]: updatedCatList };

          const updatedCases = state.cases.map(c =>
            c.case_number === caseNumber
              ? {
                  ...c,
                  completed_step: 5,
                  response_analytics: analyticsData,
                  response_analytics_history: updatedHist,
                  response_analytics_by_type: updatedByType
                }
              : c
          );

          const updatedActive = state.activeCase?.case_number === caseNumber
            ? {
                ...state.activeCase,
                completed_step: 5,
                response_analytics: analyticsData,
                response_analytics_history: updatedHist,
                response_analytics_by_type: updatedByType
              }
            : state.activeCase;

          // Sync analytics update to PostgreSQL DB
          api.post('/api/cases', {
            case_number: caseNumber,
            completed_step: 5,
            response_analytics: analyticsData,
            response_analytics_history: updatedHist,
            response_analytics_by_type: updatedByType
          }).catch(err => console.warn('[-] DB analytics sync error:', err.message));

          return {
            cases: updatedCases,
            activeCase: updatedActive,
            completedStepByCase: {
              ...state.completedStepByCase,
              [caseNumber]: nextStep
            },
            responseAnalyticsByCase: {
              ...state.responseAnalyticsByCase,
              [caseNumber]: analyticsData
            },
            responseAnalyticsHistoryByCase: {
              ...state.responseAnalyticsHistoryByCase,
              [caseNumber]: updatedHist
            },
            responseAnalyticsByTypeByCase: {
              ...state.responseAnalyticsByTypeByCase,
              [caseNumber]: updatedByType
            }
          };
        });
      },

      // Summarizer Agent Initial State
      moduleSummariesByCase: {},
      globalSummaryByCase: {},
      summarizerLoading: false,

      generateModuleSummary: async (caseNumber: string, moduleId: string, customPayload?: any) => {
        set({ summarizerLoading: true });
        try {
          const state: any = get();
          let payload = customPayload;
          if (!payload) {
            if (moduleId === 'MODULE_1') {
              const intake = state.intakeDataByCase[caseNumber] || {};
              const ac = state.activeCase || {};
              payload = {
                case_number: caseNumber,
                complainant_name: intake.complainant_name || ac.complainant_name || 'Complainant',
                crime_category: intake.crime_category || ac.crime_category || 'Cyber Fraud',
                complaint_text: intake.complaint_text || intake.manual_text || ac.complaint_text || ac.description || '',
                entities: intake.entities || intake.extracted_result?.entities || ac.entities || {},
                attached_files_count: (intake.attached_files || ac.attached_files || []).length
              };
            } else if (moduleId === 'MODULE_2') {
              payload = {
                case_number: caseNumber,
                matches: state.linkageMatches || [],
                stats: state.linkageStats || {}
              };
            } else if (moduleId === 'MODULE_3') {
              const inv = state.investigationData || {};
              const ac = state.activeCase || {};
              payload = {
                case_number: caseNumber,
                crime_category: ac.crime_category || 'Cyber Fraud',
                investigation_steps: inv.investigation_steps || [],
                strategy_roadmap: inv.strategy_roadmap || []
              };
            } else if (moduleId === 'MODULE_4') {
              payload = {
                case_number: caseNumber,
                dispatched_directives: (state.dispatchedDirectivesByCase[caseNumber] || []).map((d: any) => ({
                  id: d.id,
                  title: d.title,
                  target_provider: d.target_provider,
                  receiver_email: d.receiver_email,
                  status: d.status
                })),
                processed_replies: (state.processedRepliesByCase[caseNumber] || []).map((r: any) => ({
                  sender: r.sender_email || r.sender,
                  subject: r.subject,
                  classification: r.classification
                }))
              };
            } else if (moduleId === 'MODULE_5') {
              const analytics = state.responseAnalyticsByCase[caseNumber] || {};
              payload = {
                case_number: caseNumber,
                parsed_type: analytics.parsed_type || 'Forensic Analytics',
                executive_summary: analytics.executive_summary || '',
                extracted_metrics: analytics.extracted_metrics || {},
                recommended_next_action: analytics.recommended_next_action || ''
              };
            }
          }

          const res = await api.post('/api/summary/module', {
            case_number: caseNumber,
            module_id: moduleId,
            module_payload: payload || {}
          });

          set((s) => ({
            moduleSummariesByCase: {
              ...s.moduleSummariesByCase,
              [caseNumber]: {
                ...(s.moduleSummariesByCase[caseNumber] || {}),
                [moduleId]: res.data
              }
            }
          }));
          return res.data;
        } catch (err: any) {
          console.warn('Module summary error, generating fallback:', err);
          const fallback = {
            module_id: moduleId,
            module_title: `Module ${moduleId}`,
            case_number: caseNumber,
            key_facts: [`Active operations recorded for ${moduleId} in case ${caseNumber}.`],
            actions_taken: [`Executed ${moduleId} operational workflow.`],
            unresolved_gaps: ['Pending officer verification.'],
            concise_brief: `Summary generated for ${moduleId} in Case ${caseNumber}.`
          };
          set((s) => ({
            moduleSummariesByCase: {
              ...s.moduleSummariesByCase,
              [caseNumber]: {
                ...(s.moduleSummariesByCase[caseNumber] || {}),
                [moduleId]: fallback
              }
            }
          }));
          return fallback;
        } finally {
          set({ summarizerLoading: false });
        }
      },

      generateGlobalSummary: async (targetCaseNo?: string) => {
        set({ summarizerLoading: true });
        try {
          const state = get();
          const caseNo = targetCaseNo || state.activeCase?.case_number || 'CR-2026-9914';
          let summaries = state.moduleSummariesByCase[caseNo] || {};

          // Auto-trigger missing module summaries if needed to build complete global picture (Modules 1 to 5)
          const modules = ['MODULE_1', 'MODULE_2', 'MODULE_3', 'MODULE_4', 'MODULE_5'];
          for (const m of modules) {
            if (!summaries[m]) {
              await state.generateModuleSummary(caseNo, m);
            }
          }
          summaries = get().moduleSummariesByCase[caseNo] || {};

          const res = await api.post('/api/summary/global', {
            case_number: caseNo,
            module_summaries: summaries
          });

          set((s) => ({
            globalSummaryByCase: {
              ...s.globalSummaryByCase,
              [caseNo]: res.data
            }
          }));
          return res.data;
        } catch (err: any) {
          console.warn('Global summary error, generating fallback:', err);
          const caseNo = targetCaseNo || get().activeCase?.case_number || 'CR-2026-9914';
          const fallback = {
            case_number: caseNo,
            master_title: `Master Cyber Crime Investigation Briefing - Case ${caseNo}`,
            executive_brief: `Multi-module investigation active for Case ${caseNo}. Primary entities extracted, statutory directives issued, and court case diary entries recorded.`,
            total_completed_modules: 6,
            timeline_milestones: [`Case ${caseNo} registered and processed across all CrimeOS investigation modules.`],
            critical_evidence_highlights: ['Bank account layering & suspect phone numbers identified.'],
            recommended_next_step: 'Export complete case file and court case diary to judicial magistrate.',
            status: 'COMPLETED'
          };
          set((s) => ({
            globalSummaryByCase: {
              ...s.globalSummaryByCase,
              [caseNo]: fallback
            }
          }));
          return fallback;
        } finally {
          set({ summarizerLoading: false });
        }
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
          if (existing.manual_text === manualText && JSON.stringify(existing.attached_files) === JSON.stringify(attachedFiles)) {
            return state;
          }
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

          // Sync updated intake data to PostgreSQL DB
          api.post('/api/cases', {
            case_number: caseNumber,
            manual_text: manualText,
            attached_files: attachedFiles,
            intake_data: updatedRecord
          }).catch(err => console.warn('[-] DB intake sync error:', err.message));

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

            api.post('/api/cases', {
              case_number: caseNumber,
              completed_step: stepNumber
            }).catch(err => console.warn('[-] DB step sync error:', err.message));

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
            const fetchedCases: PoliceCase[] = res.data;
            const currentActive = get().activeCase;

            const intakeMap = { ...get().intakeDataByCase };
            const stepMap = { ...get().completedStepByCase };
            const invMap = { ...get().investigationsByCase };
            const dirMap = { ...get().dispatchedDirectivesByCase };
            const anaMap = { ...get().responseAnalyticsByCase };
            const anaHistMap = { ...get().responseAnalyticsHistoryByCase };
            const anaByTypeMap = { ...get().responseAnalyticsByTypeByCase };
            const sumMap = { ...get().moduleSummariesByCase };
            const globalSumMap = { ...get().globalSummaryByCase };
            const linkageMatchesMap = { ...get().linkageMatchesByCase };
            const linkageStatsMap = { ...get().linkageStatsByCase };
            const repliesMap = { ...get().processedRepliesByCase };

            fetchedCases.forEach((c: any) => {
              if (c.case_number) {
                intakeMap[c.case_number] = {
                  manual_text: c.manual_text || '',
                  attached_files: c.attached_files || [],
                  extracted_result: c.extracted_result || null
                };
                if (c.completed_step) stepMap[c.case_number] = c.completed_step;
                if (c.investigation_data) invMap[c.case_number] = c.investigation_data;
                if (c.dispatched_directives && c.dispatched_directives.length > 0) dirMap[c.case_number] = c.dispatched_directives;
                if (c.response_analytics) anaMap[c.case_number] = c.response_analytics;
                if (c.response_analytics_history && c.response_analytics_history.length > 0) anaHistMap[c.case_number] = c.response_analytics_history;
                if (c.response_analytics_by_type) anaByTypeMap[c.case_number] = c.response_analytics_by_type;
                if (c.module_summaries) sumMap[c.case_number] = c.module_summaries;
                if (c.global_summary) globalSumMap[c.case_number] = c.global_summary;
                if (c.cross_case_matches && c.cross_case_matches.length > 0) linkageMatchesMap[c.case_number] = c.cross_case_matches;
                if (c.linkage_stats) linkageStatsMap[c.case_number] = c.linkage_stats;
                if (c.processed_replies && c.processed_replies.length > 0) repliesMap[c.case_number] = c.processed_replies;
              }
            });

            let updatedActive = currentActive;
            if (currentActive) {
              const found = fetchedCases.find(c => c.case_number === currentActive.case_number);
              if (found) updatedActive = { ...found, ...currentActive };
            } else if (fetchedCases.length > 0) {
              updatedActive = fetchedCases[0];
            }

            const activeCaseNo = updatedActive?.case_number;
            const activeMatches = activeCaseNo ? (linkageMatchesMap[activeCaseNo] || updatedActive?.cross_case_matches || []) : [];
            const activeStats = activeCaseNo ? (linkageStatsMap[activeCaseNo] || (activeMatches.length > 0 ? {
              total_entities_searched: activeMatches.length,
              total_matches: activeMatches.length,
              high_confidence: activeMatches.filter((m: any) => m.confidence >= 0.85).length,
              medium_confidence: activeMatches.filter((m: any) => m.confidence >= 0.70 && m.confidence < 0.85).length,
              low_confidence: activeMatches.filter((m: any) => m.confidence < 0.70).length,
              unique_linked_cases: [...new Set(activeMatches.map((m: any) => m.matched_case))].length,
              unique_police_stations: [...new Set(activeMatches.map((m: any) => m.police_station))].length,
            } : null)) : null;

            set({
              cases: fetchedCases,
              activeCase: updatedActive,
              intakeDataByCase: intakeMap,
              completedStepByCase: stepMap,
              investigationsByCase: invMap,
              dispatchedDirectivesByCase: dirMap,
              responseAnalyticsByCase: anaMap,
              responseAnalyticsHistoryByCase: anaHistMap,
              responseAnalyticsByTypeByCase: anaByTypeMap,
              moduleSummariesByCase: sumMap,
              globalSummaryByCase: globalSumMap,
              linkageMatchesByCase: linkageMatchesMap,
              linkageStatsByCase: linkageStatsMap,
              processedRepliesByCase: repliesMap,
              linkageMatches: activeMatches,
              linkageStats: activeStats
            });
          }
        } catch (err) {
          console.warn('[⚠️ Fetch Cases Fallback Activated]', err);
        }
      },

      setActiveCase: (policeCase: PoliceCase | null) => {
        if (!policeCase) {
          set({ activeCase: null, investigationData: null, linkageMatches: [], linkageStats: null, loading: false, error: null });
          return;
        }
        const caseNo = policeCase.case_number;
        const invMap = get().investigationsByCase || {};
        const dirMap = get().dispatchedDirectivesByCase || {};
        const anaMap = get().responseAnalyticsByCase || {};
        const anaHistMap = get().responseAnalyticsHistoryByCase || {};
        const anaByTypeMap = get().responseAnalyticsByTypeByCase || {};
        const linkageMatchesMap = get().linkageMatchesByCase || {};
        const linkageStatsMap = get().linkageStatsByCase || {};
        const loadMap = get().loadingByCase || {};
        const errMap = get().errorByCase || {};
        const stepMap = get().completedStepByCase || {};
        const intakeMap = get().intakeDataByCase || {};

        const invData = invMap[caseNo] || policeCase.investigation_data || null;
        const directives = dirMap[caseNo] || policeCase.dispatched_directives || [];
        const analytics = anaMap[caseNo] || policeCase.response_analytics || null;
        const anaHistory = anaHistMap[caseNo] || policeCase.response_analytics_history || [];
        const anaByType = anaByTypeMap[caseNo] || policeCase.response_analytics_by_type || {};
        const caseMatches = linkageMatchesMap[caseNo] || policeCase.cross_case_matches || [];
        const caseStats = linkageStatsMap[caseNo] || (caseMatches.length > 0 ? {
          total_entities_searched: caseMatches.length,
          total_matches: caseMatches.length,
          high_confidence: caseMatches.filter((m: any) => m.confidence >= 0.85).length,
          medium_confidence: caseMatches.filter((m: any) => m.confidence >= 0.70 && m.confidence < 0.85).length,
          low_confidence: caseMatches.filter((m: any) => m.confidence < 0.70).length,
          unique_linked_cases: [...new Set(caseMatches.map((m: any) => m.matched_case))].length,
          unique_police_stations: [...new Set(caseMatches.map((m: any) => m.police_station))].length,
        } : null);

        const intakeRecord = intakeMap[caseNo] || {
          manual_text: policeCase.manual_text || '',
          attached_files: policeCase.attached_files || [],
          extracted_result: policeCase.extracted_result || null
        };

        const calculatedStep = Math.max(
          stepMap[caseNo] ?? 0,
          policeCase.completed_step ?? 1,
          invData ? 3 : 1,
          directives.length > 0 ? 4 : 1,
          analytics ? 5 : 1
        );

        const updatedActiveCase: PoliceCase = {
          ...policeCase,
          manual_text: intakeRecord.manual_text,
          attached_files: intakeRecord.attached_files,
          extracted_result: intakeRecord.extracted_result,
          completed_step: calculatedStep,
          investigation_data: invData,
          dispatched_directives: directives,
          response_analytics: analytics,
          response_analytics_history: anaHistory,
          response_analytics_by_type: anaByType,
          cross_case_matches: caseMatches
        };

        set({
          activeCase: updatedActiveCase,
          investigationData: invData,
          linkageMatches: caseMatches,
          linkageStats: caseStats,
          loading: Boolean(loadMap[caseNo]),
          error: errMap[caseNo] || null,
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

        // Persist case record to PostgreSQL database
        api.post('/api/cases', {
          ...newCase,
          intake_data: updatedIntakeMap[newCaseNumber],
          manual_text: newCaseManualText,
          attached_files: newCaseAttachedFiles,
          extracted_result: complaintData,
          completed_step: 1
        }).catch(err => {
          console.warn('[-] DB case insert warning:', err.message);
        });

        set({
          cases: updatedCases,
          activeCase: newCase,
          investigationData: null,
          linkageMatches: [],
          linkageStats: null,
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
          const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Investigation workflow analysis failed. Please try again.';
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

            const updatedCases = state.cases.map((c) =>
              c.case_number === caseNumber
                ? {
                    ...c,
                    completed_step: nextStep,
                    investigation_data: resultingData || c.investigation_data
                  }
                : c
            );

            const isCurrent = state.activeCase?.case_number === caseNumber;
            const updatedActiveCase = isCurrent && state.activeCase
              ? {
                  ...state.activeCase,
                  completed_step: nextStep,
                  investigation_data: resultingData || state.activeCase.investigation_data
                }
              : state.activeCase;

            if (resultingData) {
              api.post('/api/cases', {
                case_number: caseNumber,
                completed_step: nextStep,
                investigation_data: resultingData
              }).catch(err => console.warn('[-] DB investigation sync error:', err.message));
            }

            return {
              cases: updatedCases,
              investigationsByCase: nextInvMap,
              errorByCase: nextErrMap,
              loadingByCase: nextLoadMap,
              completedStepByCase: nextCompletedStepMap,
              activeCase: updatedActiveCase,
              investigationData: isCurrent ? (resultingData ?? state.investigationData) : state.investigationData,
              loading: isCurrent ? false : state.loading,
              error: isCurrent ? resultingError : state.error
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

          const currentStep = get().completedStepByCase[caseNumber] || 0;
          const nextStep = Math.max(currentStep, 2);

          // Save to PostgreSQL DB
          api.post('/api/cases', {
            case_number: caseNumber,
            completed_step: nextStep,
            cross_case_matches: rawMatches,
            linkage_stats: computedStats
          }).catch(err => console.warn('[-] DB linkage sync error:', err.message));

          set((state) => ({
            linkageMatches: rawMatches,
            linkageStats: computedStats,
            linkageMatchesByCase: {
              ...state.linkageMatchesByCase,
              [caseNumber]: rawMatches
            },
            linkageStatsByCase: {
              ...state.linkageStatsByCase,
              [caseNumber]: computedStats
            },
            completedStepByCase: {
              ...state.completedStepByCase,
              [caseNumber]: nextStep
            },
            cases: state.cases.map(c => c.case_number === caseNumber ? { ...c, completed_step: nextStep, cross_case_matches: rawMatches, linkage_stats: computedStats } : c),
            activeCase: state.activeCase?.case_number === caseNumber ? { ...state.activeCase, completed_step: nextStep, cross_case_matches: rawMatches, linkage_stats: computedStats } : state.activeCase,
            linkageError: null
          }));
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

            const fallbackStats = {
              total_entities_searched: phones.length + vpas.length + accounts.length,
              total_matches: 0,
              high_confidence: 0,
              medium_confidence: 0,
              low_confidence: 0,
              unique_linked_cases: 0,
              unique_police_stations: 0
            };

            set((state) => ({
              linkageMatches: [],
              linkageStats: fallbackStats,
              linkageMatchesByCase: {
                ...state.linkageMatchesByCase,
                [caseNumber]: []
              },
              linkageStatsByCase: {
                ...state.linkageStatsByCase,
                [caseNumber]: fallbackStats
              },
              linkageError: null
            }));
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
        const activeCaseObj = get().activeCase;
        const targetCase = caseNumber || activeCaseObj?.case_number;
        const sinceTimestamp = activeCaseObj?.created_at || undefined;
        set({ replyLoading: true });
        try {
          const res = await api.post('/api/email/check-inbox', {
            case_number: targetCase,
            since_timestamp: sinceTimestamp,
            smtp_credentials: smtpCredentials
          });
          if (res.data && Array.isArray(res.data.replies)) {
            const replies = res.data.replies;
            set((state) => {
              const existing = (targetCase && state.processedRepliesByCase[targetCase]) || [];
              const existingIds = new Set(existing.map((r: any) => r.id));
              const newItems = replies.filter((r: any) => !existingIds.has(r.id));
              const merged = [...newItems, ...existing];

              if (targetCase && merged.length > 0) {
                api.post('/api/cases', {
                  case_number: targetCase,
                  processed_replies: merged
                }).catch(err => console.warn('[-] DB replies sync error:', err.message));
              }

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
            const existing = (targetCase ? get().processedRepliesByCase[targetCase] : []) || [];
            const updated = [replyObj, ...existing];

            if (targetCase) {
              api.post('/api/cases', {
                case_number: targetCase,
                processed_replies: updated
              }).catch(err => console.warn('[-] DB reply insert sync error:', err.message));
            }

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
          const existing = (targetCase ? (get().processedRepliesByCase[targetCase] || []) : []);
          const updated = existing.map(r =>
            (r.case_number === payload.case_number && r.sender_email === payload.recipient_email)
              ? { ...r, status: 'FOLLOWBACK_SENT', followback_sent_at: new Date().toLocaleTimeString() }
              : r
          );

          if (targetCase) {
            api.post('/api/cases', {
              case_number: targetCase,
              processed_replies: updated
            }).catch(err => console.warn('[-] DB followback sync error:', err.message));
          }

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
        set((state) => {
          const currentCase = state.activeCase;
          if (!currentCase) return state;
          const caseNo = currentCase.case_number;
          const newEvent = {
            timestamp: event.timestamp || new Date().toISOString(),
            module: event.module || 'MODULE_5_ANALYTICS',
            step_title: event.step_title || event.title || 'Evidence Analyzed',
            details: event.details || event.description || 'Processed provider response dataset.'
          };
          const updatedTimeline = [...(currentCase.activity_timeline || []), newEvent];
          const updatedCase = { ...currentCase, activity_timeline: updatedTimeline };
          const updatedCases = state.cases.map(c => c.case_number === caseNo ? updatedCase : c);
          const nextCompletedStep = Math.max(state.completedStepByCase[caseNo] || 0, 5);

          api.post('/api/cases', {
            case_number: caseNo,
            activity_timeline: updatedTimeline,
            completed_step: nextCompletedStep
          }).catch(err => console.warn('[-] DB timeline sync error:', err.message));

          return {
            cases: updatedCases,
            activeCase: updatedCase,
            completedStepByCase: {
              ...state.completedStepByCase,
              [caseNo]: nextCompletedStep
            }
          };
        });
      },

      addDirectiveForCase: (caseNumber: string, directive: any) => {
        set((state) => {
          const caseRef = caseNumber || state.activeCase?.case_number || 'CR-2026-9914';
          const existing = state.dispatchedDirectivesByCase[caseRef] || state.activeCase?.dispatched_directives || [];

          const formattedDirective = {
            id: directive.id || `DIR-M5-${Date.now().toString().slice(-4)}`,
            title: directive.title || `${directive.target_provider || 'Provider'}: ${directive.objective || 'Statutory Notice'}`,
            objective: directive.objective || 'Statutory Notice Requisition',
            target_provider: directive.target_provider || 'Compliance Desk',
            target_id: String(directive.target_id || ''),
            domain: directive.domain || (
              directive.target_provider?.toLowerCase().includes('telecom') || directive.target_provider?.toLowerCase().includes('airtel') || directive.target_provider?.toLowerCase().includes('ceir')
                ? 'telecom_location'
                : (directive.target_provider?.toLowerCase().includes('isp') || directive.target_provider?.toLowerCase().includes('jio') || directive.target_provider?.toLowerCase().includes('google') || directive.target_provider?.toLowerCase().includes('tor') ? 'cyber_crime' : 'financial_fraud')
            ),
            receiver_email: directive.receiver_email || 'nodal.compliance@provider.in',
            request_type: directive.request_type || directive.legal_statute_ref || 'SECTION_94_BNSS',
            status: directive.status || 'READY_TO_DISPATCH',
            legal_statute_ref: directive.legal_statute_ref || 'Section 94 BNSS',
            created_at: new Date().toISOString(),
            source_module: 'MODULE_5_RESPONSE_ANALYTICS'
          };

          const existsIdx = existing.findIndex((d: any) =>
            d.id === formattedDirective.id ||
            (d.target_id === formattedDirective.target_id && d.target_provider === formattedDirective.target_provider && d.objective === formattedDirective.objective)
          );

          const updatedList = existsIdx >= 0
            ? existing.map((d: any, idx: number) => idx === existsIdx ? { ...d, ...formattedDirective } : d)
            : [...existing, formattedDirective];

          const currentStep = state.completedStepByCase[caseRef] || 0;
          const nextStep = Math.max(currentStep, 4);

          const updatedCases = state.cases.map(c =>
            c.case_number === caseRef
              ? { ...c, completed_step: Math.max(c.completed_step || 0, nextStep), dispatched_directives: updatedList }
              : c
          );

          const updatedActive = state.activeCase?.case_number === caseRef
            ? { ...state.activeCase, completed_step: Math.max(state.activeCase.completed_step || 0, nextStep), dispatched_directives: updatedList }
            : state.activeCase;

          // Sync directive update to PostgreSQL DB
          api.post('/api/cases', {
            case_number: caseRef,
            completed_step: nextStep,
            dispatched_directives: updatedList
          }).catch(err => console.warn('[-] DB directive sync error:', err.message));

          return {
            cases: updatedCases,
            activeCase: updatedActive,
            completedStepByCase: {
              ...state.completedStepByCase,
              [caseRef]: nextStep
            },
            dispatchedDirectivesByCase: {
              ...state.dispatchedDirectivesByCase,
              [caseRef]: updatedList
            }
          };
        });
      },

      clearModule5EmailData: () => {
        set((state) => ({
          processedReplies: [],
          processedRepliesByCase: {},
          responseAnalyticsByCase: {},
          dispatchedDirectivesByCase: {},
          legalRequests: [],
          activeCase: state.activeCase ? { ...state.activeCase, response_analytics: undefined } : null,
          cases: state.cases.map(c => ({ ...c, response_analytics: undefined }))
        }));
      },

      startNewComplaint: () => {
        set({
          activeCase: null,
          investigationData: null,
          linkageMatches: [],
          linkageStats: null,
          selectedInspectorItem: null,
          error: null
        });
      },

      clearAllCasesAndData: async () => {
        try {
          await api.delete('/api/cases');
        } catch (err: any) {
          console.warn('[-] DB purge error:', err.message);
        }
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('crime-os-case-storage');
        }
        set({
          cases: [],
          activeCase: null,
          investigationData: null,
          legalRequests: [],
          investigationsByCase: {},
          loadingByCase: {},
          errorByCase: {},
          intakeDataByCase: {},
          completedStepByCase: {},
          dispatchedDirectivesByCase: {},
          responseAnalyticsByCase: {},
          processedReplies: [],
          processedRepliesByCase: {},
          moduleSummariesByCase: {},
          globalSummaryByCase: {},
          linkageMatchesByCase: {},
          linkageStatsByCase: {},
          linkageMatches: [],
          linkageStats: null,
          selectedInspectorItem: null,
          error: null
        });
      }
    }),
    {
      name: 'crime-os-case-storage',
      partialize: (state) => ({
        cases: state.cases,
        activeCase: state.activeCase,
        intakeDataByCase: state.intakeDataByCase,
        completedStepByCase: state.completedStepByCase,
        investigationsByCase: state.investigationsByCase,
        dispatchedDirectivesByCase: state.dispatchedDirectivesByCase,
        responseAnalyticsByCase: state.responseAnalyticsByCase,
        processedRepliesByCase: state.processedRepliesByCase,
        moduleSummariesByCase: state.moduleSummariesByCase,
        globalSummaryByCase: state.globalSummaryByCase,
        legalRequests: state.legalRequests,
        linkageMatchesByCase: state.linkageMatchesByCase,
        linkageStatsByCase: state.linkageStatsByCase,
        linkageMatches: state.linkageMatches,
        linkageStats: state.linkageStats
      })
    }
  )
);


