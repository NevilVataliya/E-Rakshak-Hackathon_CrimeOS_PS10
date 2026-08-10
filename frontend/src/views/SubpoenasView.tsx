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
  FolderPlus,
  ListChecks,
  AlertCircle,
  Key,
  Settings
} from 'lucide-react';
import api from '../services/api';
import PDFPreviewModal from '../components/common/PDFPreviewModal';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';
import { SubpoenaNotice } from '../types';

import DynamicVisualizer from '../components/common/DynamicVisualizer';

export interface DirectiveItem {
  id: string;
  title: string;
  objective: string;
  target_provider: string;
  target_id: string;
  domain: string;
  receiver_email: string;
  request_type: string;
  status: 'PENDING_INPUT' | 'READY_TO_DISPATCH' | 'DISPATCHED_SMTP' | 'AWAITING_PROVIDER_REPLY' | 'RESPONSE_RECEIVED' | 'DEFECTIVE_AWAITING_CURE';
  dispatched_at?: string;
  reply_received_at?: string;
  resolved_result?: any;
}

export default function SubpoenasView() {
  const navigate = useNavigate();
  const {
    legalRequests: storeLegalRequests,
    activeCase,
    cases,
    investigationData,
    dispatchLegalNotice,
    dispatchedDirectivesByCase,
    saveDispatchedDirectivesForCase,
    saveResponseAnalyticsForCase,
    updateCompletedStep,
    processedReplies,
    processedRepliesByCase,
    replyLoading,
    checkInboxForReplies,
    ingestSimulatedReply,
    sendFollowbackEmail,
    registerCustomTemplate
  } = useCaseStore();
  const { t } = useLangStore();

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Active Tab: 'auto_email_test' | 'email_response'
  const [activeTab, setActiveTab] = useState<'auto_email_test' | 'email_response'>('auto_email_test');

  // Real SMTP Credentials Settings State
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [smtpHost, setSmtpHost] = useState(() => localStorage.getItem('crime_os_smtp_host') || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(() => localStorage.getItem('crime_os_smtp_port') || '587');
  const [smtpUser, setSmtpUser] = useState(() => localStorage.getItem('crime_os_smtp_user') || '');
  const [smtpPass, setSmtpPass] = useState(() => localStorage.getItem('crime_os_smtp_pass') || '');

  const saveSmtpCredentials = () => {
    localStorage.setItem('crime_os_smtp_host', smtpHost);
    localStorage.setItem('crime_os_smtp_port', smtpPort);
    localStorage.setItem('crime_os_smtp_user', smtpUser);
    localStorage.setItem('crime_os_smtp_pass', smtpPass);
    setToastMsg('⚙️ Real SMTP Server Credentials Saved! Direct email sending enabled.');
    setSmtpModalOpen(false);
  };

  const getSmtpCredsPayload = () => {
    if (smtpUser && smtpPass) {
      return {
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort, 10) || 587,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        imap_host: smtpHost.replace('smtp.', 'imap.'),
        imap_port: 993,
        imap_user: smtpUser,
        imap_pass: smtpPass
      };
    }
    return undefined;
  };

  // Nodal Email Resolver helper
  const getNodalContact = (nameOrType: string) => {
    const nodalEmailMap: Record<string, { email: string; name: string }> = {
      'union': { email: 'nodal.compliance@unionbankofindia.bank', name: 'Union Bank of India Nodal Legal Cell' },
      'indusind': { email: 'compliance.nodal@indusind.com', name: 'IndusInd Bank Nodal Fraud Control Cell' },
      'idbi': { email: 'compliance.nodal@idbi.co.in', name: 'IDBI Bank Nodal Compliance Cell' },
      'hdfc': { email: 'nodal.fraud@hdfcbank.com', name: 'HDFC Bank Nodal Fraud Control Cell' },
      'sbi': { email: 'compliance.nodal@sbi.co.in', name: 'State Bank of India Compliance Cell' },
      'icici': { email: 'fraud.nodal@icicibank.com', name: 'ICICI Bank Nodal Response Cell' },
      'axis': { email: 'nodal.fraud@axisbank.com', name: 'Axis Bank Fraud Control Cell' },
      'airtel': { email: 'nodal@airtel.com', name: 'Airtel Nodal Compliance Division' },
      'jio': { email: 'nodal.officer@jio.com', name: 'Reliance Jio LEA Cell' },
      'vodafone': { email: 'nodal.lea@vodafoneidea.com', name: 'Vodafone Idea Regulatory Cell' },
      'google': { email: 'lert-requests@google.com', name: 'Google Law Enforcement Response Team' },
      'whatsapp': { email: 'courtorders@whatsapp.com', name: 'WhatsApp Law Enforcement Cell' },
      'telegram': { email: 'legal@telegram.org', name: 'Telegram FZ-LLC Legal Compliance Division' },
      'paytm': { email: 'nodal.officer@paytm.com', name: 'Paytm Payments Bank Nodal Office' }
    };
    const key = (nameOrType || '').toLowerCase();
    return Object.entries(nodalEmailMap).find(([k]) => key.includes(k))?.[1];
  };

  // Compile case directives list from Module 3 (or activeCase entities)
  const [directives, setDirectives] = useState<DirectiveItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Active Selected Directive State for Right Panel Form
  const [autoCaseNumber, setAutoCaseNumber] = useState(activeCase?.case_number || '');
  const [autoDomain, setAutoDomain] = useState('financial_fraud');
  const [autoObjective, setAutoObjective] = useState('');
  const [autoReceiverName, setAutoReceiverName] = useState('');
  const [autoTargetId, setAutoTargetId] = useState('');
  const [autoReceiverEmail, setAutoReceiverEmail] = useState('');

  // Resolved Preview Result
  const [resolvedResult, setResolvedResult] = useState<any | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [isBatchDispatching, setIsBatchDispatching] = useState(false);

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
  const [simSender, setSimSender] = useState('');
  const [simSubject, setSimSubject] = useState('');
  const [simBody, setSimBody] = useState('');
  const [simFilename, setSimFilename] = useState('');



  // Initialize and Sync Directives List when activeCase or investigationData changes
  useEffect(() => {
    const caseRef = activeCase?.case_number || '';
    setAutoCaseNumber(caseRef);

    // RESTORE SAVED DISPATCHED DIRECTIVES FROM CASE STORE IF PRESENT!
    const savedForCase = caseRef ? (dispatchedDirectivesByCase[caseRef] || []) : [];
    if (savedForCase.length > 0) {
      setDirectives(savedForCase);
      selectDirectiveItem(0, savedForCase);
      return;
    }

    const m3Requests = (investigationData as any)?.legal_requests || (activeCase as any)?.legal_requests || [];
    let initialList: DirectiveItem[] = [];

    if (m3Requests.length > 0) {
      initialList = m3Requests.map((req: any, idx: number) => {
        const provider = req.target_provider || req.provider || '';
        const desc = req.description || req.title || '';
        const reqType = req.request_type || req.type || 'SECTION_94_BNSS';

        const acctMatch = desc.match(/\b\d{9,18}\b/);
        const phoneMatch = desc.match(/\b\+?\d{10,12}\b/);
        const handleMatch = desc.match(/@[A-Za-z0-9_]+/);

        let targetId = '';
        if (acctMatch) targetId = acctMatch[0];
        else if (phoneMatch) targetId = phoneMatch[0];
        else if (handleMatch) targetId = handleMatch[0];

        let domain = 'financial_fraud';
        const provLower = provider.toLowerCase();
        const descLower = desc.toLowerCase();
        if (provLower.includes('telecom') || provLower.includes('airtel') || provLower.includes('jio') || descLower.includes('cdr')) {
          domain = 'telecom_location';
        } else if (provLower.includes('telegram') || provLower.includes('google') || provLower.includes('meta') || provLower.includes('whatsapp') || reqType.includes('PLATFORM')) {
          domain = 'cyber_crime';
        } else if (provLower.includes('bank') || descLower.includes('freeze') || descLower.includes('remittance')) {
          domain = 'financial_fraud';
        }

        const contact = getNodalContact(provider);
        const email = contact?.email || '';

        const hasRequired = Boolean(provider && desc && email && (targetId || domain !== 'financial_fraud'));

        return {
          id: `DIR-0${idx + 1}`,
          title: `${provider}: ${desc}`,
          objective: desc,
          target_provider: provider,
          target_id: targetId,
          domain,
          receiver_email: email,
          request_type: reqType,
          status: hasRequired ? 'READY_TO_DISPATCH' : 'PENDING_INPUT'
        };
      });
    } else if (activeCase?.entities) {
      let count = 1;

      (activeCase.entities.bank_accounts || []).forEach((bank: any) => {
        const acctNo = typeof bank === 'object' ? bank.account_number : bank;
        const bankName = typeof bank === 'object' ? (bank.bank || 'Bank Nodal Cell') : 'Bank Nodal Cell';
        if (acctNo) {
          const contact = getNodalContact(bankName);
          const email = contact?.email || '';
          initialList.push({
            id: `DIR-0${count++}`,
            title: `Debit Freeze: ${bankName} (${acctNo})`,
            objective: `Debit Freeze Order for Accused Beneficiary Account ${acctNo}`,
            target_provider: bankName,
            target_id: String(acctNo),
            domain: 'financial_fraud',
            receiver_email: email,
            request_type: 'SECTION_94_BNSS',
            status: email ? 'READY_TO_DISPATCH' : 'PENDING_INPUT'
          });
        }
      });

      (activeCase.entities.phone_numbers || []).forEach((phone: string) => {
        const contact = getNodalContact('airtel');
        const email = contact?.email || '';
        initialList.push({
          id: `DIR-0${count++}`,
          title: `CDR Requisition: Mobile ${phone}`,
          objective: `Requisition for Call Detail Records (CDR) and Tower Dump for ${phone}`,
          target_provider: 'Telecom Operator Nodal Officer',
          target_id: String(phone),
          domain: 'telecom_location',
          receiver_email: email,
          request_type: 'SECTION_94_BNSS',
          status: email ? 'READY_TO_DISPATCH' : 'PENDING_INPUT'
        });
      });
    }

    // Merge saved dispatched directives from store to preserve DISPATCHED_SMTP status
    const savedDirectives = caseRef ? (dispatchedDirectivesByCase[caseRef] || []) : [];
    const savedMap = new Map(savedDirectives.map((d: any) => [d.id || d.title || d.target_id, d]));

    const mergedList = initialList.map((item: any) => {
      const key = item.id || item.title || item.target_id;
      const saved = savedMap.get(key);
      if (saved && (saved.status === 'DISPATCHED_SMTP' || saved.status === 'RESPONSE_RECEIVED' || saved.status === 'AWAITING_PROVIDER_REPLY' || saved.status === 'DEFECTIVE_AWAITING_CURE')) {
        return { ...item, ...saved, status: saved.status, dispatched_at: saved.dispatched_at || item.dispatched_at };
      }
      return item;
    });

    // Also append any extra custom saved directives for this case
    savedDirectives.forEach((sd: any) => {
      const key = sd.id || sd.title || sd.target_id;
      if (!initialList.some((it: any) => (it.id || it.title || it.target_id) === key)) {
        mergedList.push(sd);
      }
    });

    const listToSet = mergedList.length > 0 ? mergedList : initialList;
    setDirectives(listToSet);
    if (caseRef && listToSet.length > 0) {
      saveDispatchedDirectivesForCase(caseRef, listToSet);
    }
    if (listToSet.length > 0) {
      selectDirectiveItem(0, listToSet);
    } else {
      clearRightForm();
    }
  }, [activeCase?.case_number, (investigationData as any)?.legal_requests?.length]);

  const clearRightForm = () => {
    setAutoObjective('');
    setAutoReceiverName('');
    setAutoTargetId('');
    setAutoDomain('financial_fraud');
    setAutoReceiverEmail('');
    setResolvedResult(null);
  };

  const selectDirectiveItem = (index: number, list = directives) => {
    if (!list[index]) return;
    const item = list[index];
    setSelectedIndex(index);
    setAutoObjective(item.objective);
    setAutoReceiverName(item.target_provider);
    setAutoTargetId(item.target_id);
    setAutoDomain(item.domain);
    setAutoReceiverEmail(item.receiver_email);
    setDispatchStatus(item.status === 'DISPATCHED_SMTP' ? 'DISPATCHED_AND_LOGGED' : null);

    if (item.receiver_email && item.target_provider && item.objective) {
      resolveNoticeForDirective(item);
    } else {
      setResolvedResult(null);
    }

    setSimSender(item.receiver_email || 'compliance.nodal@authority.bank');
    setSimSubject(`Re: Statutory Notice [CrimeOS-REF: ${activeCase?.case_number || autoCaseNumber}]`);
    setSimBody(`Dear Investigating Officer,\n\nPlease find attached the requested transaction statement / CDR logs for target ${item.target_id}.\n\nRegards,\nNodal Officer, ${item.target_provider}`);
    setSimFilename(`${item.domain}_reply_${item.target_id || 'data'}.csv`);
  };

  const getMissingFields = (item?: DirectiveItem) => {
    const current = item || directives[selectedIndex];
    const missing: string[] = [];

    if (!autoCaseNumber && !activeCase?.case_number) missing.push('Case Number / FIR Reference');
    if (!autoReceiverName && !current?.target_provider) missing.push('Intermediary / Authority Name');
    if (!autoObjective && !current?.objective) missing.push('Investigation Objective');
    if (!autoReceiverEmail && !current?.receiver_email) missing.push('Nodal Officer Email Address');
    if (!autoTargetId && !current?.target_id) missing.push('Target Identifier (Account / Phone / Handle)');

    return missing;
  };

  const resolveNoticeForDirective = (itemOver?: DirectiveItem) => {
    const current = itemOver || directives[selectedIndex];
    const recName = autoReceiverName || current?.target_provider || '';
    const obj = autoObjective || current?.objective || '';
    const tgtId = autoTargetId || current?.target_id || '';
    const domain = autoDomain || current?.domain || 'financial_fraud';

    let matchedContact = getNodalContact(recName);
    let finalEmail = autoReceiverEmail || current?.receiver_email || (matchedContact ? matchedContact.email : '');
    let finalEntityName = matchedContact ? matchedContact.name : recName;

    if (!finalEmail || !recName || !obj) {
      return;
    }

    let selectedTmplId = 'legal_order_user_data';
    let selectedTmplTitle = 'Official Statutory Demand for User Data';
    let statuteRef = 'Section 94 BNSS / Section 91 CrPC';

    if (domain === 'financial_fraud' || obj.toLowerCase().includes('freeze') || obj.toLowerCase().includes('hold')) {
      selectedTmplId = 'financial_freeze_order';
      selectedTmplTitle = 'Financial Hold / Account Freeze Directive';
      statuteRef = 'Section 106 BNSS / Section 102 CrPC';
    } else if (domain === 'cyber_crime' || obj.toLowerCase().includes('ip') || obj.toLowerCase().includes('log') || obj.toLowerCase().includes('subpoena')) {
      selectedTmplId = 'cyber_ip_log_requisition';
      selectedTmplTitle = 'IP Log & Account Metadata Requisition';
      statuteRef = 'Section 94 BNSS / Section 79A IT Act';
    } else if (domain === 'telecom_location' || obj.toLowerCase().includes('cdr') || obj.toLowerCase().includes('tower')) {
      selectedTmplId = 'telecom_cdr_requisition';
      selectedTmplTitle = 'Call Detail Record (CDR) & Cell Tower Dump Order';
      statuteRef = 'Section 94 BNSS / Section 91 CrPC';
    } else if (domain === 'corporate_payroll' || obj.toLowerCase().includes('audit') || obj.toLowerCase().includes('corporate')) {
      selectedTmplId = 'corporate_audit_requisition';
      selectedTmplTitle = 'Corporate Payroll & Contractual Audit Order';
      statuteRef = 'Section 94 BNSS / Section 91 CrPC';
    } else if (domain === 'physical_homicide' || obj.toLowerCase().includes('cctv') || obj.toLowerCase().includes('preservation')) {
      selectedTmplId = 'physical_cctv_preservation';
      selectedTmplTitle = 'CCTV Footage & Physical Exhibit Preservation Directive';
      statuteRef = 'Section 105 BNSS / Section 100 CrPC';
    }

    const caseRef = autoCaseNumber || activeCase?.case_number || 'CR-2026-XXXX';
    const trackingToken = `[CrimeOS-REF: ${caseRef}]`;
    const subject = `URGENT STATUTORY DIRECTIVE: ${obj} - Target ${tgtId} [Case: ${caseRef}] ${trackingToken}`;
    const body = `To,\nThe Nodal Officer / Fraud Control & Operations\n${finalEntityName}\n\nSTATUTORY DIRECTIVE UNDER ${statuteRef.toUpperCase()}\n\nCase FIR / Ref: ${caseRef}\nTarget Identifier: ${tgtId || 'N/A'}\nDomain Category: ${domain.toUpperCase()}\n\nWHEREAS an active police investigation is underway regarding ${obj},\nyou are hereby directed to take immediate statutory action for target identifier ${tgtId}.\n\nPlease acknowledge receipt and submit compliance documentation to the undersigned unit.\n\nInvestigating Officer: PSI Inspector V. K. Patel\nSurat Cyber Crime Police Station\nEmail: officer.cyber@police.gov.in`;

    const resObj = {
      template_id: selectedTmplId,
      template_title: selectedTmplTitle,
      statute_ref: statuteRef,
      resolved_email: finalEmail,
      resolved_entity: finalEntityName,
      tracking_token: trackingToken,
      subject,
      body
    };

    setResolvedResult(resObj);
    if (finalEmail && !autoReceiverEmail) setAutoReceiverEmail(finalEmail);
  };

  const handleUpdateActiveDirectiveForm = (field: string, val: string) => {
    let newEmail = autoReceiverEmail;

    if (field === 'receiver_name') {
      setAutoReceiverName(val);
      const contact = getNodalContact(val);
      if (contact && contact.email) {
        newEmail = contact.email;
        setAutoReceiverEmail(contact.email);
      }
    } else if (field === 'receiver_email') {
      newEmail = val;
      setAutoReceiverEmail(val);
    } else if (field === 'objective') {
      setAutoObjective(val);
    } else if (field === 'target_id') {
      setAutoTargetId(val);
    } else if (field === 'domain') {
      setAutoDomain(val);
    }

    setDirectives((prev) => {
      const updated = [...prev];
      if (updated[selectedIndex]) {
        const cur = updated[selectedIndex];
        const nextEmail = field === 'receiver_email' ? val : (field === 'receiver_name' && newEmail ? newEmail : cur.receiver_email);
        const nextObj = field === 'objective' ? val : cur.objective;
        const nextTgt = field === 'target_id' ? val : cur.target_id;
        const nextProv = field === 'receiver_name' ? val : cur.target_provider;

        const isReady = Boolean(nextEmail && nextObj && nextProv && nextTgt);

        updated[selectedIndex] = {
          ...cur,
          objective: nextObj,
          target_provider: nextProv,
          target_id: nextTgt,
          domain: field === 'domain' ? val : cur.domain,
          receiver_email: nextEmail,
          status: cur.status === 'DISPATCHED_SMTP' ? 'DISPATCHED_SMTP' : (isReady ? 'READY_TO_DISPATCH' : 'PENDING_INPUT')
        };
      }
      return updated;
    });

    resolveNoticeForDirective();
  };

  const handleAddNewDirectiveItem = () => {
    const newId = `DIR-0${directives.length + 1}`;
    const newItem: DirectiveItem = {
      id: newId,
      title: 'New Statutory Directive Order',
      objective: '',
      target_provider: '',
      target_id: '',
      domain: 'financial_fraud',
      receiver_email: '',
      request_type: 'SECTION_94_BNSS',
      status: 'PENDING_INPUT'
    };

    const nextList = [...directives, newItem];
    setDirectives(nextList);
    selectDirectiveItem(nextList.length - 1, nextList);
    setToastMsg(`Added Directive ${newId} to case checklist. Enter required details on right panel.`);
  };

  const handleAutoDispatchNotice = async () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      setToastMsg(`⚠️ Cannot dispatch! Required fields missing: ${missing.join(', ')}`);
      return;
    }

    if (!resolvedResult) {
      resolveNoticeForDirective();
    }

    const emailToSend = autoReceiverEmail || resolvedResult?.resolved_email;
    const caseRef = autoCaseNumber || activeCase?.case_number;
    const smtpCreds = getSmtpCredsPayload();

    try {
      await api.post('/api/workflow/dispatch-notice', {
        case_number: caseRef,
        objective: autoObjective,
        receiver_name: autoReceiverName,
        receiver_email: emailToSend,
        receiver_type: autoDomain,
        context_data: {
          target_identifier: autoTargetId,
          entity_name: resolvedResult?.resolved_entity || autoReceiverName,
          domain: autoDomain
        },
        smtp_credentials: smtpCreds
      });

      setDirectives((prev) => {
        const updated = [...prev];
        if (updated[selectedIndex]) {
          updated[selectedIndex] = {
            ...updated[selectedIndex],
            status: 'DISPATCHED_SMTP',
            dispatched_at: new Date().toLocaleTimeString()
          };
        }
        if (caseRef) {
          saveDispatchedDirectivesForCase(caseRef, updated);
          updateCompletedStep(caseRef, 4);
        }
        return updated;
      });

      setToastMsg(`🚀 REAL SMTP EMAIL DISPATCHED to ${emailToSend}! Tracking Ref: ${caseRef}`);
      setDispatchStatus('DISPATCHED_AND_LOGGED');
      checkInboxForReplies(caseRef, smtpCreds);
    } catch (err: any) {
      const errDetail = err.response?.data?.detail || err.response?.data?.error || err.message || 'SMTP Dispatch failed';
      console.error('Real SMTP dispatch error:', errDetail);
      setToastMsg(`❌ Real SMTP Email Dispatch Failed: ${errDetail}`);
    }
  };

  const handleBatchDispatchAllReady = async () => {
    const readyItems = directives.filter((d) => d.status === 'READY_TO_DISPATCH');
    if (readyItems.length === 0) {
      setToastMsg('⚠️ No directives are marked READY TO DISPATCH. Please fill in missing details first.');
      return;
    }

    setIsBatchDispatching(true);
    let successCount = 0;
    let failedCount = 0;
    let lastError = '';
    const smtpCreds = getSmtpCredsPayload();
    const caseRef = autoCaseNumber || activeCase?.case_number;

    for (const item of readyItems) {
      try {
        await api.post('/api/workflow/dispatch-notice', {
          case_number: caseRef,
          objective: item.objective,
          receiver_name: item.target_provider,
          receiver_email: item.receiver_email,
          receiver_type: item.domain,
          context_data: {
            target_identifier: item.target_id,
            domain: item.domain
          },
          smtp_credentials: smtpCreds
        });
        successCount++;
      } catch (err: any) {
        failedCount++;
        lastError = err.response?.data?.detail || err.message;
      }
    }

    if (successCount > 0) {
      const updatedList = directives.map((d) =>
        d.status === 'READY_TO_DISPATCH' ? { ...d, status: 'DISPATCHED_SMTP' as const, dispatched_at: new Date().toLocaleTimeString() } : d
      );
      setDirectives(updatedList);
      if (caseRef) {
        saveDispatchedDirectivesForCase(caseRef, updatedList);
        updateCompletedStep(caseRef, 4);
      }
      setToastMsg(`🎉 Real SMTP Batch Dispatched ${successCount} Legal Email Directives for Case ${autoCaseNumber}!`);
    } else {
      setToastMsg(`❌ Real SMTP Batch Dispatch Failed: ${lastError || 'Authentication failed'}`);
    }

    setIsBatchDispatching(false);
  };



  // Selected Email Reply for Review & Followback Drafting
  const activeCaseRef = activeCase?.case_number || autoCaseNumber || 'CR-2026-9914';
  const currentReplies = processedRepliesByCase[activeCaseRef] || processedReplies || [];
  const [selectedReply, setSelectedReply] = useState<any>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  useEffect(() => {
    if (activeCaseRef) {
      const creds = getSmtpCredsPayload();
      checkInboxForReplies(activeCaseRef, creds);
    }
  }, [activeCaseRef]);

  useEffect(() => {
    if (currentReplies.length > 0 && !selectedReply) {
      const first = currentReplies[0];
      setSelectedReply(first);
      if (first.followback_draft) {
        setEditedSubject(first.followback_draft.subject || '');
        setEditedBody(first.followback_draft.body || '');
      }
    }
  }, [currentReplies]);

  const handleSelectReply = (reply: any) => {
    setSelectedReply(reply);
    if (reply.followback_draft) {
      setEditedSubject(reply.followback_draft.subject || '');
      setEditedBody(reply.followback_draft.body || '');
    } else {
      setEditedSubject('');
      setEditedBody('');
    }
  };

  const handleCheckInbox = async () => {
    const creds = getSmtpCredsPayload();
    const res = await checkInboxForReplies(activeCaseRef, creds);
    setToastMsg(`📩 Checked inbox! Fetched & classified ${res?.replies_count || 0} authority replies via Groq LLM.`);
    setTimeout(() => setToastMsg(''), 5000);
  };

  const handleSendFollowback = async () => {
    if (!selectedReply || !editedSubject || !editedBody) return;
    try {
      const creds = getSmtpCredsPayload();
      await sendFollowbackEmail({
        case_number: activeCaseRef,
        recipient_email: selectedReply.sender_email,
        subject: editedSubject,
        body: editedBody,
        smtp_credentials: creds
      });
      setToastMsg(`✅ Followback email approved & dispatched to ${selectedReply.sender_email} via SMTP!`);
    } catch (err: any) {
      setToastMsg(`❌ Followback dispatch failed: ${err.message || err}`);
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

  const handlePreview = (url: string) => {
    setSelectedPdf(url);
    setPdfModalOpen(true);
  };

  const handleRunReplySimulation = async () => {
    const caseRef = activeCase?.case_number || autoCaseNumber || 'CR-2026-9914';
    try {
      const res = await ingestSimulatedReply({
        case_number: caseRef,
        sender_email: simSender || autoReceiverEmail || 'nodal.compliance@authority.bank',
        subject: simSubject || `Re: Statutory Notice [CrimeOS-REF: ${caseRef}]`,
        body_text: simBody || `Dear Investigating Officer,\n\nPlease find attached transaction ledger for target ${autoTargetId || 'account'}.\n\nRegards,\nNodal Officer`,
        attachments: [
          {
            filename: simFilename || `reply_${caseRef}.csv`,
            content: `TxnID,Date,FromAcc,ToAcc,Amount,Type\nTXN901,2026-07-20,311102010008711,257735040901,900000,RTGS\nTXN902,2026-07-21,257735040901,1006104000176743,500000,UPI`,
            format: 'csv'
          }
        ]
      });

      const replyObj = res?.reply;
      const isComplete = replyObj?.is_complete;
      const providerUsed = replyObj?.llm_provider || 'Groq AI';

      // Update directive status in checklist
      setDirectives((prev) => {
        const updated = prev.map(d =>
          (d.receiver_email === (simSender || autoReceiverEmail) || d.target_id === autoTargetId)
            ? { ...d, status: 'RESPONSE_RECEIVED' as const, reply_received_at: new Date().toLocaleTimeString() }
            : d
        );
        if (caseRef) saveDispatchedDirectivesForCase(caseRef, updated);
        return updated;
      });

      if (isComplete) {
        setToastMsg(`✅ [${providerUsed}] Reply Classified as CASE_COMPLETE (Full Compliance). Marked complete — no followback email needed.`);
      } else {
        setToastMsg(`📩 [${providerUsed}] Reply Classified as ${replyObj?.classification || 'PARTIAL'}. Generated contextual followback draft for human review.`);
      }
      setSimModalOpen(false);
      setActiveTab('email_response');
    } catch (err) {
      console.error(err);
      setToastMsg('Simulated reply processing failed.');
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };


  const activeSubpoenasList = (investigationData as any)?.legal_requests || (activeCase as any)?.legal_requests || storeLegalRequests;
  const missingFieldsList = getMissingFields();

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none bg-[#050811]">

      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            {t('subpoenas.title', 'Module 4: Statutory Legal Directives & Dispatch Studio')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('subpoenas.subtitle', 'Issues official legal directives to nodal officers and manages automated authority responses.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSmtpModalOpen(true)}
            className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>⚙️ Dispatch Settings</span>
          </button>

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
            <span>{t('subpoenas.sim_reply_btn', 'Test Response Ingestion')}</span>
          </button>

          <button
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <span>{t('stepper.analytics', 'Module 5: Response Analytics')}</span>
            <ArrowRight className="h-4 w-4" />
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
      <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('auto_email_test')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold transition-colors ${activeTab === 'auto_email_test'
              ? 'bg-purple-600 text-white shadow-lg'
              : 'bg-[#0d1322] text-slate-400 hover:text-white border border-white/10'
              }`}
          >
            <ListChecks className="h-4 w-4 text-purple-300" />
            <span>Case Email Directives Studio ({directives.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('email_response')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-bold transition-colors ${activeTab === 'email_response'
              ? 'bg-amber-600 text-white'
              : 'bg-[#0d1322] text-slate-400 hover:text-white border border-white/10'
              }`}
          >
            <Mail className="h-4 w-4" />
            <span>Email Response & Followback Studio</span>
            {currentReplies.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/30 text-amber-300 px-1.5 py-0.2 text-[10px]">
                {currentReplies.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'auto_email_test' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNewDirectiveItem}
              className="flex items-center gap-1.5 rounded border border-white/10 bg-[#0d1322] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-purple-400" />
              <span>Add Directive</span>
            </button>

            <button
              onClick={handleBatchDispatchAllReady}
              disabled={isBatchDispatching || directives.filter(d => d.status === 'READY_TO_DISPATCH').length === 0}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-40 shadow-md"
            >
              {isBatchDispatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Dispatch Legal Directives ({directives.filter(d => d.status === 'READY_TO_DISPATCH').length})</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 0: MULTI-DIRECTIVE CASE EMAIL AUTOMATOR STUDIO */}
      {activeTab === 'auto_email_test' && (
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">

          {/* Left Panel: Case Directives Checklist (5 Cols) */}
          <div className="col-span-5 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5">
                    <ListChecks className="h-4 w-4 text-purple-400" />
                    Case Directives Checklist
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Case: <strong className="text-white">{activeCase?.case_number || 'Select Case'}</strong> ({directives.length} required emails)
                  </p>
                </div>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded border border-purple-500/30">
                  {directives.filter(d => d.status === 'DISPATCHED_SMTP').length}/{directives.length} DISPATCHED
                </span>
              </div>

              {/* Directives Checklist List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {directives.length === 0 ? (
                  <div className="p-6 rounded border border-white/5 bg-[#050811] text-center text-xs text-slate-500 space-y-2">
                    <p className="font-semibold text-slate-400">No email directives generated yet for this case.</p>
                    <p className="text-[11px]">Run Module 3 (AI Investigation Studio) or click "Add Directive" above to create one.</p>
                  </div>
                ) : (
                  directives.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isDispatched = item.status === 'DISPATCHED_SMTP';
                    const isReady = item.status === 'READY_TO_DISPATCH';
                    const isMissing = item.status === 'PENDING_INPUT';

                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => selectDirectiveItem(idx)}
                        className={`p-2.5 rounded border transition-all cursor-pointer ${isSelected
                          ? 'border-purple-500 bg-purple-500/10 shadow-md'
                          : 'border-white/10 bg-[#050811] hover:border-white/20'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded bg-purple-600/30 text-purple-300 text-[10px] font-mono font-bold flex items-center justify-center border border-purple-500/30">
                              {idx + 1}
                            </span>
                            <span className="font-mono text-xs font-bold text-white">{item.target_provider || 'Unassigned Provider'}</span>
                          </div>

                          {isDispatched ? (
                            <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> DISPATCHED
                            </span>
                          ) : isReady ? (
                            <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" /> READY TO SEND
                            </span>
                          ) : (
                            <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> MISSING DETAILS
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-medium text-slate-200 line-clamp-1">{item.objective || 'No objective specified'}</div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1 pt-1 border-t border-white/5">
                          <span className={item.target_id ? 'text-amber-300 font-bold' : 'text-rose-400 font-bold'}>
                            ID: {item.target_id || '⚠️ Missing ID'}
                          </span>
                          <span className={item.receiver_email ? 'text-emerald-400 font-bold truncate max-w-[150px]' : 'text-rose-400 font-bold'}>
                            {item.receiver_email || '⚠️ Missing Email'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Selected Directive Configuration & Live Notice Studio (7 Cols) */}
          <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto">
            {directives.length > 0 && directives[selectedIndex] ? (
              <div className="space-y-3 flex-1 flex flex-col">

                {/* Header for Selected Directive */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-300 font-mono uppercase bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded">
                      DIRECTIVE #{selectedIndex + 1} ({directives[selectedIndex].id})
                    </span>
                    <h3 className="text-xs font-bold text-white truncate max-w-sm">
                      {directives[selectedIndex].title}
                    </h3>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    Domain: <strong className="text-amber-300">{autoDomain.toUpperCase()}</strong>
                  </span>
                </div>

                {/* Missing Details Warning Banner (Strict NO-HARDCODED Fallback Rule) */}
                {missingFieldsList.length > 0 && (
                  <div className="p-3 rounded border border-rose-500/50 bg-rose-500/10 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-wider font-mono">
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>REQUIRED DETAILS MISSING FOR STATUTORY TEMPLATE:</span>
                    </div>
                    <p className="text-xs text-rose-200 leading-relaxed font-mono">
                      Please enter the missing values below to enable statutory template rendering and real email dispatch:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {missingFieldsList.map((field, i) => (
                        <span key={i} className="rounded bg-rose-950 border border-rose-500/40 text-rose-300 px-2 py-0.5 text-[10px] font-mono font-bold">
                          ⚠️ {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Fields Editor for Selected Directive */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Intermediary / Authority Name *
                    </label>
                    <input
                      type="text"
                      value={autoReceiverName}
                      onChange={(e) => handleUpdateActiveDirectiveForm('receiver_name', e.target.value)}
                      placeholder="e.g. Union Bank / IndusInd Bank / Telegram"
                      className={`w-full bg-[#050811] border rounded px-2.5 py-1.5 text-xs text-white outline-none font-semibold ${!autoReceiverName ? 'border-rose-500/60 bg-rose-950/20' : 'border-white/10 focus:border-purple-500'
                        }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Target Identifier (Account / Mobile / Handle) *
                    </label>
                    <input
                      type="text"
                      value={autoTargetId}
                      onChange={(e) => handleUpdateActiveDirectiveForm('target_id', e.target.value)}
                      placeholder="e.g. 257735040901 / +2223755264"
                      className={`w-full bg-[#050811] border rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono outline-none ${!autoTargetId ? 'border-rose-500/60 bg-rose-950/20' : 'border-white/10 focus:border-purple-500'
                        }`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Nodal Officer Email Address *
                    </label>
                    <input
                      type="email"
                      value={autoReceiverEmail}
                      onChange={(e) => handleUpdateActiveDirectiveForm('receiver_email', e.target.value)}
                      placeholder="Enter Nodal Email (e.g. compliance.nodal@indusind.com)"
                      className={`w-full bg-[#050811] border rounded px-2.5 py-1.5 text-xs text-emerald-400 font-mono outline-none ${!autoReceiverEmail ? 'border-rose-500/60 bg-rose-950/20' : 'border-white/10 focus:border-purple-500'
                        }`}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Investigation Objective / Action *
                    </label>
                    <input
                      type="text"
                      value={autoObjective}
                      onChange={(e) => handleUpdateActiveDirectiveForm('objective', e.target.value)}
                      placeholder="e.g. Debit Freeze on Accused Account 257735040901"
                      className={`w-full bg-[#050811] border rounded px-2.5 py-1.5 text-xs text-white outline-none ${!autoObjective ? 'border-rose-500/60 bg-rose-950/20' : 'border-white/10 focus:border-purple-500'
                        }`}
                    />
                  </div>
                </div>

                {/* Rendered Email Notice Draft Preview */}
                {resolvedResult ? (
                  <div className="flex-1 rounded border border-white/10 bg-[#050811] p-3 flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-white/10 pb-1.5 font-mono">
                      <span className="font-bold text-purple-300 flex items-center gap-1.5">
                        <Mail className="h-4 w-4 text-purple-400" />
                        Template: {resolvedResult.template_title}
                      </span>
                      <span className="text-[10px] text-emerald-400">To: {resolvedResult.resolved_email}</span>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Subject Line</label>
                      <div className="text-xs font-semibold text-white bg-[#0d1322] p-2 rounded border border-white/5 font-mono">
                        {resolvedResult.subject}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Statutory Email Body</label>
                      <textarea
                        readOnly
                        value={resolvedResult.body}
                        className="w-full flex-1 bg-[#0d1322] border border-white/5 rounded p-2.5 text-xs font-mono text-slate-200 resize-none outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded border border-white/5 bg-[#050811] text-center text-xs text-slate-400 font-mono">
                    Fill in all required fields above to automatically generate and preview the statutory email notice.
                  </div>
                )}

                {/* Action Buttons for Active Directive */}
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>Tracking Token: <strong>[CrimeOS-REF: {autoCaseNumber || activeCase?.case_number}]</strong></span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePreview(`/api/requests/download/Notice_Section_94_BNSS_${autoCaseNumber}.pdf`)}
                      className="px-3 py-2 rounded bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-600/30 transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>PDF Notice</span>
                    </button>

                    <button
                      onClick={handleAutoDispatchNotice}
                      disabled={missingFieldsList.length > 0}
                      className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors disabled:opacity-40 flex items-center gap-2 shadow-lg"
                    >
                      <Send className="h-4 w-4" />
                      <span>{dispatchStatus ? 'Real Email Dispatched via SMTP ✅' : 'Dispatch Real Email Notice'}</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                <Bot className="h-12 w-12 text-purple-400 opacity-60 animate-bounce" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Select a Directive from the Checklist</h3>
                <p className="text-xs text-slate-400 max-w-md">
                  Click on any email directive card from the left panel to configure its details, fill in missing fields, and dispatch statutory notices.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 1: EMAIL RESPONSE & FOLLOWBACK STUDIO */}
      {activeTab === 'email_response' && (
        <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">

          {/* Left Column: Processed Email Replies List (5 Cols) */}
          <div className="col-span-5 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-mono">
                <Mail className="h-4 w-4 text-amber-400" />
                Inbox Replies & Classification
              </span>
              <button
                onClick={handleCheckInbox}
                disabled={replyLoading}
                className="px-2.5 py-1 rounded border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 font-mono"
                title="Connect via IMAP to sync live email inbox & fetch new replies"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${replyLoading ? 'animate-spin' : ''}`} />
                <span>Check Inbox for Replies</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-3 shrink-0">
              Groq LLM automatically parses email replies for FIR <strong className="text-amber-400">{activeCaseRef}</strong>, classifies data completeness, and drafts followback emails for human officer review & SMTP dispatch.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {currentReplies.length === 0 ? (
                <div className="p-6 rounded border border-white/5 bg-[#050811] text-center text-xs text-slate-400 space-y-2 font-mono">
                  <UserCheck className="h-8 w-8 text-amber-400 opacity-60 mx-auto mb-1" />
                  <p className="font-bold text-white uppercase tracking-wider">No Replies Ingested for Case {activeCaseRef}</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Click <strong className="text-amber-400">"Check Inbox for Replies"</strong> above or <strong className="text-purple-400">"Simulate Authority Reply"</strong> to test Groq LLM email classification.
                  </p>
                </div>
              ) : (
                currentReplies.map((item: any) => {
                  const isComp = item.is_complete || item.classification === 'CASE_COMPLETE';
                  const isSent = item.status === 'FOLLOWBACK_SENT';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectReply(item)}
                      className={`p-3 rounded border transition-all cursor-pointer ${selectedReply?.id === item.id
                        ? 'border-amber-500 bg-amber-500/10 font-mono'
                        : 'border-white/10 bg-[#050811] hover:border-white/20 font-mono'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          {item.id}
                          {item.llm_provider && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              ⚡ {item.llm_provider}
                            </span>
                          )}
                        </span>

                        {isComp ? (
                          <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-emerald-400" /> DATA COMPLETE
                          </span>
                        ) : isSent ? (
                          <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> FOLLOWBACK SENT
                          </span>
                        ) : (
                          <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-rose-400" /> FOLLOWBACK NEEDED
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-200 line-clamp-1">{item.subject}</div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1.5 pt-1 border-t border-white/5">
                        <span className="text-slate-300 font-bold truncate max-w-[170px]">{item.sender_email}</span>
                        {item.classification && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isComp ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            }`}>
                            {item.classification}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Interactive Reply Review & Followback Dispatch Studio (7 Cols) */}
          <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto">
            {selectedReply ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400 font-mono uppercase">{selectedReply.id}</span>
                      {selectedReply.llm_provider && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {selectedReply.llm_provider}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-extrabold text-white">Email Reply Analysis & Followback Studio</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Sender: {selectedReply.sender_email}</span>
                </div>

                {/* Case Compliance Banner */}
                {(selectedReply.is_complete || selectedReply.classification === 'CASE_COMPLETE') ? (
                  <div className="p-3 rounded border border-emerald-500/40 bg-emerald-950/40 text-emerald-200 space-y-1.5 animate-fadeIn font-mono">
                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-300 uppercase">
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>DATA COMPLETE — FULL STATUTORY COMPLIANCE VERIFIED</span>
                    </div>
                    <p className="text-xs text-emerald-100 leading-relaxed">
                      {selectedReply.classification_reason || "Authority has fully complied with requested data and documents. Directive marked COMPLETED."}
                    </p>
                    <div className="text-[10px] text-emerald-400 pt-1 border-t border-emerald-500/20">
                      Status: <strong>DIRECTIVE COMPLETED</strong> — No followback email required.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded border border-amber-500/40 bg-amber-950/30 text-amber-200 space-y-1.5 animate-fadeIn font-mono">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-300 uppercase">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>PARTIAL DATA RECEIVED — FOLLOWBACK REQUIRED ({selectedReply.classification || 'PARTIAL'})</span>
                    </div>
                    <p className="text-xs text-amber-100 leading-relaxed">
                      {selectedReply.classification_reason || "Authority reply contains partial information. Contextual followback directive generated."}
                    </p>
                  </div>
                )}

                {/* Received & Missing Data Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 space-y-1">
                    <span className="font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
                      <FileCheck2 className="h-3.5 w-3.5" /> Received Items:
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                      {(selectedReply.received_items || ['Received email response']).map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded border border-rose-500/20 bg-rose-500/5 p-2 space-y-1">
                    <span className="font-bold text-rose-300 flex items-center gap-1 text-[11px]">
                      <AlertCircle className="h-3.5 w-3.5" /> Missing Items:
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                      {(selectedReply.missing_items?.length > 0 ? selectedReply.missing_items : ['None (Complete Data)']).map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Followback Email Draft Studio (Only if incomplete) */}
                {(!selectedReply.is_complete && selectedReply.classification !== 'CASE_COMPLETE') && (
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                        Followback Email Subject (Editable by IO)
                      </label>
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                        Statutory Followback Body (PSI V.K. Patel — Editable by IO)
                      </label>
                      <textarea
                        rows={8}
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        className="w-full rounded border border-white/10 bg-[#050811] p-2.5 text-xs font-mono text-slate-200 outline-none leading-relaxed"
                      />
                    </div>
                  </div>
                )}

                {/* Officer Human Approval & Dispatch Controls */}
                {(!selectedReply.is_complete && selectedReply.classification !== 'CASE_COMPLETE') && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-end">
                    <button
                      onClick={handleSendFollowback}
                      disabled={replyLoading || selectedReply.status === 'FOLLOWBACK_SENT'}
                      className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 font-mono shadow-lg"
                    >
                      {replyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span>Approve & Send Follow-Up Directives</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <UserCheck className="h-10 w-10 text-slate-600 mb-2" />
                <span className="text-xs font-semibold text-slate-400 font-mono">Select an ingested reply card from the left panel to inspect response analysis and send follow-up.</span>
              </div>
            )}
          </div>

        </div>
      )}


      {/* Real SMTP Server Credentials Settings Modal */}
      {smtpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-emerald-500/30 bg-[#0d1322] p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Settings className="h-4 w-4 text-emerald-400" />
                ⚙️ Dispatch Server Credentials
              </h3>
              <button onClick={() => setSmtpModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed font-mono bg-emerald-950/40 p-2 rounded border border-emerald-500/20">
              Configure official dispatch server credentials for sending statutory notices directly to target email addresses.
            </p>

            <div className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dispatch Server Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Port</label>
                  <input
                    type="text"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-amber-300 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sender Email / Username *</label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="your.email@gmail.com / officer@police.gov.in"
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Password / Access Key *</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="Enter 16-character App Password"
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-white outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSmtpModalOpen(false)}
                className="px-3 py-1.5 rounded border border-white/10 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={saveSmtpCredentials}
                className="px-4 py-1.5 rounded bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shadow-md"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Save Real Credentials</span>
              </button>
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
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <RefreshCw className="h-4 w-4" />
                Simulate Authority Email Reply Ingestion ({activeCase?.case_number || 'active case'})
              </h3>
              <button onClick={() => setSimModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Sender Email</label>
                <input
                  type="email"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  placeholder="e.g. compliance.nodal@indusind.com"
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Email Subject (with Case Token)</label>
                <input
                  type="text"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Reply Body Text</label>
                <textarea
                  rows={3}
                  value={simBody}
                  onChange={(e) => setSimBody(e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050811] p-2 text-slate-200 font-mono text-[11px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Attached File (CSV / Ledger / CDR)</label>
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
              <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <FolderPlus className="h-4 w-4 text-indigo-400" />
                Dynamic Notice Template Extension Builder
              </h3>
              <button onClick={() => setCustomModalOpen(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Template Unique ID</label>
                  <input
                    type="text"
                    value={newTemplateId}
                    onChange={(e) => setNewTemplateId(e.target.value)}
                    className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Category</label>
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
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Statutory Notice Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-slate-200 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Statutory Legal Statute Reference</label>
                <input
                  type="text"
                  value={newStatute}
                  onChange={(e) => setNewStatute(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Subject Template (Supports Placeholders e.g. &#123;&#123;case_number&#125;&#125;)</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-slate-200 outline-none text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 font-mono">Notice Body Template</label>
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
