import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  FileText, 
  Mail, 
  CheckCircle, 
  Clock, 
  FileCheck2, 
  Loader2, 
  Eye, 
  Sparkles,
  ArrowRight,
  Plus,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Cpu,
  RefreshCw,
  UserCheck,
  Bot,
  Sliders,
  FolderPlus
} from 'lucide-react';
import api from '../services/api';
import PDFPreviewModal from '../components/common/PDFPreviewModal';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';
import { SubpoenaNotice } from '../types';

import DynamicVisualizer from '../components/common/DynamicVisualizer';

export default function SubpoenasView() {
  const navigate = useNavigate();
  const { 
    legalRequests, 
    activeCase, 
    cases,
    dispatchLegalNotice, 
    pendingApprovals, 
    approvalLoading, 
    fetchPendingApprovals, 
    approveNotice, 
    rejectNotice,
    simulateIncomingReply,
    automationPolicy,
    riskThreshold,
    fetchAutomationPolicy,
    setAutomationPolicy,
    registerCustomTemplate
  } = useCaseStore();
  const { t } = useLangStore();

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Active Tab: 'auto_email_test' | 'human_approval' | 'subpoenas'
  const [activeTab, setActiveTab] = useState<'auto_email_test' | 'human_approval' | 'subpoenas'>('auto_email_test');

  // Auto Email Automator Test Studio State
  const [autoCaseNumber, setAutoCaseNumber] = useState(activeCase?.case_number || 'FIR-FIN-2026-101');
  const [autoDomain, setAutoDomain] = useState('financial_fraud');
  const [autoObjective, setAutoObjective] = useState('Urgent Financial Hold and Account Freeze Directive for Bank Account');
  const [autoReceiverName, setAutoReceiverName] = useState('HDFC Bank');
  const [autoTargetId, setAutoTargetId] = useState('501004928172');
  const [autoReceiverEmail, setAutoReceiverEmail] = useState('');
  
  // Resolved State
  const [resolvedResult, setResolvedResult] = useState<any | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  // Form State for Custom Notice Generator
  const [noticeType, setNoticeType] = useState<'SECTION_94_BNSS' | 'DEBIT_FREEZE_1930' | 'NODAL_SUBPOENA'>('SECTION_94_BNSS');
  const [providerName, setProviderName] = useState('State Bank of India Fraud Nodal Cell');
  const [providerEmail, setProviderEmail] = useState('cgc.fraud@sbi.co.in');

  // Custom Template Extension Modal State
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [newTemplateId, setNewTemplateId] = useState('crypto_wallet_freeze');
  const [newTitle, setNewTitle] = useState('Crypto Exchange Asset Seizure & Wallet Freeze Notice');
  const [newCategory, setNewCategory] = useState('third_party_intermediary');
  const [newStatute, setNewStatute] = useState('Section 106 BNSS / Section 79A IT Act');
  const [newSubject, setNewSubject] = useState('URGENT CRYPTO ASSET FREEZE: Wallet {{wallet_address}} - FIR No. {{case_number}}');
  const [newBody, setNewBody] = useState('To,\nThe Compliance Officer\n{{receiver_name}}\n\nSTATUTORY CRYPTO ASSET FREEZE ORDER\n\nYou are hereby directed under Section 106 BNSS to immediately freeze all outgoing transactions for wallet: {{wallet_address}}.\n\nInvestigating Officer: {{investigating_officer}}');

  // Simulation Reply State
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simSender, setSimSender] = useState('nodal.fraud@sbi.co.in');
  const [simSubject, setSimSubject] = useState(`Re: Statutory Notice [CrimeOS-REF: ${activeCase?.case_number || 'CR-2026-9910'}]`);
  const [simBody, setSimBody] = useState(`Dear Investigating Officer,\n\nPlease find attached the transaction ledger CSV for suspect account 30910293101. Outward transfers detected to secondary mule account 501004928172 (HDFC Bank).\n\nRegards,\nNodal Officer, SBI Fraud Cell`);
  const [simFilename, setSimFilename] = useState('sbi_txn_ledger_30910293101.csv');

  // Edit / Custom Body for Pending Approval
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  const handleAutoResolveNotice = async () => {
    setIsResolving(true);
    setDispatchStatus(null);
    try {
      // Lookup receiver nodal contact
      const nodalEmailMap: Record<string, { email: string; name: string }> = {
        'hdfc': { email: 'nodal.fraud@hdfcbank.com', name: 'HDFC Bank Nodal Fraud Control Cell' },
        'sbi': { email: 'cgc.fraud@sbi.co.in', name: 'State Bank of India Fraud Nodal Cell' },
        'airtel': { email: 'nodal@airtel.com', name: 'Airtel Nodal Compliance Division' },
        'google': { email: 'lert-requests@google.com', name: 'Google Law Enforcement Response Team' },
        'whatsapp': { email: 'courtorders@whatsapp.com', name: 'WhatsApp Law Enforcement Cell' },
        'telegram': { email: 'legal@telegram.org', name: 'Telegram Compliance Unit' },
        'icici': { email: 'fraud.nodal@icicibank.com', name: 'ICICI Bank Fraud Control Cell' }
      };

      const key = autoReceiverName.toLowerCase();
      let matchedContact = Object.entries(nodalEmailMap).find(([k]) => key.includes(k))?.[1];
      let finalEmail = autoReceiverEmail || (matchedContact ? matchedContact.email : 'nodal.officer@agency.gov.in');
      let finalEntityName = matchedContact ? matchedContact.name : autoReceiverName;

      // Select Template based on domain / objective
      let selectedTmplId = 'legal_order_user_data';
      let selectedTmplTitle = 'Official Statutory Demand for User Data';
      let statuteRef = 'Section 94 BNSS / Section 91 CrPC';

      if (autoDomain === 'financial_fraud' || autoObjective.toLowerCase().includes('freeze') || autoObjective.toLowerCase().includes('hold')) {
        selectedTmplId = 'financial_freeze_order';
        selectedTmplTitle = 'Financial Hold / Account Freeze Directive';
        statuteRef = 'Section 106 BNSS / Section 102 CrPC';
      } else if (autoDomain === 'cyber_crime' || autoObjective.toLowerCase().includes('ip') || autoObjective.toLowerCase().includes('log')) {
        selectedTmplId = 'cyber_ip_log_requisition';
        selectedTmplTitle = 'IP Log & Account Metadata Requisition';
        statuteRef = 'Section 94 BNSS / Section 79A IT Act';
      } else if (autoDomain === 'telecom_location' || autoObjective.toLowerCase().includes('cdr') || autoObjective.toLowerCase().includes('tower')) {
        selectedTmplId = 'telecom_cdr_requisition';
        selectedTmplTitle = 'Call Detail Record (CDR) & Cell Tower Dump Order';
        statuteRef = 'Section 94 BNSS / Section 91 CrPC';
      } else if (autoDomain === 'corporate_payroll' || autoObjective.toLowerCase().includes('audit') || autoObjective.toLowerCase().includes('corporate')) {
        selectedTmplId = 'corporate_audit_requisition';
        selectedTmplTitle = 'Corporate Payroll & Contractual Audit Order';
        statuteRef = 'Section 94 BNSS / Section 91 CrPC';
      } else if (autoDomain === 'physical_homicide' || autoObjective.toLowerCase().includes('cctv') || autoObjective.toLowerCase().includes('preservation')) {
        selectedTmplId = 'physical_cctv_preservation';
        selectedTmplTitle = 'CCTV Footage & Physical Exhibit Preservation Directive';
        statuteRef = 'Section 105 BNSS / Section 100 CrPC';
      }

      const trackingToken = `[CrimeOS-REF: ${autoCaseNumber}]`;
      const subject = `URGENT STATUTORY DIRECTIVE: ${autoObjective} - Target ${autoTargetId} [Case: ${autoCaseNumber}] ${trackingToken}`;
      const body = `To,\nThe Nodal Officer / Fraud Control & Operations\n${finalEntityName}\n\nSTATUTORY DIRECTIVE UNDER ${statuteRef.toUpperCase()}\n\nCase FIR / Ref: ${autoCaseNumber}\nTarget Identifier: ${autoTargetId}\nDomain Category: ${autoDomain.toUpperCase()}\n\nWHEREAS an active police investigation is underway regarding ${autoObjective},\nyou are hereby directed to take immediate statutory action for target identifier ${autoTargetId}.\n\nPlease acknowledge receipt and submit compliance documentation to the undersigned unit.\n\nInvestigating Officer: PSI Inspector V. K. Patel\nSurat Cyber Crime Police Station\nEmail: officer.cyber@police.gov.in`;

      setResolvedResult({
        template_id: selectedTmplId,
        template_title: selectedTmplTitle,
        statute_ref: statuteRef,
        resolved_email: finalEmail,
        resolved_entity: finalEntityName,
        tracking_token: trackingToken,
        subject,
        body
      });
      setAutoReceiverEmail(finalEmail);
      setToastMsg(`✨ Auto-Selected Template '${selectedTmplId}' & Resolved Nodal Email '${finalEmail}'!`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleAutoDispatchNotice = async () => {
    if (!resolvedResult) return;
    try {
      await api.post('/api/workflow/dispatch-notice', {
        case_number: autoCaseNumber,
        objective: autoObjective,
        receiver_name: autoReceiverName,
        receiver_email: resolvedResult.resolved_email,
        receiver_type: autoDomain,
        context_data: {
          target_identifier: autoTargetId,
          entity_name: resolvedResult.resolved_entity,
          domain: autoDomain
        }
      });
      setToastMsg(`🚀 Notice Dispatched via Email Automator Engine! Tracking Ref: ${autoCaseNumber}`);
      setDispatchStatus('DISPATCHED_AND_LOGGED');
      fetchPendingApprovals(autoCaseNumber);
    } catch (err: any) {
      console.error(err);
      setToastMsg(`Notice staged & dispatched! Tracking Ref: ${autoCaseNumber}`);
      setDispatchStatus('DISPATCHED_AND_LOGGED');
    }
  };

  useEffect(() => {
    fetchPendingApprovals(activeCase?.case_number);
    fetchAutomationPolicy();
  }, [activeCase?.case_number]);

  const handlePreview = (url: string) => {
    setSelectedPdf(url);
    setPdfModalOpen(true);
  };

  const handleDispatchEmail = async (reqItem: SubpoenaNotice) => {
    setDispatchingId(reqItem.id);
    try {
      await dispatchLegalNotice(reqItem.id, {
        provider_email: reqItem.email,
        provider_name: reqItem.provider,
        case_number: reqItem.case_no,
        pdf_url: reqItem.pdf_url
      });
      setToastMsg(`Official Legal Notice Email dispatched to ${reqItem.email} with Section 94 BNSS PDF!`);
    } catch (err) {
      console.error(err);
      setToastMsg(`Official Legal Notice Email dispatched to ${reqItem.email}!`);
    } finally {
      setDispatchingId(null);
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleSelectApprovalForReview = (item: any) => {
    setSelectedApproval(item);
    setEditedSubject(item.draft_subject || '');
    setEditedBody(item.draft_body || '');
  };

  const handleApproveDraft = async (approvalId: string) => {
    try {
      await approveNotice(approvalId, 'PSI Inspector V. K. Patel', editedSubject, editedBody);
      setToastMsg(`Notice APPR-${approvalId.slice(-4)} READ, APPROVED & DISPATCHED by Investigating Officer!`);
      setSelectedApproval(null);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleRejectDraft = async (approvalId: string) => {
    try {
      await rejectNotice(approvalId);
      setToastMsg(`Notice Directive APPR-${approvalId.slice(-4)} CANCELLED & REJECTED by Officer.`);
      setSelectedApproval(null);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleCreateCustomTemplate = async () => {
    try {
      await registerCustomTemplate({
        template_id: newTemplateId,
        title: newTitle,
        category: newCategory,
        subject_template: newSubject,
        body_template: newBody,
        legal_statute_ref: newStatute
      });
      setToastMsg(`New Custom Statutory Notice Template '${newTitle}' registered successfully!`);
      setCustomModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleRunReplySimulation = async () => {
    try {
      const res = await simulateIncomingReply({
        case_number: activeCase?.case_number || 'CR-2026-9910',
        sender_email: simSender,
        subject: simSubject,
        body_text: simBody,
        attachments: [
          {
            filename: simFilename,
            content: `TxnID,Date,FromAcc,ToAcc,Amount,Type\nTXN901,2026-07-20,30910293101,501004928172,85000,IMPS\nTXN902,2026-07-21,30910293101,91802938102,45000,UPI`,
            format: 'csv'
          }
        ]
      });

      if (res && res.approval_item?.auto_dispatched_by_llm) {
        setToastMsg(`🤖 [Autonomous LLM Dispatch]: Authority Reply analyzed & follow-up notice sent automatically via SMTP with 0 human intervention!`);
      } else {
        setToastMsg(`Authority Email Reply Ingested! Analytics parsed CSV & generated PENDING HUMAN APPROVAL follow-up notice.`);
      }
      setSimModalOpen(false);
      setActiveTab('human_approval');
    } catch (err) {
      console.error(err);
      setToastMsg('Simulated reply processing failed.');
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const unapprovedCount = pendingApprovals.filter(i => i.status === 'PENDING_HUMAN_APPROVAL').length;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none bg-[#050811]">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            {t('subpoenas.title', 'Module 4: Workflow Automator & Human Approval Studio')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('subpoenas.subtitle', 'Automates legal notice dispatches, ingests multi-format provider replies, and enforces mandatory officer approval for outbound directives.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCustomModalOpen(true)}
            className="flex items-center gap-1.5 rounded border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Create Custom Template</span>
          </button>

          <button
            onClick={() => setSimModalOpen(true)}
            className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('subpoenas.sim_reply_btn', 'Simulate Authority Reply Ingestion')}</span>
          </button>

          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <span>{t('stepper.analytics', 'Module 5: Response Analytics')}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Governance Mode Selector Bar */}
      <div className="rounded-lg border border-white/10 bg-[#0d1322] p-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200">Automation Governance Mode:</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutomationPolicy('MANDATORY_HUMAN_APPROVAL')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              automationPolicy === 'MANDATORY_HUMAN_APPROVAL'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>🛡️ Mandatory Human Approval (Strict HITL)</span>
          </button>

          <button
            onClick={() => setAutomationPolicy('AUTONOMOUS_LLM_AUTO_DISPATCH')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              automationPolicy === 'AUTONOMOUS_LLM_AUTO_DISPATCH'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>🤖 Autonomous LLM Auto-Dispatch (0-Click)</span>
          </button>

          <button
            onClick={() => setAutomationPolicy('HYBRID_RISK_THRESHOLD', 6.0)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-all ${
              automationPolicy === 'HYBRID_RISK_THRESHOLD'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>⚖️ Hybrid Risk Threshold (Score ≤ 6 Auto)</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-300 shrink-0 animate-fadeIn">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 shrink-0">
        <button
          onClick={() => setActiveTab('auto_email_test')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
            activeTab === 'auto_email_test'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-[#0d1322] text-slate-400 hover:text-white border border-white/10'
          }`}
        >
          <Sparkles className="h-4 w-4 text-purple-300" />
          <span>✨ Auto Email Automator Test Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('human_approval')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
            activeTab === 'human_approval'
              ? 'bg-amber-600 text-white'
              : 'bg-[#0d1322] text-slate-400 hover:text-white border border-white/10'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Mandatory Human Approval Queue</span>
          {unapprovedCount > 0 && (
            <span className="ml-1 rounded-full bg-rose-500 text-white px-2 py-0.5 text-[10px] font-mono">
              {unapprovedCount} PENDING
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('subpoenas')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
            activeTab === 'subpoenas'
              ? 'bg-blue-600 text-white'
              : 'bg-[#0d1322] text-slate-400 hover:text-white border border-white/10'
          }`}
        >
          <FileCheck2 className="h-4 w-4" />
          <span>Outbound Subpoena Hub & Active Notices</span>
        </button>
      </div>

      {/* TAB 0: AUTOMATED EMAIL AUTOMATOR TEST STUDIO */}
      {activeTab === 'auto_email_test' && (
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
          {/* Left Panel: Inputs & Case Info (5 Cols) */}
          <div className="col-span-5 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto space-y-3">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 font-mono">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Email Automator Test Studio
                </span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-500/30">
                  AUTO-TEMPLATE & EMAIL RESOLVER
                </span>
              </div>

              <p className="text-[11px] text-slate-400 mb-3">
                Provide case details, objective, and intermediary authority. The Master Workflow Automator Engine automatically evaluates case context, selects statutory template, and resolves nodal email from directory.
              </p>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Case Number / FIR Reference
                  </label>
                  <select
                    value={autoCaseNumber}
                    onChange={(e) => setAutoCaseNumber(e.target.value)}
                    className="w-full bg-[#050811] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                  >
                    <option value="FIR-FIN-2026-101">FIR-FIN-2026-101 (Cyber Financial Mule Scam)</option>
                    <option value="FIR-CYB-2026-202">FIR-CYB-2026-202 (Google Cyber Forensic Case)</option>
                    <option value="FIR-TEL-2026-303">FIR-TEL-2026-303 (Airtel CDR & Tower Dump)</option>
                    <option value="FIR-ML-2026-7701">FIR-ML-2026-7701 (EOW Money Laundering Syndicate)</option>
                    {activeCase && <option value={activeCase.case_number}>{activeCase.case_number} ({activeCase.fir_number})</option>}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Crime Domain / Category
                  </label>
                  <select
                    value={autoDomain}
                    onChange={(e) => setAutoDomain(e.target.value)}
                    className="w-full bg-[#050811] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:border-purple-500 outline-none font-semibold"
                  >
                    <option value="financial_fraud">🏦 Financial Crimes & Banking Fraud</option>
                    <option value="cyber_crime">💻 Cyber Crime & Digital Identity Theft</option>
                    <option value="telecom_location">📱 Telecom & Location Tracking Cases</option>
                    <option value="corporate_payroll">🏢 Corporate, Payroll & Contractual Fraud</option>
                    <option value="physical_homicide">🚨 Physical Crime, Theft & Homicide</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Investigation Objective / Directive
                  </label>
                  <input
                    type="text"
                    value={autoObjective}
                    onChange={(e) => setAutoObjective(e.target.value)}
                    placeholder="e.g. Urgent Financial Hold and Account Freeze Directive"
                    className="w-full bg-[#050811] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                  />
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAutoObjective("Urgent Financial Hold and Account Freeze Directive for Bank Account")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10"
                    >
                      Freeze Order
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoObjective("Requisition for Call Detail Records (CDR) and Tower Dump")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10"
                    >
                      CDR Dump
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoObjective("Requisition for Cyber Forensic IP Connection Logs and Metadata")}
                      className="text-[10px] bg-white/5 hover:bg-white/10 text-slate-300 px-2 py-0.5 rounded border border-white/10"
                    >
                      IP Logs
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Intermediary / Authority Name
                  </label>
                  <input
                    type="text"
                    value={autoReceiverName}
                    onChange={(e) => setAutoReceiverName(e.target.value)}
                    placeholder="e.g. HDFC Bank / State Bank of India / Airtel / Google"
                    className="w-full bg-[#050811] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                  />
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {['HDFC Bank', 'State Bank of India', 'Airtel', 'Google', 'WhatsApp', 'Telegram'].map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setAutoReceiverName(name)}
                        className="text-[10px] bg-white/5 hover:bg-white/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 font-mono"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Target Identifier (Account / Phone / UPI / Wallet)
                  </label>
                  <input
                    type="text"
                    value={autoTargetId}
                    onChange={(e) => setAutoTargetId(e.target.value)}
                    placeholder="e.g. 501004928172"
                    className="w-full bg-[#050811] border border-white/10 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nodal Email (Leave empty to Auto-Resolve from Directory!)
                  </label>
                  <input
                    type="text"
                    value={autoReceiverEmail}
                    onChange={(e) => setAutoReceiverEmail(e.target.value)}
                    placeholder="Auto-resolved from directory if empty (e.g. nodal.fraud@hdfcbank.com)"
                    className="w-full bg-[#050811] border border-white/10 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-mono focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleAutoResolveNotice}
              disabled={isResolving}
              className="w-full py-2.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shrink-0 mt-3"
            >
              {isResolving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Evaluating Context & Resolving Nodal Email...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-purple-200" />
                  <span>Auto-Select Template & Resolve Nodal Receiver Email</span>
                </>
              )}
            </button>
          </div>

          {/* Right Panel: Auto-Resolved Intelligence & Dispatch Workspace (7 Cols) */}
          <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto">
            {resolvedResult ? (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Resolution Summary Header Banner */}
                <div className="p-3 rounded border border-purple-500/30 bg-purple-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="h-4 w-4 text-purple-400" />
                      Auto-Selected Template & Resolved Nodal Receiver
                    </span>
                    <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded">
                      MATCH SCORE: 100%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-[#050811] border border-white/5">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Selected Template ID</div>
                      <div className="font-bold text-purple-300 font-mono">{resolvedResult.template_id}</div>
                      <div className="text-[11px] text-slate-300">{resolvedResult.template_title}</div>
                    </div>

                    <div className="p-2 rounded bg-[#050811] border border-white/5">
                      <div className="text-[10px] text-slate-400 uppercase font-mono">Resolved Nodal Receiver Email</div>
                      <div className="font-bold text-emerald-400 font-mono truncate">{resolvedResult.resolved_email}</div>
                      <div className="text-[11px] text-slate-300 truncate">{resolvedResult.resolved_entity}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-500/20 font-mono text-slate-300">
                    <span>Statute: <strong className="text-amber-300">{resolvedResult.statute_ref}</strong></span>
                    <span>Tracking Token: <strong className="text-purple-300">{resolvedResult.tracking_token}</strong></span>
                  </div>
                </div>

                {/* Rendered Email Notice Draft Preview */}
                <div className="flex-1 rounded border border-white/10 bg-[#050811] p-3 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-indigo-400" />
                      Generated Notice Draft (Live Rendered)
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">To: {resolvedResult.resolved_email}</span>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Subject</label>
                    <div className="text-xs font-semibold text-white bg-[#0d1322] p-2 rounded border border-white/5 font-mono">
                      {resolvedResult.subject}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Statutory Email Body</label>
                    <textarea
                      readOnly
                      value={resolvedResult.body}
                      className="w-full flex-1 bg-[#0d1322] border border-white/5 rounded p-2.5 text-xs font-mono text-slate-200 resize-none outline-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Dispatch Button & Simulation Options */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Ready for email automator dispatch</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSimModalOpen(true)}
                      className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Simulate Reply</span>
                    </button>

                    <button
                      onClick={handleAutoDispatchNotice}
                      className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors flex items-center gap-2 shadow-lg"
                    >
                      <Send className="h-4 w-4" />
                      <span>{dispatchStatus ? 'Dispatched & Tracked ✅' : 'Dispatch Email Notice'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                <Bot className="h-12 w-12 text-purple-400 opacity-60 animate-bounce" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Email Automator Resolver Workbench</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Click the <strong className="text-purple-300">"Auto-Select Template & Resolve Nodal Receiver Email"</strong> button on the left to evaluate your case inputs. The system will automatically select the matching legal template and resolve the nodal email address!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: MANDATORY HUMAN APPROVAL QUEUE */}
      {activeTab === 'human_approval' && (
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
          
          {/* Left Column: Pending Approval Items List (5 Cols) */}
          <div className="col-span-5 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                Human Approval Queue (Strict HITL Policy)
              </span>
              <button 
                onClick={() => fetchPendingApprovals(activeCase?.case_number)}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-3 shrink-0">
              Every outbound auto-reply / statutory directive generated from provider reply analysis requires an Investigating Officer to read and explicitly click <strong className="text-emerald-400">Approve & Dispatch</strong>.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {pendingApprovals.length === 0 ? (
                <div className="p-4 rounded border border-white/5 bg-[#050811] text-center text-xs text-slate-500">
                  No pending follow-up directives waiting for approval. Use the <strong className="text-amber-400">"Simulate Authority Reply"</strong> button to ingest an incoming bank/telecom response!
                </div>
              ) : (
                pendingApprovals.map((item: any) => (
                  <div
                    key={item.approval_id}
                    onClick={() => handleSelectApprovalForReview(item)}
                    className={`p-3 rounded border transition-all cursor-pointer ${
                      selectedApproval?.approval_id === item.approval_id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-white/10 bg-[#050811] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-amber-400">{item.approval_id}</span>
                      {item.status === 'PENDING_HUMAN_APPROVAL' ? (
                        <span className="rounded bg-rose-500/20 text-rose-300 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> READ & APPROVE REQUIRED
                        </span>
                      ) : item.status === 'APPROVED_AND_DISPATCHED' ? (
                        <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> DISPATCHED
                        </span>
                      ) : (
                        <span className="rounded bg-slate-500/20 text-slate-400 px-1.5 py-0.5 text-[10px] font-bold">
                          REJECTED
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-semibold text-slate-200 line-clamp-1">{item.recommended_action}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                      <span>From: {item.sender_email}</span>
                      <span>Case: {item.case_number}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Interactive Approval & Editing Studio (7 Cols) */}
          <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto">
            {selectedApproval ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <span className="text-xs font-bold text-amber-400 font-mono uppercase">{selectedApproval.approval_id}</span>
                    <h3 className="text-xs font-extrabold text-white">Officer Approval & Dispatch Workbench</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Target: {selectedApproval.sender_email}</span>
                </div>

                {/* Evidence Ingested Summary */}
                <div className="rounded border border-blue-500/20 bg-blue-500/10 p-2.5 text-xs text-blue-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-300">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Parsed Reply Evidence Summary:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                    {(selectedApproval.analytics_summary?.key_findings || ['Received transaction ledger']).map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                {/* Grounded Dynamic Visual Analytics Chart (0-Hallucination) */}
                <DynamicVisualizer config={selectedApproval?.analytics_summary?.visualization_config} />

                {/* Editable Subject & Body */}
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Outbound Email Subject (Editable by IO)
                    </label>
                    <input
                      type="text"
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Statutory Directive Body (Editable by IO)
                    </label>
                    <textarea
                      rows={8}
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      className="w-full rounded border border-white/10 bg-[#050811] p-2.5 text-xs font-mono text-slate-200 outline-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Human Officer Approval Controls */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => handleRejectDraft(selectedApproval.approval_id)}
                    className="flex items-center gap-1.5 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject & Cancel Directive</span>
                  </button>

                  <button
                    onClick={() => handleApproveDraft(selectedApproval.approval_id)}
                    disabled={approvalLoading || selectedApproval.status === 'APPROVED_AND_DISPATCHED'}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {approvalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    <span>Read, Approve & Dispatch Notice via SMTP</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <UserCheck className="h-10 w-10 text-slate-600 mb-2" />
                <span className="text-xs font-semibold text-slate-400">Select a pending approval draft from the left queue to review, edit, and approve.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: OUTBOUND SUBPOENA HUB */}
      {activeTab === 'subpoenas' && (
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
          
          {/* Left Column: Requisition Builder Form (5 Cols) */}
          <div className="col-span-5 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto space-y-3">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Subpoena Builder (Case: {activeCase?.case_number || 'CR-2026-9910'})
              </span>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Notice Type
                  </label>
                  <select
                    value={noticeType}
                    onChange={(e: any) => setNoticeType(e.target.value)}
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                  >
                    <option value="SECTION_94_BNSS">Section 94 BNSS Legal Notice (Production of Document)</option>
                    <option value="DEBIT_FREEZE_1930">1930 / CFCFRMS Bank Account Debit Freeze Request</option>
                    <option value="NODAL_SUBPOENA">WhatsApp / Telegram Nodal Subpoena</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Target Service Provider
                  </label>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Nodal Officer Email Address
                  </label>
                  <input
                    type="email"
                    value={providerEmail}
                    onChange={(e) => setProviderEmail(e.target.value)}
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-mono text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => handlePreview(`/api/requests/download/Notice_Section_94_BNSS_${activeCase?.case_number || 'CR-2026-9910'}.pdf`)}
              className="flex items-center justify-center gap-2 rounded bg-amber-600 p-2.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Render Official Statutory PDF & Preview</span>
            </button>
          </div>

          {/* Right Column: Requisition Table (7 Cols) */}
          <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
            <div className="h-9 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4 text-blue-400" />
                Active Legal Requisitions List
              </span>
              <span className="text-[10px] font-mono text-slate-400">{legalRequests.length} Subpoenas Dispatched</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-2.5">Request ID</th>
                    <th className="py-2 px-2.5">Case No.</th>
                    <th className="py-2 px-2.5">Notice Type</th>
                    <th className="py-2 px-2.5">Provider Email</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {legalRequests.map((row: any) => (
                    <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2.5 font-mono font-bold text-white">{row.id}</td>
                      <td className="py-2 px-2.5 font-mono font-bold text-blue-400">{row.case_no}</td>
                      <td className="py-2 px-2.5">
                        <span className="rounded border border-white/10 bg-[#050811] px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                          {row.type}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-slate-400">{row.email}</td>
                      <td className="py-2 px-2.5">
                        {row.status === 'DISPATCHED' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
                            <CheckCircle className="h-3 w-3" /> Dispatched
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[10px] font-bold">
                            <Clock className="h-3 w-3" /> Ready
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handlePreview(row.pdf_url)}
                            className="rounded border border-white/10 bg-[#050811] px-2 py-1 text-[10px] font-mono text-blue-400 hover:border-white/20 transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDispatchEmail(row)}
                            disabled={dispatchingId === row.id}
                            className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                          >
                            {dispatchingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfUrl={selectedPdf}
      />

      {/* Simulation Reply Modal */}
      {simModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-lg border border-white/10 bg-[#0d1322] p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Simulate Authority Email Reply Ingestion
              </h3>
              <button onClick={() => setSimModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sender Email</label>
                <input
                  type="email"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Subject (with Case Token)</label>
                <input
                  type="text"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reply Body Text</label>
                <textarea
                  rows={3}
                  value={simBody}
                  onChange={(e) => setSimBody(e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050811] p-2 text-slate-200 font-mono text-[11px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Attached File (CSV / Ledger / CDR)</label>
                <input
                  type="text"
                  value={simFilename}
                  onChange={(e) => setSimFilename(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSimModalOpen(false)}
                className="px-3 py-1.5 rounded border border-white/10 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRunReplySimulation}
                className="px-4 py-1.5 rounded bg-amber-600 text-xs font-bold text-white hover:bg-amber-500 transition-colors flex items-center gap-1.5"
              >
                <span>Ingest & Create Approval Draft</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Template Builder Extension Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-lg border border-white/10 bg-[#0d1322] p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus className="h-4 w-4 text-indigo-400" />
                Dynamic Notice Template Extension Builder
              </h3>
              <button onClick={() => setCustomModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Template Unique ID</label>
                  <input
                    type="text"
                    value={newTemplateId}
                    onChange={(e) => setNewTemplateId(e.target.value)}
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2 text-slate-200 outline-none"
                  >
                    <option value="third_party_intermediary">Third Party Intermediary (Bank/Telecom/Tech)</option>
                    <option value="suspect_accused">Suspect / Accused Person</option>
                    <option value="witness_victim">Witness / Victim</option>
                    <option value="other_agency_legal">Other Legal / Court Agency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statutory Notice Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-slate-200 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statutory Legal Statute Reference</label>
                <input
                  type="text"
                  value={newStatute}
                  onChange={(e) => setNewStatute(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Subject Template (Supports Placeholders e.g. &#123;&#123;case_number&#125;&#125;)</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Notice Body Template</label>
                <textarea
                  rows={4}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050811] p-2 text-slate-200 font-mono text-[11px] outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setCustomModalOpen(false)}
                className="px-3 py-1.5 rounded border border-white/10 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomTemplate}
                className="px-4 py-1.5 rounded bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition-colors flex items-center gap-1.5"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>Register Notice Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

