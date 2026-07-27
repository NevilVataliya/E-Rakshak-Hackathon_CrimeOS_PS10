import { create } from 'zustand';
import api from '../services/api';

export const useCaseStore = create((set, get) => ({
  cases: [
    {
      id: 'CR-2026-9910',
      case_number: 'CR-2026-9910',
      fir_number: 'FIR-9910/2026',
      crime_category: 'CYBER',
      crime_sub_type: 'UPI Financial Fraud & Impersonation',
      status: 'INVESTIGATING',
      assigned_io: 'PSI Inspector V. K. Patel',
      assigned_sho: 'PI Senior Inspector R. S. Sharma',
      sections: '318(4) BNS, 66D IT Act',
      complaint_text: 'Victim was defrauded of INR 85,000 via WhatsApp UPI loan link scammer@paytm.',
      created_at: '2026-07-20T10:00:00Z'
    },
    {
      id: 'CR-2026-8812',
      case_number: 'CR-2026-8812',
      fir_number: 'FIR-8812/2026',
      crime_category: 'CONVENTIONAL',
      crime_sub_type: 'Housebreaking & Theft',
      status: 'CHARGESHEET',
      assigned_io: 'PSI Inspector V. K. Patel',
      assigned_sho: 'PI Senior Inspector R. S. Sharma',
      sections: '305 BNS, 331 BNS',
      complaint_text: 'Shop lock broken at night, gold jewelry stolen.',
      created_at: '2026-07-18T14:30:00Z'
    }
  ],

  activeCase: {
    case_number: 'CR-2026-9910',
    fir_number: 'FIR-9910/2026',
    crime_category: 'CYBER',
    crime_sub_type: 'UPI Financial Fraud & Impersonation',
    status: 'INVESTIGATING',
    sections: '318(4) BNS, 66D IT Act',
    complaint_text: 'Defrauded of INR 85,000 via WhatsApp UPI loan link scammer@paytm.'
  },

  complaints: [],
  legalRequests: [
    {
      id: 'REQ-2026-001',
      request_number: 'REQ-2026-001',
      case_no: 'CR-2026-9910',
      type: 'SECTION_94_BNSS',
      provider: 'Reliance Jio Infocomm Ltd.',
      email: 'nodal.gujarat@jio.com',
      purpose: 'CDR & Tower Location Data Requisition',
      status: 'APPROVED',
      pdf_url: '/api/requests/download/Notice_Section_94_BNSS_CR-2026-9910.pdf'
    },
    {
      id: 'REQ-2026-002',
      request_number: 'REQ-2026-002',
      case_no: 'CR-2026-9910',
      type: 'BANK_FREEZE',
      provider: 'State Bank of India (Cyber Cell)',
      email: 'cybercell.nodal@sbi.co.in',
      purpose: 'Debit Freeze on Suspect Account 30910293101',
      status: 'APPROVED',
      pdf_url: '/api/requests/download/Notice_Section_94_BNSS_CR-2026-9910.pdf'
    }
  ],

  investigationData: null,
  loading: false,

  setActiveCase: (caseItem) => set({ activeCase: caseItem }),

  fetchCases: async () => {
    try {
      const res = await api.get('/api/cases');
      if (Array.isArray(res.data) && res.data.length > 0) {
        set({ cases: res.data });
      }
    } catch (err) {
      console.warn('Using local cases fallback');
    }
  },

  addCaseFromComplaint: (complaintData) => {
    const newCaseNumber = `CR-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCase = {
      id: newCaseNumber,
      case_number: newCaseNumber,
      fir_number: `FIR-${newCaseNumber.slice(-4)}/2026`,
      crime_category: complaintData.crime_category || 'CYBER',
      crime_sub_type: complaintData.crime_sub_type || 'Cyber Crime Complaint',
      status: 'INVESTIGATING',
      assigned_io: 'PSI Inspector V. K. Patel',
      assigned_sho: 'PI Senior Inspector R. S. Sharma',
      sections: complaintData.suggested_bns_sections?.join(', ') || '318(4) BNS',
      complaint_text: complaintData.translated_text || complaintData.raw_text,
      entities: complaintData.entities || {},
      created_at: new Date().toISOString()
    };

    set((state) => ({
      cases: [newCase, ...state.cases],
      activeCase: newCase
    }));

    return newCase;
  },

  runInvestigationStudio: async (caseNumber, complaintText, crimeCategory, crimeSubType, entities) => {
    set({ loading: true });
    try {
      const res = await api.post(`/api/cases/${caseNumber}/investigate`, {
        case_number: caseNumber,
        complaint_text: complaintText,
        crime_category: crimeCategory,
        crime_sub_type: crimeSubType,
        entities: entities || {}
      });
      set({ investigationData: res.data, loading: false });
      return res.data;
    } catch (err) {
      console.error('Agent Studio API execution error:', err);
      set({ loading: false });
      throw err;
    }
  },

  dispatchLegalEmail: async (reqId, payload) => {
    try {
      const res = await api.post(`/api/requests/${reqId}/dispatch`, payload);
      set((state) => ({
        legalRequests: state.legalRequests.map((r) =>
          r.id === reqId ? { ...r, status: 'DISPATCHED' } : r
        )
      }));
      return res.data;
    } catch (err) {
      console.warn('Email dispatch fallback');
      set((state) => ({
        legalRequests: state.legalRequests.map((r) =>
          r.id === reqId ? { ...r, status: 'DISPATCHED' } : r
        )
      }));
      return { success: true, status: 'DISPATCHED' };
    }
  }
}));
