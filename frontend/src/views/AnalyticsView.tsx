import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileUp,
  CheckCircle,
  FileText,
  PhoneCall,
  MapPin,
  Smartphone,
  Sparkles,
  Loader2,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Globe,
  ShieldAlert,
  Sliders,
  Share2,
  Cpu,
  Layers,
  Activity,
  Plus,
  Send,
  Link,
  ShieldCheck,
  RotateCcw,
  Download,
  UploadCloud,
  FileSpreadsheet,
  X,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import ModuleSummarizerModal from '../components/common/ModuleSummarizerModal';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';
import DynamicVisualizer, { VisualizationConfig } from '../components/common/DynamicVisualizer';

export default function AnalyticsView() {
  const navigate = useNavigate();
  const {
    activeCase,
    setSelectedInspectorItem,
    addTimelineEvent,
    responseAnalyticsByCase,
    saveResponseAnalyticsForCase,
    processedRepliesByCase,
    addDirectiveForCase,
    clearModule5EmailData
  } = useCaseStore();
  const { t } = useLangStore();

  const [loading, setLoading] = useState(false);
  const [responseType, setResponseType] = useState<'BANK_STATEMENT' | 'CDR' | 'IP_LOGS'>('BANK_STATEMENT');
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedChartType, setSelectedChartType] = useState<string>('AUTO');
  const [toastMsg, setToastMsg] = useState('');
  const [summarizerOpen, setSummarizerOpen] = useState(false);

  // Section 63 BSA Certificate Modal State
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certData, setCertData] = useState<any>(null);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const currentCaseNo = activeCase?.case_number || 'CR-2026-9914';
  const caseReplies = processedRepliesByCase[currentCaseNo] || [];

  // Load persistent response analytics if available for current case
  useEffect(() => {
    if (activeCase?.case_number) {
      const savedAnalytics = responseAnalyticsByCase[activeCase.case_number] || activeCase.response_analytics;
      if (savedAnalytics && savedAnalytics.total_records > 0 && savedAnalytics.status === 'success') {
        setParsedData(savedAnalytics);
        if (savedAnalytics.section_63_certificate) {
          setCertData(savedAnalytics.section_63_certificate);
        }
        setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: savedAnalytics });
      } else {
        setParsedData(null);
        setCertData(null);
      }
    } else {
      setParsedData(null);
      setCertData(null);
    }
  }, [activeCase?.case_number, responseAnalyticsByCase]);

  // ── Parse & Ingest Provider File via API or Real Upload ───────────────────────────
  const handleProcessFile = async (
    selectedType?: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS',
    replyItem?: any,
    uploadedFile?: File
  ) => {
    const targetType = selectedType || responseType;
    const caseRef = currentCaseNo;
    const activeFile = uploadedFile || selectedFile;

    setLoading(true);
    setToastMsg('');

    try {
      let analyticsPayload: any = null;

      if (!activeFile && !replyItem) {
        setToastMsg('Please drag & drop or upload a response file (CSV, Excel, or PDF) to perform forensic analysis.');
        setLoading(false);
        return;
      }

      if (activeFile) {
        // Direct Multipart File Upload
        const formData = new FormData();
        formData.append('file', activeFile);
        formData.append('case_number', caseRef);
        formData.append('response_type', targetType);
        if (activeCase?.entities) {
          formData.append('case_entities', JSON.stringify(activeCase.entities));
        }

        const res = await api.post('/api/analytics/upload-and-parse', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        analyticsPayload = res.data;
      } else {
        // Parse from inbound reply attachment or content
        const res = await api.post('/api/analytics/parse-response', {
          case_number: caseRef,
          response_type: targetType,
          reply_id: replyItem?.id,
          file_content: replyItem?.body_text || (replyItem?.attachments?.[0]?.content) || undefined,
          case_entities: activeCase?.entities || undefined
        });
        analyticsPayload = res.data;
      }

      if (analyticsPayload.status === 'empty' || analyticsPayload.total_records === 0) {
        setToastMsg(analyticsPayload.message || `No records found in the response payload for ${targetType}.`);
        setParsedData(null);
        setCertData(null);
        return;
      }

      setParsedData(analyticsPayload);
      if (analyticsPayload.section_63_certificate) {
        setCertData(analyticsPayload.section_63_certificate);
      }

      saveResponseAnalyticsForCase(caseRef, analyticsPayload);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: analyticsPayload });

      addTimelineEvent({
        module: 'MODULE_5_ANALYTICS',
        stage: 'ANALYTICS_PARSED',
        step_title: `Ingested ${targetType} Evidence (${caseRef})`,
        details: analyticsPayload.executive_summary || `Parsed ${targetType} evidence. Action: ${analyticsPayload.recommended_next_action}`,
        timestamp: new Date().toISOString(),
        status: 'VERIFIED'
      });

      setToastMsg(`Successfully analyzed ${targetType} response for Case ${caseRef}! Evidence transmitted to Module 6.`);
    } catch (err: any) {
      console.warn('API error parsing response file:', err);
      setToastMsg(err.response?.data?.detail || err.message || `Failed to parse ${targetType} response file.`);
    } finally {
      setLoading(false);
      setSelectedChartType('AUTO');
      setSelectedFile(null);
    }
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);

      // Auto-detect response type from filename
      const fname = file.name.toLowerCase();
      let autoType: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS' = responseType;
      if (fname.includes('cdr') || fname.includes('call') || fname.includes('telecom')) {
        autoType = 'CDR';
      } else if (fname.includes('ip') || fname.includes('log') || fname.includes('lert') || fname.includes('cyber')) {
        autoType = 'IP_LOGS';
      } else if (fname.includes('bank') || fname.includes('statement') || fname.includes('hdfc') || fname.includes('sbi') || fname.includes('ledger')) {
        autoType = 'BANK_STATEMENT';
      }
      setResponseType(autoType);
      handleProcessFile(autoType, null, file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const fname = file.name.toLowerCase();
      let autoType: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS' = responseType;
      if (fname.includes('cdr') || fname.includes('call') || fname.includes('telecom')) {
        autoType = 'CDR';
      } else if (fname.includes('ip') || fname.includes('log') || fname.includes('lert') || fname.includes('cyber')) {
        autoType = 'IP_LOGS';
      } else if (fname.includes('bank') || fname.includes('statement') || fname.includes('hdfc') || fname.includes('sbi')) {
        autoType = 'BANK_STATEMENT';
      }
      setResponseType(autoType);
      handleProcessFile(autoType, null, file);
    }
  };

  // Quick Sample File Loader for Instant Verification
  const handleLoadSampleFile = (type: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS') => {
    let sampleContent = '';
    let fileName = '';
    const caseRef = currentCaseNo;
    const targetAcct = activeCase?.entities?.bank_accounts?.[0]
      ? (typeof activeCase.entities.bank_accounts[0] === 'object' ? activeCase.entities.bank_accounts[0].account_number : activeCase.entities.bank_accounts[0])
      : '5010023411';
    const lossAmt = activeCase?.entities?.monetary_loss || 200000;
    const secondaryMule = `${targetAcct.slice(0, 4)}99${targetAcct.slice(6) || '1029'}`;

    if (type === 'BANK_STATEMENT') {
      fileName = `bank_statement_${caseRef.replace('/', '_')}.csv`;
      sampleContent = `Txn_Date,Value_Date,Description,Debit_Amount,Credit_Amount,Balance,Transaction_Type\n2026-07-15,2026-07-15,RTGS INFLOW FROM COMPLAINANT,0.00,${lossAmt},${lossAmt},RTGS\n2026-07-15,2026-07-15,IMPS TFR TO ${targetAcct} SUSPECT MULE,${Math.round(lossAmt * 0.85)},0.00,${Math.round(lossAmt * 0.15)},IMPS\n2026-07-16,2026-07-16,IMPS TFR TO ${secondaryMule} LAYER2 MULE,${Math.round(lossAmt * 0.60)},0.00,${Math.round(lossAmt * 0.05)},IMPS\n2026-07-16,2026-07-16,ATM CASH WDL RING ROAD BRANCH,${Math.round(lossAmt * 0.05)},0.00,0.00,ATM`;
    } else if (type === 'CDR') {
      fileName = `telecom_cdr_${caseRef.replace('/', '_')}.csv`;
      const primaryPhone = activeCase?.entities?.phone_numbers?.[0] || '+919876543210';
      sampleContent = `Call_Date,Call_Time,Calling_Party,Called_Party,Call_Type,Duration_Sec,Tower_ID,Cell_Site_Address,IMEI\n2026-07-01,00:14:22,${primaryPhone},+919825011223,OUTGOING,180,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,01:04:33,+919825011223,${primaryPhone},INCOMING,45,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,02:18:05,${primaryPhone},+919879044551,OUTGOING,210,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,03:45:12,+919426099881,${primaryPhone},INCOMING,320,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,08:30:00,${primaryPhone},+919825011223,OUTGOING,90,AHM-SAT-TW-09,Satellite ISRO Junction,864910049201923\n2026-07-01,14:20:10,${primaryPhone},+919879044551,OUTGOING,600,AHM-CG-TW-42,CG Road Municipal Market,864910049201999\n2026-07-01,22:10:15,+919825011223,${primaryPhone},INCOMING,110,AHM-CG-TW-42,CG Road Municipal Market,864910049201999`;
    } else {
      fileName = `cyber_ip_logs_${caseRef.replace('/', '_')}.csv`;
      sampleContent = `Timestamp,Source_IP,Destination_Port,Protocol,Action,User_Agent\n2026-07-20 01:14:22,185.220.101.4,443,TCP,ALLOW,Mozilla/5.0 (Windows NT 10.0; Win64; x64) TOR/Browser\n2026-07-20 01:18:05,185.220.101.4,443,TCP,ALLOW,Mozilla/5.0 (Windows NT 10.0; Win64; x64) TOR/Browser\n2026-07-20 02:45:12,45.142.120.9,443,TCP,ALLOW,Mozilla/5.0 (Android 14; Mobile) Chrome/126.0\n2026-07-20 03:10:00,103.21.244.2,443,TCP,ALLOW,Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Safari/604.1\n2026-07-20 03:40:55,185.220.101.4,443,TCP,ALLOW,Mozilla/5.0 (Windows NT 10.0; Win64; x64) TOR/Browser`;
    }

    const sampleFile = new File([sampleContent], fileName, { type: 'text/csv' });
    setSelectedFile(sampleFile);
    setResponseType(type);
    handleProcessFile(type, null, sampleFile);
  };

  // Helper to infer category from inbound email reply
  const inferTypeFromReply = (r: any): 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS' => {
    const c = (r.classification || r.subject || r.body_text || '').toUpperCase();
    if (c.includes('CDR') || c.includes('TELECOM') || c.includes('CALL')) return 'CDR';
    if (c.includes('IP') || c.includes('LOG') || c.includes('CYBER') || c.includes('LERT')) return 'IP_LOGS';
    return 'BANK_STATEMENT';
  };

  const [isIssuingDirective, setIsIssuingDirective] = useState(false);

  // 1-Click Dispatch Discovered Layer-2 Mule Directive to Module 4
  const handleIssueDiscoveredDirective = () => {
    if (!parsedData || !parsedData.discovered_mule_account) return;
    setIsIssuingDirective(true);
    try {
      const mule = parsedData.discovered_mule_account;
      const newDir = {
        id: `DIR-M5-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        target_provider: mule.bank || 'Secondary Beneficiary Bank',
        receiver_email: `nodal@${(mule.bank || 'bank').toLowerCase().replace(/\s+/g, '')}.com`,
        objective: `Section 106 BNSS Debit Freeze Order for Discovered Layer-2 Account ${mule.account_number}`,
        target_id: mule.account_number,
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 106 BNSS'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`⚡ Issued Section 106 BNSS Debit Freeze Directive for Layer-2 A/C ${mule.account_number} to Module 4!`);
    } finally {
      setTimeout(() => setIsIssuingDirective(false), 600);
    }
  };

  // Generate / Open Section 63 BSA Electronic Evidence Certificate
  const handleOpenCertificateModal = async () => {
    if (certData) {
      setCertModalOpen(true);
      return;
    }

    setIsGeneratingCert(true);
    try {
      const res = await api.post('/api/analytics/generate-certificate', {
        case_number: currentCaseNo,
        evidence_type: parsedData?.response_type || responseType,
        file_name: selectedFile?.name || `${responseType.toLowerCase()}_response_${currentCaseNo}.csv`,
        summary_findings: parsedData?.executive_summary || ''
      });
      setCertData(res.data);
      setCertModalOpen(true);
    } catch (err: any) {
      console.warn('Certificate generation fallback:', err);
    } finally {
      setIsGeneratingCert(false);
    }
  };

  const handleDownloadCertificate = () => {
    if (!certData) return;
    const blob = new Blob([certData.certificate_full_text || JSON.stringify(certData, null, 2)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Section63_BSA_Certificate_${currentCaseNo.replace('/', '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMsg(`Downloaded Section 63 BSA Certificate for Case ${currentCaseNo}!`);
  };

  // Compute active visual config based on AI recommended or user override
  const getActiveVisualConfig = (): VisualizationConfig | null => {
    if (!parsedData || !parsedData.visualization_config) return null;
    const baseConfig = parsedData.visualization_config;
    if (selectedChartType === 'AUTO') {
      return baseConfig;
    }
    return {
      ...baseConfig,
      recommended_chart_type: selectedChartType as any
    };
  };

  const activeVisualConfig = getActiveVisualConfig();

  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto gap-3.5 select-none bg-[#F8FAFC] dark:bg-[#050811] min-h-0">

      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-black tracking-wide text-slate-900 dark:text-white uppercase font-mono flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#0A2540] dark:text-indigo-400" />
            {t('analytics.title', 'Forensic Response Analytics & Evidence Intelligence Studio')}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
            {t('analytics.subtitle', 'Parses real authority responses (Bank Ledgers, Telecom CDRs, IP Artifacts) and generates court-admissible visual intelligence.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-blue-500/20 transition-colors shadow-sm font-mono"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>AI Module Summary</span>
          </button>

          {parsedData && (
            <button
              onClick={handleOpenCertificateModal}
              disabled={isGeneratingCert}
              className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm font-mono"
            >
              {isGeneratingCert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
              <span>Sec 63 BSA Certificate</span>
            </button>
          )}

          <button
            onClick={() => {
              clearModule5EmailData();
              setParsedData(null);
              setCertData(null);
              setToastMsg('Purged all Module 5 email requests, responses, and cached analytics data!');
            }}
            className="flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors shadow-sm font-mono"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>Reset Module 5</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0 font-mono shadow-sm">
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Inbound Module 4 Email Replies Quick-Select Bar */}
      {caseReplies.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-2.5 flex items-center justify-between shrink-0 font-mono text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-slate-800 dark:text-slate-200 font-bold">Module 4 Ingested Inbound Email Responses ({caseReplies.length}):</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {caseReplies.map((r: any, idx: number) => {
              const inferredType = inferTypeFromReply(r);
              return (
                <button
                  key={r.id || idx}
                  onClick={() => {
                    setResponseType(inferredType);
                    handleProcessFile(inferredType, r);
                  }}
                  className="px-2.5 py-1 rounded bg-white dark:bg-[#0d1322] border border-amber-300 dark:border-white/10 hover:border-amber-500 text-[11px] text-amber-900 dark:text-amber-300 font-bold flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
                >
                  <span>#{idx + 1} {r.sender_email?.split('@')[0]}</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">({r.classification || inferredType})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drag and Drop File Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
          isDragging
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30'
            : 'border-slate-300 dark:border-white/15 bg-white dark:bg-[#0d1322] hover:border-indigo-400 dark:hover:border-indigo-500/50'
        } shadow-sm font-mono`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".csv,.xlsx,.xls,.txt,.pdf"
          className="hidden"
        />
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <UploadCloud className="h-5 w-5" />
          </div>
          <div className="text-left flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{selectedFile ? `Selected: ${selectedFile.name}` : 'Drag & Drop Provider Response File (CSV, Excel XLSX, PDF)'}</span>
              {selectedFile && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">READY</span>}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Supports real HDFC/SBI Bank Statements, Jio/Airtel Telecom CDR dumps, and Cyber IP connection logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5 w-full justify-between mt-2 flex-wrap">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Or Load Sample Evidence Data:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleLoadSampleFile('BANK_STATEMENT'); }}
              className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-500/20 flex items-center gap-1 transition-colors"
            >
              <CreditCard className="h-3 w-3" />
              <span>Sample Bank Ledger</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleLoadSampleFile('CDR'); }}
              className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 text-blue-800 dark:text-blue-300 text-[10px] font-bold border border-blue-300 dark:border-blue-500/20 flex items-center gap-1 transition-colors"
            >
              <PhoneCall className="h-3 w-3" />
              <span>Sample Telecom CDR</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleLoadSampleFile('IP_LOGS'); }}
              className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 text-indigo-800 dark:text-indigo-300 text-[10px] font-bold border border-indigo-300 dark:border-indigo-500/20 flex items-center gap-1 transition-colors"
            >
              <Globe className="h-3 w-3" />
              <span>Sample Cyber IP Logs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Case Banner & Category Selector */}
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-2.5 flex items-center justify-between shrink-0 gap-3 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase font-mono flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Case: <span className="text-amber-700 dark:text-amber-300 font-extrabold">{currentCaseNo}</span> | Category:
          </span>

          <button
            onClick={() => setResponseType('BANK_STATEMENT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              responseType === 'BANK_STATEMENT'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-[#050811] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Bank Statement</span>
          </button>

          <button
            onClick={() => setResponseType('CDR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              responseType === 'CDR'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-[#050811] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Telecom CDR Dump</span>
          </button>

          <button
            onClick={() => setResponseType('IP_LOGS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              responseType === 'IP_LOGS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-[#050811] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Cyber IP Logs</span>
          </button>
        </div>

        <button
          onClick={() => handleProcessFile()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 shadow-md shrink-0 font-mono"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          <span>{loading ? 'Analyzing Payload...' : 'Analyze Response File'}</span>
        </button>
      </div>

      {/* Visual Plot Selection Banner & Interactive Switcher */}
      {parsedData && parsedData.total_records > 0 && parsedData.status === 'success' && (
        <div className="rounded-xl border border-purple-300 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 p-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-300 animate-pulse" />
            <div>
              <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase font-mono tracking-wider">
                Automated Evidence Plot: <strong className="text-emerald-800 dark:text-emerald-300 font-extrabold">{parsedData.visualization_config?.recommended_chart_type}</strong>
              </span>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono">
                {parsedData.visualization_config?.chart_insights || 'Optimal visual representation generated based on pattern structure.'}
              </p>
            </div>
          </div>

          {/* Manual Plot Switcher */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#050811] p-1 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">
            <button
              onClick={() => setSelectedChartType('AUTO')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                selectedChartType === 'AUTO'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Optimal</span>
            </button>
            <button
              onClick={() => setSelectedChartType('MONEY_TRAIL_FLOW')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                selectedChartType === 'MONEY_TRAIL_FLOW'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              <span>Money Flow</span>
            </button>
            <button
              onClick={() => setSelectedChartType('HOURLY_ACTIVITY_BAR')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                selectedChartType === 'HOURLY_ACTIVITY_BAR'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              <span>Hourly Histogram</span>
            </button>
            <button
              onClick={() => setSelectedChartType('LINE_TREND')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all flex items-center gap-1 ${
                selectedChartType === 'LINE_TREND'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity className="h-3 w-3" />
              <span>Time Trend</span>
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Visualizer Canvas */}
      {parsedData && parsedData.total_records > 0 && parsedData.status === 'success' && (
        <div className="shrink-0 font-mono">
          <DynamicVisualizer config={activeVisualConfig} />
        </div>
      )}

      {/* Main Analytics Workspace Grid */}
      {parsedData && parsedData.total_records > 0 && parsedData.status === 'success' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 shrink-0 min-h-0 pb-4">

          {/* Grid 1: Fraud Signature Audit & Discovered Mule Directive Action */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Detected Signature Audit ({currentCaseNo})
              </span>
              <span className="text-[10px] bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-mono font-bold border border-rose-300 dark:border-rose-500/30">
                CONFIDENCE: {parsedData.fraud_confidence_score || 96}%
              </span>
            </span>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-white/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Pattern Signature:</span>
                <span className="font-bold text-amber-800 dark:text-amber-300">{parsedData.detected_fraud_pattern || 'PATTERN_DETECTED'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Records Evaluated:</span>
                <span className="font-bold text-slate-900 dark:text-white">{parsedData.total_records} records</span>
              </div>
              {parsedData.total_volume_inr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Total Money Volume:</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-400">{parsedData.total_volume_inr}</span>
                </div>
              )}
              {parsedData.night_calls_count !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Midnight Anomaly Cluster:</span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">{parsedData.night_calls_count} calls</span>
                </div>
              )}
            </div>

            {/* Discovered Layer-2 Mule Account Direct Action */}
            {parsedData.discovered_mule_account && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/30 text-xs font-mono space-y-2.5">
                <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Link className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Newly Discovered Layer-2 Mule Account:
                  </span>
                  <span className="bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded font-mono text-emerald-950 dark:text-emerald-200">
                    {parsedData.discovered_mule_account.account_number}
                  </span>
                </div>
                <button
                  onClick={handleIssueDiscoveredDirective}
                  disabled={isIssuingDirective}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-50"
                >
                  {isIssuingDirective ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>{isIssuingDirective ? 'Issuing Freeze Order to Module 4...' : 'Issue Section 106 BNSS Freeze Directive in Module 4'}</span>
                </button>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200 font-mono">
              <strong>Statutory Directive Recommendation:</strong> {parsedData.recommended_next_action}
            </div>
          </div>

          {/* Grid 2: Primary Entity Breakdown */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-2 shadow-sm min-h-[260px]">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-1.5 shrink-0 font-mono">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Primary Entity Breakdown ({parsedData.response_type})
            </span>

            <div className="overflow-y-auto mt-1 max-h-64 rounded-lg border border-slate-200 dark:border-white/5 font-mono">
              <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300">
                <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#050811] text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-2.5">Entity / Counterparty</th>
                    <th className="py-2 px-2.5">Hits / Count</th>
                    <th className="py-2 px-2.5">Volume / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-mono">
                  {/* Bank Counterparties */}
                  {parsedData.top_counterparties?.map((cp: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2.5 font-bold text-emerald-800 dark:text-emerald-300">{cp.party}</td>
                      <td className="py-2 px-2.5 text-slate-900 dark:text-white">{cp.count} txns</td>
                      <td className="py-2 px-2.5 text-amber-800 dark:text-amber-300 font-bold">{cp.amount}</td>
                    </tr>
                  ))}

                  {/* IP Addresses */}
                  {parsedData.top_ip_addresses?.map((ip: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2.5 font-bold text-indigo-800 dark:text-indigo-300">{ip.ip}</td>
                      <td className="py-2 px-2.5 text-slate-900 dark:text-white">{ip.connections} conns</td>
                      <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400">{ip.isp}</td>
                    </tr>
                  ))}

                  {/* CDR Phone Numbers */}
                  {parsedData.top_b_parties?.map((b: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2.5 font-bold text-blue-800 dark:text-blue-300">{b.phone}</td>
                      <td className="py-2 px-2.5 text-slate-900 dark:text-white">{b.call_count} calls</td>
                      <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400">{b.total_duration_min} mins</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid 3: Cell Towers / Handset IMEIs */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-2 shadow-sm min-h-[260px]">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-1.5 shrink-0 font-mono">
              <MapPin className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Location & Hardware Device Metadata
            </span>

            <div className="overflow-y-auto space-y-2 max-h-64 pr-1">
              {parsedData.top_tower_locations?.map((tw: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 font-mono">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{tw.location_name}</span>
                    <span className="text-[10px] text-slate-500">{tw.tower_id}</span>
                  </div>
                  <span className="rounded bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 px-2.5 py-0.5 text-[10px] font-bold">
                    {tw.frequency} cell hits
                  </span>
                </div>
              ))}

              {parsedData.imei_history?.map((imei: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 font-mono">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">IMEI: {imei}</span>
                  <span className="rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                    Handset #{idx + 1}
                  </span>
                </div>
              ))}

              {(!parsedData.top_tower_locations?.length && !parsedData.imei_history?.length) && (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
                  No Location or Hardware Device Metadata in Payload
                </div>
              )}
            </div>
          </div>

          {/* Grid 4: Forensic Narrative Summary */}
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-2 shadow-sm min-h-[260px]">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center gap-1.5 shrink-0 font-mono">
              <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Forensic Intelligence Narrative
            </span>

            <div className="overflow-y-auto p-3.5 rounded-lg border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#050811] text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed max-h-64 shadow-inner">
              {parsedData.executive_summary}
            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] flex flex-col items-center justify-center text-slate-500 space-y-3 p-8 text-center shadow-sm font-mono">
          <Cpu className="h-12 w-12 text-purple-600 dark:text-indigo-400 opacity-80 animate-bounce" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Forensic Response Analytics Studio ({currentCaseNo})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
            Drag & drop a response file above or select a category (<strong className="text-emerald-600 dark:text-emerald-400">Bank Statement</strong>, <strong className="text-blue-600 dark:text-blue-400">Telecom CDR</strong>, or <strong className="text-indigo-600 dark:text-indigo-400">Cyber IP Logs</strong>) and click <strong className="text-purple-600 dark:text-purple-400">"Analyze Response File"</strong>!
          </p>
        </div>
      )}

      {/* Section 63 BSA Electronic Evidence Certificate Modal */}
      {certModalOpen && certData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn font-mono">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/15 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Section 63 BSA Electronic Evidence Certificate
                </h3>
              </div>
              <button
                onClick={() => setCertModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Certificate Reference:</span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300">{certData.certificate_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">SHA-256 Checksum:</span>
                <span className="font-bold text-slate-900 dark:text-white text-[10px] break-all">{certData.sha256_hash}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Timestamp (IST):</span>
                <span className="font-bold text-slate-900 dark:text-white">{certData.timestamp_ist}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 rounded-lg bg-slate-900 text-slate-100 text-[11px] leading-relaxed whitespace-pre-wrap border border-slate-800 shadow-inner font-mono max-h-72 select-text">
              {certData.certificate_full_text}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={() => setCertModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDownloadCertificate}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
              >
                <Download className="h-4 w-4" />
                <span>Download Section 63 Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module 5 AI Executive Summarizer Modal */}
      <ModuleSummarizerModal
        isOpen={summarizerOpen}
        onClose={() => setSummarizerOpen(false)}
        moduleId="MODULE_5"
        moduleTitle="Forensic Response Analytics & Evidence Studio"
      />
    </div>
  );
}
