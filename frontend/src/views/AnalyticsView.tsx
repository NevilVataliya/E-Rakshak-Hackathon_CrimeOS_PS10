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
  AlertCircle,
  Camera,
  Building,
  Radio,
  Clock,
  Wifi,
  ExternalLink,
  Navigation,
  Copy,
  Map
} from 'lucide-react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import ModuleSummarizerModal from '../components/common/ModuleSummarizerModal';
import TranslatedText from '../components/common/TranslatedText';
import { useCaseStore } from '../store/caseStore';
import DynamicVisualizer, { VisualizationConfig } from '../components/common/DynamicVisualizer';

export default function AnalyticsView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    activeCase,
    setSelectedInspectorItem,
    addTimelineEvent,
    responseAnalyticsByCase,
    responseAnalyticsHistoryByCase,
    responseAnalyticsByTypeByCase,
    saveResponseAnalyticsForCase,
    processedRepliesByCase,
    addDirectiveForCase,
    clearModule5EmailData
  } = useCaseStore();

  const [loading, setLoading] = useState(false);
  const [responseType, setResponseType] = useState<'BANK_STATEMENT' | 'CDR' | 'IP_LOGS'>('BANK_STATEMENT');
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showUploadDropzone, setShowUploadDropzone] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<string>('AUTO');
  const [toastMsg, setToastMsg] = useState('');
  const [summarizerOpen, setSummarizerOpen] = useState(false);

  // Section 63 BSA Certificate Modal State
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [certData, setCertData] = useState<any>(null);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  // Cell Tower GPS Map Modal State
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedMapTower, setSelectedMapTower] = useState<any>(null);

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const currentCaseNo = activeCase?.case_number || 'CR-2026-9914';
  const caseReplies = processedRepliesByCase[currentCaseNo] || [];
  const caseHistory = responseAnalyticsHistoryByCase[currentCaseNo] || activeCase?.response_analytics_history || [];
  const caseByType = responseAnalyticsByTypeByCase[currentCaseNo] || activeCase?.response_analytics_by_type || {};

  // Load persistent response analytics and handle document selection
  useEffect(() => {
    if (activeCase?.case_number) {
      const historyList = responseAnalyticsHistoryByCase[activeCase.case_number] || activeCase.response_analytics_history || [];
      const byTypeList = responseAnalyticsByTypeByCase[activeCase.case_number] || activeCase.response_analytics_by_type || {};
      const singleFallback = responseAnalyticsByCase[activeCase.case_number] || activeCase.response_analytics;

      let docToDisplay: any = null;
      if (selectedDocId) {
        docToDisplay = historyList.find((d: any) => (d.doc_id && d.doc_id === selectedDocId) || (d.file_name && d.file_name === selectedDocId));
      }

      if (!docToDisplay) {
        const catDocs = byTypeList[responseType] || historyList.filter((d: any) => (d.response_type || d.category) === responseType);
        if (catDocs && catDocs.length > 0) {
          docToDisplay = catDocs[0];
        } else if (historyList.length > 0) {
          docToDisplay = historyList[0];
          setResponseType(docToDisplay.response_type || docToDisplay.category || 'BANK_STATEMENT');
        } else if (singleFallback && singleFallback.total_records > 0) {
          docToDisplay = singleFallback;
          setResponseType(singleFallback.response_type || singleFallback.category || 'BANK_STATEMENT');
        }
      }

      if (docToDisplay) {
        setSelectedDocId(docToDisplay.doc_id || docToDisplay.file_name);
        setParsedData(docToDisplay);
        if (docToDisplay.section_63_certificate) {
          setCertData(docToDisplay.section_63_certificate);
        }
        setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: docToDisplay });
      } else {
        setParsedData(null);
        setCertData(null);
      }
    } else {
      setParsedData(null);
      setCertData(null);
    }
  }, [activeCase?.case_number, responseAnalyticsHistoryByCase, responseAnalyticsByTypeByCase, responseAnalyticsByCase]);

  // Switch category and select its corresponding document
  const handleSelectCategory = (cat: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS') => {
    setResponseType(cat);
    const docsInCat = (caseByType[cat] || caseHistory.filter((d: any) => (d.response_type || d.category) === cat)) || [];
    if (docsInCat.length > 0) {
      const targetDoc = docsInCat[0];
      setSelectedDocId(targetDoc.doc_id || targetDoc.file_name);
      setParsedData(targetDoc);
      setCertData(targetDoc.section_63_certificate || null);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: targetDoc });
    } else {
      setSelectedDocId(null);
      setParsedData(null);
      setCertData(null);
      setShowUploadDropzone(true);
    }
  };

  // Switch to specific analyzed document
  const handleSelectDocument = (doc: any) => {
    if (!doc) return;
    const cat = (doc.response_type || doc.category || responseType) as 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS';
    setResponseType(cat);
    setSelectedDocId(doc.doc_id || doc.file_name);
    setParsedData(doc);
    setCertData(doc.section_63_certificate || null);
    setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: doc });
  };

  // Parse & Ingest Provider File via API or Real Upload
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
        setToastMsg('Please drag and drop or upload a response file (CSV, Excel XLSX, or PDF) to perform forensic analysis.');
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

      analyticsPayload.category = targetType;
      analyticsPayload.doc_id = analyticsPayload.doc_id || `DOC-${Date.now().toString().slice(-6)}`;
      analyticsPayload.file_name = analyticsPayload.provider_name || activeFile?.name || `${targetType}_Doc`;

      setParsedData(analyticsPayload);
      setSelectedDocId(analyticsPayload.doc_id);
      setShowUploadDropzone(false);

      if (analyticsPayload.section_63_certificate) {
        setCertData(analyticsPayload.section_63_certificate);
      }

      saveResponseAnalyticsForCase(caseRef, analyticsPayload, targetType);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: analyticsPayload });

      addTimelineEvent({
        module: 'MODULE_5_ANALYTICS',
        stage: 'ANALYTICS_PARSED',
        step_title: `Ingested ${targetType} Evidence (${caseRef})`,
        details: analyticsPayload.executive_summary || `Parsed ${targetType} evidence. Action: ${analyticsPayload.recommended_next_action}`,
        timestamp: new Date().toISOString(),
        status: 'VERIFIED'
      });

      setToastMsg(`Successfully analyzed ${targetType} evidence [${analyticsPayload.file_name}] for Case ${caseRef}. Saved to dossier.`);
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

  // Sample File Loader for Instant Verification
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
      sampleContent = `Txn_Date,Value_Date,Description,Debit_Amount,Credit_Amount,Balance,Transaction_Type\n2026-07-15,2026-07-15,RTGS INFLOW FROM COMPLAINANT,0.00,${lossAmt},${lossAmt},RTGS\n2026-07-15,2026-07-15,IMPS TFR TO ${targetAcct} SUSPECT MULE,${Math.round(lossAmt * 0.85)},0.00,${Math.round(lossAmt * 0.15)},IMPS\n2026-07-16,2026-07-16,IMPS TFR TO ${secondaryMule} LAYER2 MULE,${Math.round(lossAmt * 0.60)},0.00,${Math.round(lossAmt * 0.05)},IMPS\n2026-07-16,2026-07-16,ATM-WDL/SURAT RING ROAD BRANCH/ATM8841,${Math.round(lossAmt * 0.05)},0.00,0.00,ATM`;
    } else if (type === 'CDR') {
      fileName = `telecom_cdr_${caseRef.replace('/', '_')}.csv`;
      const primaryPhone = activeCase?.entities?.phone_numbers?.[0] || '+919876543210';
      sampleContent = `Call_Date,Call_Time,Calling_Party,Called_Party,Call_Type,Duration_Sec,Tower_ID,Cell_Site_Address,IMEI\n2026-07-01,00:14:22,${primaryPhone},+919825011223,OUTGOING,180,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,01:04:33,+919825011223,${primaryPhone},INCOMING,45,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,02:18:05,${primaryPhone},+919879044551,OUTGOING,210,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,03:45:12,+919426099881,${primaryPhone},INCOMING,320,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,08:30:00,${primaryPhone},+919825011223,OUTGOING,90,AHM-SAT-TW-09,Satellite ISRO Junction,864910049201923\n2026-07-01,14:20:10,+919879044551,${primaryPhone},INCOMING,600,AHM-CG-TW-42,CG Road Municipal Market,864910049201923\n2026-07-01,22:10:15,+919825011223,${primaryPhone},INCOMING,110,AHM-CG-TW-42,CG Road Municipal Market,864910049201999`;
    } else {
      fileName = `google_lert_disclosure_${caseRef.replace('/', '_')}.csv`;
      sampleContent = `Timestamp (UTC),IP Address,Source Port,Event / Action,User Agent\n2026-07-20 01:14:22,103.211.55.195,54321,Account Login Successful,Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/123.0\n2026-07-20 01:18:05,103.211.55.195,54322,Recovery Mobile Modified,Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/123.0\n2026-07-20 02:45:12,185.220.101.4,44300,Password Reset Attempt (TOR Exit),Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0\n2026-07-20 03:10:00,49.36.12.88,61234,2-Step Verification Completed,Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15\n2026-07-20 03:40:55,2409:4053:2e80:11aa::1,50012,Session Terminated,Mozilla/5.0 (Linux; Android 13; OnePlus CPH2413)`;
    }

    const sampleFile = new File([sampleContent], fileName, { type: 'text/csv' });
    setSelectedFile(sampleFile);
    setResponseType(type);
    handleProcessFile(type, null, sampleFile);
  };

  // Inbound Email Helper
  const inferTypeFromReply = (r: any): 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS' => {
    const c = (r.classification || r.subject || r.body_text || '').toUpperCase();
    if (c.includes('CDR') || c.includes('TELECOM') || c.includes('CALL')) return 'CDR';
    if (c.includes('IP') || c.includes('LOG') || c.includes('CYBER') || c.includes('LERT')) return 'IP_LOGS';
    return 'BANK_STATEMENT';
  };

  const [isIssuingDirective, setIsIssuingDirective] = useState(false);

  // 1-Click Dispatch Discovered Layer-2 Mule Freeze Directive to Module 4
  const handleIssueDiscoveredDirective = (mule: any) => {
    if (!mule) return;
    setIsIssuingDirective(true);
    try {
      const newDir = {
        id: `DIR-M5-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        title: `Debit Freeze: ${mule.bank || 'Bank'} (${mule.account_number})`,
        target_provider: mule.bank || 'Secondary Beneficiary Bank',
        receiver_email: `nodal@${(mule.bank || 'bank').toLowerCase().replace(/\s+/g, '')}.com`,
        objective: `Section 106 BNSS Debit Freeze Directive for Discovered Layer-2 Account ${mule.account_number}`,
        target_id: mule.account_number,
        domain: 'financial_fraud',
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 106 BNSS'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`Queued Section 106 BNSS Debit Freeze Directive for Layer-2 Account ${mule.account_number} into Module 4 Drafts.`);
    } finally {
      setTimeout(() => setIsIssuingDirective(false), 600);
    }
  };

  // 1-Click Dispatch ATM Kiosk CCTV Subpoena Directive to Module 4
  const handleIssueAtmCctvSubpoena = (lead: any) => {
    if (!lead) return;
    try {
      const newDir = {
        id: `DIR-CCTV-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        title: `ATM CCTV Subpoena: ${lead.atm_location}`,
        target_provider: 'Bank ATM Nodal Compliance Unit',
        receiver_email: 'atm.compliance@bank.in',
        objective: `Section 94 BNSS Notice for ATM Kiosk CCTV Footage (${lead.atm_location}) on ${lead.date}`,
        target_id: lead.atm_location,
        domain: 'physical_homicide',
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 94 BNSS'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`Queued Section 94 BNSS ATM CCTV Subpoena for ${lead.atm_location} into Module 4 Drafts.`);
    } catch (err: any) {
      console.warn('Error issuing CCTV subpoena:', err);
    }
  };

  // 1-Click Dispatch ISP Subscriber Notice Directive to Module 4
  const handleIssueIspNotice = (ispLead: any) => {
    if (!ispLead) return;
    try {
      const portText = ispLead.source_port && ispLead.source_port !== 'Unspecified' && ispLead.source_port !== 'N/A' ? ` on Source Port ${ispLead.source_port}` : '';
      const targetIp = ispLead.ip || ispLead.vowifi_ip;
      const targetIsp = ispLead.isp_name || 'Internet Service Provider';
      const targetEmail = ispLead.nodal_email || 'nodal.broadband@isp.in';
      const targetTs = ispLead.ist_timestamp || ispLead.timestamp || 'Recorded Event';

      const newDir = {
        id: `DIR-ISP-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        title: `ISP Notice: ${targetIsp} (${targetIp})`,
        target_provider: targetIsp,
        receiver_email: targetEmail,
        objective: `Section 94 BNSS Notice for Subscriber Details on IP ${targetIp}${portText} at timestamp ${targetTs}`,
        target_id: targetIp,
        domain: 'cyber_crime',
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 94 BNSS / CGNAT Allocation Protocol'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`Queued Section 94 BNSS Notice for IP ${targetIp} into Module 4 Drafts.`);
    } catch (err: any) {
      console.warn('Error issuing ISP notice:', err);
    }
  };

  // 1-Click Dispatch Proxy / VPN Subpoena Directive to Module 4
  const handleIssueProxySubpoena = (tip: any) => {
    if (!tip) return;
    try {
      const newDir = {
        id: `DIR-VPN-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        title: `Proxy Subpoena: ${tip.isp} (${tip.ip})`,
        target_provider: tip.isp || 'Anonymizer / Cloud Provider',
        receiver_email: tip.nodal_email || 'abuse@datacenter.net',
        objective: `Section 94 BNSS / US CLOUD Act Subpoena to Unmask Real Origin IP behind Gateway ${tip.ip}`,
        target_id: tip.ip,
        domain: 'cyber_crime',
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 94 BNSS / MLAT Protocol'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`Queued Proxy Subpoena Directive for ${tip.ip} into Module 4 Drafts.`);
    } catch (err: any) {
      console.warn('Error issuing proxy subpoena:', err);
    }
  };

  // 1-Click Dispatch CEIR Handset Subpoena Directive to Module 4
  const handleIssueCeirSubpoena = (swap: any) => {
    if (!swap) return;
    try {
      const newDir = {
        id: `DIR-CEIR-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        title: `CEIR Subpoena: Handset IMEI ${swap.imei}`,
        target_provider: 'DoT CEIR Portal / Telecom Compliance Desk',
        receiver_email: 'nodal.ceir@dot.gov.in',
        objective: `CEIR Handset Trace & Section 94 BNSS Subpoena for IMEI ${swap.imei}`,
        target_id: swap.imei,
        domain: 'telecom_location',
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 94 BNSS / CEIR Protocol'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`Queued CEIR Handset Trace Subpoena for IMEI ${swap.imei} into Module 4 Drafts.`);
    } catch (err: any) {
      console.warn('Error issuing CEIR subpoena:', err);
    }
  };

  // 1-Click Dispatch Section 94 BNSS Notice for Frequent Contact B-Party to Module 4
  const handleIssueBPartyNotice = (bParty: any) => {
    if (!bParty) return;
    try {
      const newDir = {
        id: `DIR-TEL-${Date.now().toString().slice(-4)}`,
        case_number: currentCaseNo,
        title: `Accomplice Notice: Phone ${bParty.party}`,
        target_provider: 'Telecom Nodal Officer',
        receiver_email: 'nodal.telecom@service.in',
        objective: `Section 94 BNSS Notice for CAF and Location History of Frequent Accomplice ${bParty.party}`,
        target_id: bParty.party,
        domain: 'telecom_location',
        status: 'READY_TO_DISPATCH',
        legal_statute_ref: 'Section 94 BNSS'
      };
      addDirectiveForCase(currentCaseNo, newDir);
      setToastMsg(`Queued Section 94 BNSS Notice for Accomplice ${bParty.party} into Module 4 Drafts.`);
    } catch (err: any) {
      console.warn('Error issuing B-Party notice:', err);
    }
  };

  // Open Section 63 BSA Certificate Modal
  const handleOpenCertificateModal = async () => {
    if (!parsedData) return;
    if (parsedData.section_63_certificate) {
      setCertData(parsedData.section_63_certificate);
      setCertModalOpen(true);
      return;
    }
    setIsGeneratingCert(true);
    try {
      const res = await api.post('/api/analytics/generate-certificate', {
        case_number: currentCaseNo,
        evidence_type: responseType,
        file_name: selectedFile?.name || `${responseType.toLowerCase()}_compliance_evidence.csv`,
        file_content: JSON.stringify(parsedData),
        officer_name: 'PSI Inspector V. K. Patel',
        police_station: 'Surat Cyber Crime Police Station, Gujarat',
        summary_findings: parsedData.executive_summary || ''
      });
      setCertData(res.data);
      setCertModalOpen(true);
    } catch (err) {
      console.warn('Error generating certificate:', err);
      setToastMsg('Failed to generate Section 63 BSA certificate.');
    } finally {
      setIsGeneratingCert(false);
    }
  };

  // Handle Dynamic Chart Visualization Configuration
  const activeVisualConfig: VisualizationConfig | null = parsedData?.visualization_config ? {
    recommended_chart_type: selectedChartType === 'AUTO'
      ? (parsedData.visualization_config?.recommended_chart_type || 'MONEY_TRAIL_FLOW')
      : selectedChartType,
    chart_title: parsedData.visualization_config?.chart_title || `Forensic Response Visual Flow (${currentCaseNo})`,
    chart_insights: parsedData.visualization_config?.chart_insights || 'Forensic structure computed from evidence record.',
    chart_data: parsedData.visualization_config?.chart_data || [],
    x_axis_key: parsedData.visualization_config?.x_axis_key || 'timestamp',
    y_axis_key: parsedData.visualization_config?.y_axis_key || 'connections',
    data_grounded: true
  } : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-7xl mx-auto h-full flex flex-col font-sans">
      {/* Top Action & Navigation Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              {t('analytics.title')}
            </h1>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {t('analytics.sec_63_bsa')}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono mt-0.5">
            {t('analytics.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-blue-500/20 transition-colors shadow-sm font-mono"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{t('analytics.ai_module_summary')}</span>
          </button>

          {parsedData && (
            <button
              onClick={handleOpenCertificateModal}
              disabled={isGeneratingCert}
              className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm font-mono"
            >
              {isGeneratingCert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
              <span>{t('analytics.sec_63_cert')}</span>
            </button>
          )}

          <button
            onClick={() => {
              clearModule5EmailData();
              setParsedData(null);
              setCertData(null);
              setToastMsg('Reset Module 5 analytics and cached provider data.');
            }}
            className="flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors shadow-sm font-mono"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>{t('analytics.reset_module')}</span>
          </button>
        </div>
      </div>

      {/* Toast Feedback Banner with 1-Click Module 4 Review Navigation */}
      {toastMsg && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0 font-mono shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span><TranslatedText text={toastMsg} /></span>
          </div>
          {toastMsg.includes('Module 4 Drafts') && (
            <button
              onClick={() => navigate('/directives')}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <span>Review in Module 4</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Inbound Module 4 Email Replies Quick-Select Bar */}
      {caseReplies.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-2.5 flex items-center justify-between shrink-0 font-mono text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-slate-800 dark:text-slate-200 font-bold">{t('analytics.inbound_replies')} ({caseReplies.length}):</span>
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

      {/* Ingested Evidence Documents History Switcher */}
      {caseHistory && caseHistory.length > 0 && (
        <div className="rounded-xl border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 flex flex-col space-y-2 shrink-0 shadow-sm font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {t('analytics.ingested_docs')} ({caseHistory.length}):
            </span>
            <button
              onClick={() => setShowUploadDropzone(!showUploadDropzone)}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{showUploadDropzone ? t('analytics.hide_dropzone') : t('analytics.ingest_another')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {caseHistory.map((doc: any, idx: number) => {
              const isSelected = selectedDocId === (doc.doc_id || doc.file_name);
              const cat = doc.response_type || doc.category || 'BANK_STATEMENT';
              return (
                <button
                  key={doc.doc_id || idx}
                  onClick={() => handleSelectDocument(doc)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/40'
                      : 'bg-white dark:bg-[#0d1322] border-slate-300 dark:border-white/10 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                  }`}
                >
                  {cat === 'BANK_STATEMENT' && <CreditCard className="h-3.5 w-3.5 shrink-0" />}
                  {cat === 'CDR' && <PhoneCall className="h-3.5 w-3.5 shrink-0" />}
                  {cat === 'IP_LOGS' && <Globe className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate max-w-[200px]">{doc.file_name || `${cat} Doc`}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {doc.total_volume_inr ? doc.total_volume_inr : `${doc.total_records} recs`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drag and Drop File Upload Dropzone (Collapsible when files exist) */}
      {(!parsedData || showUploadDropzone || caseHistory.length === 0) && (
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
                <span>{selectedFile ? `Selected: ${selectedFile.name}` : `Upload New ${responseType === 'BANK_STATEMENT' ? 'Bank Statement' : (responseType === 'CDR' ? 'Telecom CDR' : 'IP Logs')} Evidence (PDF, CSV, XLSX)`}</span>
                {selectedFile && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">READY</span>}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Supports real HDFC/SBI/IDFC Bank Statements, Jio/Airtel Telecom CDR dumps, and Cyber IP connection logs.
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
      )}

      {/* Active Case Banner & Category Selector */}
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-2.5 flex items-center justify-between shrink-0 gap-3 shadow-sm font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            Case: <span className="text-amber-700 dark:text-amber-300 font-extrabold">{currentCaseNo}</span> | Category:
          </span>

          <button
            onClick={() => handleSelectCategory('BANK_STATEMENT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              responseType === 'BANK_STATEMENT'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-[#050811] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{t('analytics.tab_bank')}</span>
            {caseByType['BANK_STATEMENT']?.length > 0 && (
              <span className="text-[10px] bg-emerald-800 text-emerald-100 px-1.5 py-0.2 rounded-full">
                {caseByType['BANK_STATEMENT'].length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSelectCategory('CDR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              responseType === 'CDR'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-[#050811] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>{t('analytics.tab_cdr')}</span>
            {caseByType['CDR']?.length > 0 && (
              <span className="text-[10px] bg-blue-800 text-blue-100 px-1.5 py-0.2 rounded-full">
                {caseByType['CDR'].length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleSelectCategory('IP_LOGS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              responseType === 'IP_LOGS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-[#050811] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{t('analytics.tab_ip')}</span>
            {caseByType['IP_LOGS']?.length > 0 && (
              <span className="text-[10px] bg-indigo-800 text-indigo-100 px-1.5 py-0.2 rounded-full">
                {caseByType['IP_LOGS'].length}
              </span>
            )}
          </button>
        </div>

        <button
          onClick={() => handleProcessFile()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 shadow-md shrink-0 font-mono"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          <span>{loading ? t('analytics.analyzing') : t('analytics.btn_analyze')}</span>
        </button>
      </div>

      {/* Visual Plot Selection Banner & Switcher */}
      {parsedData && parsedData.total_records > 0 && parsedData.status === 'success' && (
        <div className="rounded-xl border border-purple-300 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 p-3 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-300 animate-pulse" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase font-mono tracking-wider">
                  Automated Evidence Plot: <strong className="text-emerald-800 dark:text-emerald-300 font-extrabold">{parsedData.visualization_config?.recommended_chart_type}</strong>
                </span>
                {parsedData.file_name && (
                  <span className="text-[10px] bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                    DOC: {parsedData.file_name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                {parsedData.visualization_config?.chart_insights || 'Optimal visual representation generated based on pattern structure.'}
              </p>
            </div>
          </div>

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

          {/* Grid 1: Fraud Signature Audit */}
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
                  <span className="text-slate-600 dark:text-slate-400">Midnight Window Calls (10 PM - 6 AM):</span>
                  <span className="font-bold text-rose-800 dark:text-rose-300">{parsedData.night_calls_count} non-standard calls</span>
                </div>
              )}
              {parsedData.vpn_proxy_hits !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">VPN / Datacenter IP Hits:</span>
                  <span className="font-bold text-rose-800 dark:text-rose-300">{parsedData.vpn_proxy_hits} anonymized gateway hits</span>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <p className="text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-500/20">
                <TranslatedText text={parsedData.executive_summary || 'Forensic analysis completed across submitted evidence.'} />
              </p>

              <div className="mt-2 text-xs font-mono text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5 font-bold">
                <ArrowRight className="h-3.5 w-3.5" />
                <span>Next Action: <TranslatedText text={parsedData.recommended_next_action || 'Proceed with statutory notice dispatch.'} /></span>
              </div>
            </div>
          </div>

          {/* Grid 2A: ATM Cash-Out CCTV Subpoenas */}
          {parsedData.atm_cctv_leads && parsedData.atm_cctv_leads.length > 0 && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <Camera className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ATM Cash-Out Kiosks & CCTV Leads ({parsedData.atm_cctv_leads.length})
                </span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                  PHYSICAL LEADS
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.atm_cctv_leads.map((lead: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-amber-600" />
                        <span>{lead.atm_location}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Date: {lead.date} | Amount: <span className="font-bold text-emerald-700 dark:text-emerald-400">{lead.amount}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleIssueAtmCctvSubpoena(lead)}
                      className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Camera className="h-3 w-3" />
                      <span>Issue Sec 94 CCTV Subpoena</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 2B: Primary Counterparties (Bank Statements) */}
          {parsedData.top_counterparties && parsedData.top_counterparties.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Primary Counterparties ({parsedData.top_counterparties.length})
                </span>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                  LEDGER INFLOW/OUTFLOW
                </span>
              </span>

              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[220px]">
                {parsedData.top_counterparties.map((cp: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-white/5 text-xs font-mono flex items-center justify-between">
                    <span className="text-slate-900 dark:text-white font-medium">{cp.beneficiary || cp.party}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">{cp.type || `${cp.count || 1} txns`}</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{cp.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 3: Discovered Layer-2/3 Mule Accounts */}
          {parsedData.discovered_mules_list && parsedData.discovered_mules_list.length > 0 && (
            <div className="rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                  <ShieldAlert className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Discovered Layer-2 / Layer-3 Mule Accounts ({parsedData.discovered_mules_list.length})
                </span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                  FREEZE CANDIDATES
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.discovered_mules_list.map((mule: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{mule.holder_name} (A/C {mule.account_number})</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Bank: <strong className="text-slate-800 dark:text-slate-200">{mule.bank}</strong> | Volume: <span className="font-bold text-emerald-700 dark:text-emerald-400">{mule.total_volume}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleIssueDiscoveredDirective(mule)}
                      disabled={isIssuingDirective}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      <span>Issue Sec 106 Freeze</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 4: Bulk NEFT Outflows & Penny Drop Probing Audit */}
          {parsedData.bulk_neft_summary && parsedData.bulk_neft_summary.batch_count > 0 && (
            <div className="rounded-xl border border-purple-300 dark:border-purple-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Bulk NEFT Payout Grid & Probing Audit
                </span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-900 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                  {parsedData.bulk_neft_summary.batch_count} BATCHES
                </span>
              </span>

              <div className="p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Total Bulk NEFT Outflow:</span>
                  <span className="font-extrabold text-purple-900 dark:text-purple-300">{parsedData.bulk_neft_summary.total_volume}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Total Batch Batches Executed:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{parsedData.bulk_neft_summary.batch_count} Payout Batches</span>
                </div>
              </div>

              {parsedData.penny_drop_probes && parsedData.penny_drop_probes.length > 0 && (
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[140px]">
                  <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase font-mono">
                    Penny-Drop Probing Probes Detected ({parsedData.penny_drop_probes.length}):
                  </div>
                  {parsedData.penny_drop_probes.map((p: any, pIdx: number) => (
                    <div key={pIdx} className="p-2 rounded bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 text-[11px] font-mono flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{p.beneficiary}</span> ({p.bank})
                        <div className="text-[10px] text-slate-500">Date: {p.date} | A/C: {p.account}</div>
                      </div>
                      <span className="font-extrabold text-rose-700 dark:text-rose-400">{p.amount} Test</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grid 5: Inbound Remitters (Victim Inflow Tranches) */}
          {parsedData.top_inflow_remitters && parsedData.top_inflow_remitters.length > 0 && (
            <div className="rounded-xl border border-cyan-300 dark:border-cyan-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-cyan-800 dark:text-cyan-300">
                  <CreditCard className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  Inbound Remitters & Victim Deposits ({parsedData.top_inflow_remitters.length})
                </span>
                <span className="text-[10px] bg-cyan-100 dark:bg-cyan-500/20 text-cyan-900 dark:text-cyan-300 px-2 py-0.5 rounded font-mono font-bold">
                  VICTIM INFLOWS
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.top_inflow_remitters.map((inf: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{inf.remitter}</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Bank: {inf.bank} | Tranches: {inf.count}
                      </div>
                    </div>
                    <span className="font-black text-cyan-800 dark:text-cyan-300 text-sm">
                      {inf.amount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 4: Telecom IMEI Swapping Forensics */}
          {parsedData.imei_swap_leads && parsedData.imei_swap_leads.length > 0 && (
            <div className="rounded-xl border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                  <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  IMEI Multi-SIM Handset Swaps ({parsedData.imei_swap_leads.length})
                </span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                  BURNER HANDSETS
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.imei_swap_leads.map((swap: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-blue-600" />
                        <span>IMEI: {swap.imei}</span>
                        {swap.device_classification && (
                          <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                            {swap.device_classification}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Usage: <strong className="text-slate-800 dark:text-slate-200">{swap.call_count || 1} Calls</strong> | First Seen: {swap.first_detected?.split(' ')[0] || 'Active'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleIssueCeirSubpoena(swap)}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Send className="h-3 w-3" />
                      <span>Issue CEIR Subpoena</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 6: Top B-Party Accomplice Numbers */}
          {parsedData.top_b_parties && parsedData.top_b_parties.length > 0 && (
            <div className="rounded-xl border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                  <PhoneCall className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Top Contact Numbers & Accomplices ({parsedData.top_b_parties.length})
                </span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                  CALL NETWORK
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.top_b_parties.map((bParty: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <PhoneCall className="h-3.5 w-3.5 text-blue-600" />
                        <span>{bParty.party}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Frequency: <strong className="text-slate-800 dark:text-slate-200">{bParty.count} Calls</strong> ({bParty.risk_flag || 'CONTACT'})
                      </div>
                    </div>
                    <button
                      onClick={() => handleIssueBPartyNotice(bParty)}
                      className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Send className="h-3 w-3" />
                      <span>Issue Sec 94 Notice</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 6B: Linked Banking & Service SMS Headers */}
          {parsedData.linked_service_headers && parsedData.linked_service_headers.length > 0 && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Linked Bank & Service SMS Channels ({parsedData.linked_service_headers.length})
                </span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                  OTP & BANK TRAIL
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.linked_service_headers.map((hdr: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-amber-600" />
                        <span>Header: {hdr.header}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Category: <strong className="text-slate-800 dark:text-slate-200">{hdr.category}</strong>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded">
                      {hdr.sms_count} SMS Events
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {parsedData.vowifi_ip_leads && parsedData.vowifi_ip_leads.length > 0 && (
            <div className="rounded-xl border border-violet-300 dark:border-violet-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-violet-800 dark:text-violet-300">
                  <Wifi className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  VoWiFi Broadband IP Leads ({parsedData.vowifi_ip_leads.length})
                </span>
                <span className="text-[10px] bg-violet-100 dark:bg-violet-500/20 text-violet-900 dark:text-violet-300 px-2 py-0.5 rounded font-mono font-bold">
                  WI-FI CALL FORENSICS
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.vowifi_ip_leads.map((vLead: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-violet-600" />
                        <span>VoWiFi IP: {vLead.vowifi_ip}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Timestamp: {vLead.timestamp}
                      </div>
                    </div>
                    <button
                      onClick={() => handleIssueIspNotice({ ip: vLead.vowifi_ip, ist_timestamp: vLead.timestamp, isp_name: 'Broadband Provider' })}
                      className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Send className="h-3 w-3" />
                      <span>Issue Sec 94 Notice</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid 8: Geospatial Cell Tower Coordinates */}
          {parsedData.geo_tower_locations && parsedData.geo_tower_locations.length > 0 && (
            <div className="rounded-xl border border-teal-300 dark:border-teal-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
                  <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Geospatial Cell Tower Locations ({parsedData.geo_tower_locations.length})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedMapTower(parsedData.geo_tower_locations[0]);
                      setMapModalOpen(true);
                    }}
                    className="text-[10px] bg-teal-600 hover:bg-teal-700 text-white px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 transition-colors"
                  >
                    <Map className="h-3 w-3" />
                    <span>View Map</span>
                  </button>
                  <span className="text-[10px] bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 px-2 py-0.5 rounded font-mono font-bold">
                    GPS LAT / LONG
                  </span>
                </div>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.geo_tower_locations.map((geo: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-500/20 text-xs font-mono flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{geo.tower_id}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>GPS: <strong className="text-teal-800 dark:text-teal-300">{geo.lat}, {geo.lng}</strong></span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${geo.lat}, ${geo.lng}`);
                            setToastMsg(`Copied GPS coordinates ${geo.lat}, ${geo.lng} to clipboard.`);
                          }}
                          title="Copy Coordinates"
                          className="text-slate-400 hover:text-teal-600 transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] bg-teal-200 dark:bg-teal-900/50 text-teal-900 dark:text-teal-300 px-2 py-1 rounded font-bold">
                        {geo.frequency ? `${geo.frequency} Calls` : (geo.timestamp?.split(' ')[1] || 'CALL EVENT')}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedMapTower(geo);
                          setMapModalOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors"
                      >
                        <Navigation className="h-3 w-3" />
                        <span>Locate</span>
                      </button>
                      <a
                        href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid IP-1: Discovered ISP Subscriber Leads (Section 94 BNSS) */}
          {parsedData.isp_subscriber_leads && parsedData.isp_subscriber_leads.length > 0 && (
            <div className="rounded-xl border border-indigo-300 dark:border-indigo-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300">
                  <Globe className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  ISP Subscriber Subpoena Leads ({parsedData.isp_subscriber_leads.length})
                </span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                  SEC 94 BNSS SUBPOENAS
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.isp_subscriber_leads.map((lead: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 text-xs font-mono flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <Globe className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">IP: {lead.ip}</span>
                        {lead.source_port && lead.source_port !== 'Unspecified' && (
                          <span className="text-[9px] bg-indigo-200 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-200 px-1.5 py-0.2 rounded font-bold">
                            Port: {lead.source_port}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        ISP: <strong className="text-slate-800 dark:text-slate-200">{lead.isp_name}</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Timestamp: {lead.ist_timestamp}
                      </div>
                    </div>

                    <button
                      onClick={() => handleIssueIspNotice(lead)}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors shrink-0"
                    >
                      <Send className="h-3 w-3" />
                      <span>Issue Sec 94 Notice</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid IP-2: Public & Anonymized Remote IP Endpoints */}
          {parsedData.top_ip_addresses && parsedData.top_ip_addresses.length > 0 && (
            <div className="rounded-xl border border-blue-300 dark:border-blue-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Remote IP Endpoints ({parsedData.top_ip_addresses.length})
                </span>
                <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                  IP TRAIL
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.top_ip_addresses.map((tip: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 text-xs font-mono flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <Globe className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{tip.ip}</span>
                        {tip.is_vpn ? (
                          <span className="text-[9px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-1.5 py-0.2 rounded font-bold border border-rose-300 dark:border-rose-500/30 shrink-0">
                            TOR / VPN EXIT
                          </span>
                        ) : (
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                            RESIDENTIAL ISP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                        ISP: {tip.isp} {tip.source_ports && tip.source_ports !== 'N/A' && `| Ports: ${tip.source_ports}`}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        Device: {tip.device_summary || tip.device}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-black text-blue-900 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded">
                        {tip.connections} hits
                      </span>
                      {tip.is_vpn ? (
                        <button
                          onClick={() => handleIssueProxySubpoena(tip)}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          <span>Issue Proxy Subpoena</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleIssueIspNotice({ ip: tip.ip, isp_name: tip.isp, nodal_email: tip.nodal_email, source_port: tip.source_ports, ist_timestamp: tip.ist_timestamp })}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          <span>Issue Sec 94 Notice</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid IP-3: Hardware Models & Device Fingerprints */}
          {parsedData.device_fingerprints && parsedData.device_fingerprints.length > 0 && (
            <div className="rounded-xl border border-purple-300 dark:border-purple-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                  <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Hardware Models & Client Fingerprints ({parsedData.device_fingerprints.length})
                </span>
                <span className="text-[10px] bg-purple-100 dark:bg-purple-500/20 text-purple-900 dark:text-purple-300 px-2 py-0.5 rounded font-mono font-bold">
                  USER AGENT FINGERPRINTS
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.device_fingerprints.map((dev: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                        <span>{dev.device_model}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        {dev.fingerprint}
                      </div>
                    </div>
                    <span className="text-xs font-black text-purple-900 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2.5 py-1 rounded">
                      {dev.hits} sessions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid IP-4: Critical Security & Access Events */}
          {parsedData.account_events && parsedData.account_events.length > 0 && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-[#0d1322] p-4 flex flex-col space-y-3 shadow-sm min-h-[260px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-200 dark:border-white/10 pb-2 flex items-center justify-between shrink-0 font-mono">
                <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Security & Access Event Timeline ({parsedData.account_events.length})
                </span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
                  LERT EVENT LOG
                </span>
              </span>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                {parsedData.account_events.map((evt: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {evt.event}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        IP: <strong className="text-slate-800 dark:text-slate-200">{evt.ip}</strong> {evt.source_port && evt.source_port !== 'Unspecified' && `(Port: ${evt.source_port})`}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Device: {evt.device}
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-200 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 px-2 py-1 rounded font-bold shrink-0">
                      {evt.ist_timestamp?.split(' ')[1] || 'IST TIME'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-8 text-center space-y-3 font-mono">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Forensic Response Analytics Studio Awaiting Input
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Drag and drop a response file above, click a quick sample evidence button, or select an inbound provider response to begin forensic extraction.
          </p>
        </div>
      )}

      {/* Section 63 BSA Electronic Certificate Modal */}
      {certModalOpen && certData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono animate-fadeIn">
          <div className="relative w-full max-w-3xl rounded-2xl border border-emerald-500/40 bg-[#080d1a] p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Section 63 BSA Electronic Evidence Certificate
                </h3>
              </div>
              <button
                onClick={() => setCertModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-500/20 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">SHA-256 Checksum:</span>
                <span className="text-slate-300 text-[11px] font-mono select-all">{certData.sha256_hash}</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">VERIFIED</span>
            </div>

            <pre className="flex-1 overflow-y-auto p-4 rounded-xl bg-[#040711] border border-white/10 text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap select-text">
              {certData.certificate_full_text}
            </pre>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-[11px] text-slate-400">
                Statute: Section 63 Bharatiya Sakshya Adhiniyam, 2023 (BSA)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([certData.certificate_full_text], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Section_63_BSA_Certificate_${currentCaseNo}.txt`;
                    a.click();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Certificate</span>
                </button>
                <button
                  onClick={() => setCertModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Cell Tower GPS Map Modal */}
      {mapModalOpen && selectedMapTower && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 font-mono animate-fadeIn">
          <div className="relative w-full max-w-4xl rounded-2xl border border-teal-500/40 bg-[#080d1a] p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-teal-500/30 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-teal-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Cell Tower Geospatial Location & Sector Analysis
                  </h3>
                  <span className="text-[11px] text-slate-400">Tower Sector ID: {selectedMapTower.tower_id}</span>
                </div>
              </div>
              <button
                onClick={() => setMapModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/20 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">GPS Coordinates</span>
                <div className="text-teal-300 font-bold flex items-center justify-between">
                  <span>{selectedMapTower.lat}, {selectedMapTower.lng}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${selectedMapTower.lat}, ${selectedMapTower.lng}`);
                      setToastMsg(`Copied GPS coordinates to clipboard.`);
                    }}
                    className="p-1 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/20 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">Total Activity Volume</span>
                <div className="text-white font-bold">{selectedMapTower.frequency || 1} Recorded Calls/Events</div>
              </div>

              <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-500/20 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase">Forensic Evidence Value</span>
                <div className="text-emerald-400 font-bold">Physical Cell Site Coverage Area</div>
              </div>
            </div>

            {/* Embedded Live Map Frame (OpenStreetMap) */}
            <div className="w-full flex-1 min-h-[380px] rounded-xl overflow-hidden border border-white/10 relative bg-[#040711]">
              <iframe
                title="Cell Tower Location Map"
                width="100%"
                height="100%"
                className="w-full h-full min-h-[380px] border-0"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedMapTower.lng - 0.015}%2C${selectedMapTower.lat - 0.015}%2C${selectedMapTower.lng + 0.015}%2C${selectedMapTower.lat + 0.015}&layer=mapnik&marker=${selectedMapTower.lat}%2C${selectedMapTower.lng}`}
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">External GIS Systems:</span>
                <a
                  href={`https://www.google.com/maps?q=${selectedMapTower.lat},${selectedMapTower.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Google Maps</span>
                </a>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedMapTower.lat}&mlon=${selectedMapTower.lng}#map=16/${selectedMapTower.lat}/${selectedMapTower.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>OpenStreetMap</span>
                </a>
              </div>

              <button
                onClick={() => setMapModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Module Summarizer Modal */}
      <ModuleSummarizerModal
        isOpen={summarizerOpen}
        onClose={() => setSummarizerOpen(false)}
        moduleId="MODULE_5"
        moduleTitle="Module 5: Forensic Response Analytics"
      />
    </div>
  );
}
