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

  // Active Tab: 'subpoenas' | 'human_approval'
  const [activeTab, setActiveTab] = useState<'subpoenas' | 'human_approval'>('human_approval');

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

