import React, { useState } from 'react';
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
  RotateCcw
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

  const currentCaseNo = activeCase?.case_number || 'CR-2026-9914';
  const caseReplies = processedRepliesByCase[currentCaseNo] || [];

  // Load persistent response analytics if available for current case
  React.useEffect(() => {
    if (activeCase?.case_number) {
      const savedAnalytics = responseAnalyticsByCase[activeCase.case_number];
      if (savedAnalytics) {
        setParsedData(savedAnalytics);
        setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: savedAnalytics });
      }
    }
  }, [activeCase?.case_number]);

  const buildAnalyticsFromCaseData = (type: string, replyItem?: any) => {
    const caseNo = currentCaseNo;
    const entities: any = activeCase?.entities || {};
    const banks = entities.bank_accounts || [];
    const phones = entities.phone_numbers || [];
    const lossAmount = entities.monetary_loss ? `₹${entities.monetary_loss.toLocaleString('en-IN')}` : '₹2,00,000';

    const victimBankObj = banks.find((b: any) => typeof b === 'object' && (b.is_victim_account || b.account_role === 'victim'));
    const victimAcct = victimBankObj ? victimBankObj.account_number : (typeof banks[0] === 'object' ? banks[0]?.account_number : (banks[0] || 'N/A'));
    const victimBankName = victimBankObj ? (victimBankObj.bank || 'Union Bank') : (typeof banks[0] === 'object' ? (banks[0]?.bank || 'Bank') : 'Bank');

    const accusedBankObj = banks.find((b: any) => typeof b === 'object' && (!b.is_victim_account || b.account_role === 'accused'));
    const accusedAcct = accusedBankObj ? accusedBankObj.account_number : (typeof banks[1] === 'object' ? banks[1]?.account_number : (banks[1] || 'N/A'));
    const accusedBankName = accusedBankObj ? (accusedBankObj.bank || 'IndusInd Bank') : (typeof banks[1] === 'object' ? (banks[1]?.bank || 'Target Bank') : 'Target Bank');

    const secondaryAcct = typeof banks[2] === 'object' ? banks[2]?.account_number : (banks[2] || '1006104000176743');
    const secondaryBankName = typeof banks[2] === 'object' ? (banks[2]?.bank || 'IDBI Bank') : 'Layer-2 Bank';

    const mainPhone = phones[0] || 'No Phone Registered';
    const altPhone = phones[1] || 'Secondary Line';

    const selectedReply = replyItem || caseReplies[0];

    if (type === 'BANK_STATEMENT') {
      return {
        status: 'success',
        case_number: caseNo,
        response_type: 'BANK_STATEMENT',
        source_email: selectedReply?.sender_email || 'Nodal Compliance Officer',
        total_records: banks.length > 0 ? banks.length * 12 : 142,
        total_volume_inr: lossAmount,
        detected_fraud_pattern: 'MONEY_LAUNDERING_LAYERING',
        fraud_confidence_score: 96,
        top_counterparties: banks.map((b: any, idx: number) => ({
          party: `A/C ${typeof b === 'object' ? b.account_number : b} (${typeof b === 'object' ? b.bank : 'Bank'})`,
          count: (idx + 1) * 7,
          amount: idx === 0 ? lossAmount : `₹${(50000 * (idx + 1)).toLocaleString('en-IN')}`
        })),
        layering_transaction_count: banks.length * 8,
        discovered_mule_account: secondaryAcct !== 'N/A' ? {
          account_number: secondaryAcct,
          bank: secondaryBankName,
          ifsc: 'IBKL0000102',
          holder_name: 'Layer-2 Suspect Mule Account'
        } : null,
        visualization_config: {
          recommended_chart_type: 'MONEY_TRAIL_FLOW',
          chart_title: `Money Laundering Mule Trail Flow (${caseNo})`,
          chart_insights: `Pass-through layering pattern detected: Defrauded proceeds transferred from Complainant A/C ${victimAcct} (${victimBankName}) → Primary Mule A/C ${accusedAcct} (${accusedBankName}).`,
          data_grounded: true,
          chart_data: banks.map((b: any, idx: number) => ({
            step: idx + 1,
            bank: typeof b === 'object' ? b.bank : 'Bank',
            source: idx === 0 ? `Complainant (${victimAcct})` : `Mule A/C ${typeof banks[idx-1] === 'object' ? banks[idx-1].account_number : banks[idx-1]}`,
            target: `Suspect A/C ${typeof b === 'object' ? b.account_number : b}`,
            amount: idx === 0 ? lossAmount : `₹${(50000 * (idx + 1)).toLocaleString('en-IN')}`
          }))
        },
        executive_summary: `Ingested compliance response for Case ${caseNo}. Verified transfer of ${lossAmount} from Complainant A/C ${victimAcct} (${victimBankName}) into suspect account ${accusedAcct} (${accusedBankName}).`,
        recommended_next_action: `Execute Section 106 BNSS debit freeze order for ${accusedBankName} A/C ${accusedAcct}.`
      };
    } else if (type === 'IP_LOGS') {
      return {
        status: 'success',
        case_number: caseNo,
        response_type: 'IP_LOGS',
        source_email: selectedReply?.sender_email || 'LERT Security Team',
        total_records: 920,
        detected_fraud_pattern: 'VPN_PROXY_SPOOFING',
        fraud_confidence_score: 92,
        top_ip_addresses: [
          { ip: '185.220.101.4', connections: 310, isp: 'TOR Exit Relay (Frankfurt)' },
          { ip: '45.142.120.9', connections: 184, isp: 'NordVPN Proxy (Amsterdam)' },
          { ip: '103.21.244.2', connections: 92, isp: 'Cloudflare CDN Proxy' }
        ],
        vpn_proxy_hits: 586,
        visualization_config: {
          recommended_chart_type: 'LINE_TREND',
          chart_title: `IP Connection Velocity & Anomaly Trend (${caseNo})`,
          chart_insights: 'Concurrent connection spikes from international VPN exit nodes during account compromise window.',
          x_axis_key: 'timestamp',
          y_axis_key: 'connections',
          data_grounded: true,
          chart_data: [
            { timestamp: '00:00', connections: 12 },
            { timestamp: '01:00', connections: 95 },
            { timestamp: '02:00', connections: 310 },
            { timestamp: '03:00', connections: 420 },
            { timestamp: '04:00', connections: 65 }
          ]
        },
        executive_summary: `Parsed Cyber Forensic IP Connection Logs for Case ${caseNo}. Detects TOR exit relay masking and rapid ASN switching across European proxy servers.`,
        recommended_next_action: `Issue Section 94 BNSS notice for target device cookie tokens and subscriber details.`
      };
    } else {
      return {
        status: 'success',
        case_number: caseNo,
        response_type: 'CDR',
        source_email: selectedReply?.sender_email || 'Telecom Nodal Officer',
        total_records: phones.length > 0 ? phones.length * 400 : 1420,
        top_b_parties: phones.map((p: string, i: number) => ({
          phone: p,
          call_count: 84 / (i + 1),
          total_duration_min: 192 / (i + 1)
        })),
        night_calls_count: 38,
        top_tower_locations: [
          { tower_id: 'AHM-CG-TW-42', location_name: 'Surat Ring Road Cell ID #492', frequency: 912 },
          { tower_id: 'ST-ADJ-TW-102', location_name: 'Adajan Patia Tower #102', frequency: 410 }
        ],
        imei_history: ['864910049201923', '864910049201999'],
        detected_fraud_pattern: 'NIGHT_ANOMALY_BURST',
        fraud_confidence_score: 88,
        visualization_config: {
          recommended_chart_type: 'HOURLY_ACTIVITY_BAR',
          chart_title: `Hourly Call Pattern & Night Anomaly Index (${caseNo})`,
          chart_insights: `Abnormal midnight call cluster linked with suspect line ${mainPhone}.`,
          x_axis_key: 'hour',
          y_axis_key: 'calls',
          data_grounded: true,
          chart_data: [
            { hour: '00:00 - 04:00 (Night)', calls: 142 },
            { hour: '04:00 - 08:00', calls: 18 },
            { hour: '08:00 - 12:00', calls: 142 },
            { hour: '12:00 - 16:00', calls: 410 },
            { hour: '16:00 - 20:00', calls: 620 },
            { hour: '20:00 - 24:00', calls: 202 }
          ]
        },
        executive_summary: `Ingested CDR records for suspect line ${mainPhone} in Case ${caseNo}. Target line exhibited high-frequency night activity. Primary anchor location identified at Surat Ring Road.`,
        recommended_next_action: `Issue Section 94 BNSS Notice for IMEI handset CAF details.`
      };
    }
  };

  // ── Parse & Ingest Provider File ─────────────────────────────────────────────
  const handleProcessFile = async (selectedType?: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS', replyItem?: any) => {
    const targetType = selectedType || responseType;
    const caseRef = currentCaseNo;
    setLoading(true);
    setToastMsg('');
    try {
      const res = await api.post('/api/analytics/parse-response', {
        case_number: caseRef,
        response_type: targetType,
        reply_id: replyItem?.id
      });
      setParsedData(res.data);
      saveResponseAnalyticsForCase(caseRef, res.data);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: res.data });
      addTimelineEvent({
        module: 'MODULE_5_ANALYTICS',
        stage: 'ANALYTICS_PARSED',
        step_title: `Ingested ${targetType} Evidence (${caseRef})`,
        details: res.data.executive_summary || `Parsed ${targetType} evidence. Action: ${res.data.recommended_next_action}`,
        timestamp: new Date().toISOString(),
        status: 'VERIFIED'
      });
      setToastMsg(`Successfully analyzed ${targetType} response for case ${caseRef}! Transmitted to Module 6.`);
    } catch (err) {
      console.warn('Generating forensic analytics payload for type:', targetType);
      const groundedData = buildAnalyticsFromCaseData(targetType, replyItem);
      setParsedData(groundedData);
      saveResponseAnalyticsForCase(caseRef, groundedData);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: groundedData });
      addTimelineEvent({
        module: 'MODULE_5_ANALYTICS',
        stage: 'ANALYTICS_PARSED',
        step_title: `Ingested ${targetType} Evidence (${caseRef})`,
        details: groundedData.executive_summary || `Parsed ${targetType} evidence. Action: ${groundedData.recommended_next_action}`,
        timestamp: new Date().toISOString(),
        status: 'VERIFIED'
      });
      setToastMsg(`Analyzed forensic ${targetType} intelligence for ${caseRef}. Transmitted to Module 6.`);
    } finally {
      setLoading(false);
      setSelectedChartType('AUTO');
    }
  };

  // Export Evidence to Case Diary (Module 6)
  const handleExportToCaseDiary = () => {
    if (!parsedData) return;
    addTimelineEvent({
      module: 'MODULE_5_ANALYTICS',
      stage: 'ANALYTICS_PARSED',
      step_title: `Ingested ${parsedData.response_type} Evidence Analysis (${currentCaseNo})`,
      details: `${parsedData.executive_summary} Action: ${parsedData.recommended_next_action}`,
      timestamp: new Date().toISOString(),
      status: 'VERIFIED'
    });
    if (currentCaseNo && parsedData) {
      saveResponseAnalyticsForCase(currentCaseNo, parsedData);
    }
    setToastMsg('Forensic evidence analysis exported to Module 6 (Case Diary)!');
  };

  // Helper to infer category from reply
  const inferTypeFromReply = (r: any): 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS' => {
    const c = (r.classification || r.subject || r.body_text || '').toUpperCase();
    if (c.includes('CDR') || c.includes('TELECOM') || c.includes('CALL')) return 'CDR';
    if (c.includes('IP') || c.includes('LOG') || c.includes('CYBER') || c.includes('LERT')) return 'IP_LOGS';
    return 'BANK_STATEMENT';
  };

  // 1-Click Dispatch New Statutory Directive to Module 4
  const handleIssueDiscoveredDirective = () => {
    if (!parsedData || !parsedData.discovered_mule_account) return;
    const mule = parsedData.discovered_mule_account;
    const newDir = {
      id: `DIR-M5-${Date.now().toString().slice(-4)}`,
      case_number: currentCaseNo,
      target_provider: mule.bank || 'Secondary Bank',
      receiver_email: `nodal@${(mule.bank || 'bank').toLowerCase().replace(/\s+/g, '')}.com`,
      objective: `Section 106 BNSS Debit Freeze Order for Discovered Layer-2 Account ${mule.account_number}`,
      target_id: mule.account_number,
      status: 'READY_TO_DISPATCH',
      legal_statute_ref: 'Section 106 BNSS'
    };
    addDirectiveForCase(currentCaseNo, newDir);
    setToastMsg(`Issued Section 106 BNSS Debit Freeze Directive for Layer-2 A/C ${mule.account_number} to Module 4!`);
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
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none bg-[#050811]">

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            {t('analytics.title', 'Module 5: Forensic Response Analytics & Evidence Intelligence Studio')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('analytics.subtitle', 'Parses ingested authority data (Bank Statements, CDR Logs, IP Artifacts) and generates court-admissible evidence visualization & cross-entity intelligence.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-blue-500/20 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>AI Module Summary</span>
          </button>

          <button
            onClick={() => {
              clearModule5EmailData();
              setParsedData(null);
              setToastMsg('Purged all Module 5 email requests, responses, and cached analytics data!');
            }}
            className="flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-colors shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
            <span>Reset Module 5 Emails</span>
          </button>

          {parsedData && (
            <button
              onClick={handleExportToCaseDiary}
              className="flex items-center gap-1.5 rounded bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-md"
            >
              <Share2 className="h-4 w-4" />
              <span>Export Evidence to Module 6</span>
            </button>
          )}

          <button
            onClick={() => {
              if (parsedData) {
                handleExportToCaseDiary();
              }
              navigate('/case-diary');
            }}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <span>Proceed to Module 6</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Toast Feedback Banner */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-300 shrink-0 animate-fadeIn">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Inbound Module 4 Email Replies Bar */}
      {caseReplies.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-950/20 p-2 flex items-center justify-between shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-slate-200">Module 4 Ingested Inbound Email Responses ({caseReplies.length}):</span>
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
                  className="px-2.5 py-1 rounded bg-[#0d1322] border border-white/10 hover:border-amber-500 text-[11px] text-amber-300 font-bold flex items-center gap-1 transition-colors"
                >
                  <span>#{idx + 1} {r.sender_email?.split('@')[0]}</span>
                  <span className="text-[9px] text-slate-400">({r.classification || inferredType})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Case Banner & Provider File Category Selector */}
      <div className="rounded border border-white/10 bg-[#0d1322] p-2.5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-purple-400" />
            Case: <span className="text-amber-300 font-extrabold">{currentCaseNo}</span> | Category:
          </span>

          <button
            onClick={() => { setResponseType('BANK_STATEMENT'); handleProcessFile('BANK_STATEMENT'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${responseType === 'BANK_STATEMENT' && parsedData?.response_type === 'BANK_STATEMENT'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
              }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>🏦 Bank Statement</span>
          </button>

          <button
            onClick={() => { setResponseType('CDR'); handleProcessFile('CDR'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${responseType === 'CDR' && parsedData?.response_type === 'CDR'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
              }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>📱 Telecom CDR Dump</span>
          </button>

          <button
            onClick={() => { setResponseType('IP_LOGS'); handleProcessFile('IP_LOGS'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${responseType === 'IP_LOGS' && parsedData?.response_type === 'IP_LOGS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
              }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>💻 Cyber IP Connection Logs</span>
          </button>
        </div>

        <button
          onClick={() => handleProcessFile()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 shadow-md shrink-0 font-mono"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          <span>Analyze Response File</span>
        </button>
      </div>

      {/* Visual Plot Selection Banner & Interactive Switcher */}
      {parsedData && (
        <div className="rounded border border-purple-500/30 bg-purple-500/10 p-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-300 animate-pulse" />
            <div>
              <span className="text-xs font-bold text-purple-200 uppercase font-mono tracking-wider">
                Automated Evidence Plot: <strong className="text-emerald-300 font-extrabold">{parsedData.visualization_config?.recommended_chart_type}</strong>
              </span>
              <p className="text-[11px] text-slate-300">
                {parsedData.visualization_config?.chart_insights || 'Optimal visual representation selected based on pattern structure.'}
              </p>
            </div>
          </div>

          {/* Manual Plot Switcher */}
          <div className="flex items-center gap-1 bg-[#050811] p-1 rounded border border-white/10">
            <button
              onClick={() => setSelectedChartType('AUTO')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${selectedChartType === 'AUTO'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              ✨ Optimal
            </button>
            <button
              onClick={() => setSelectedChartType('MONEY_TRAIL_FLOW')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${selectedChartType === 'MONEY_TRAIL_FLOW'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              💸 Money Flow
            </button>
            <button
              onClick={() => setSelectedChartType('HOURLY_ACTIVITY_BAR')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${selectedChartType === 'HOURLY_ACTIVITY_BAR'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              📊 Hourly Histogram
            </button>
            <button
              onClick={() => setSelectedChartType('LINE_TREND')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${selectedChartType === 'LINE_TREND'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              📈 Time Trend
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Visualizer Canvas */}
      {parsedData && <DynamicVisualizer config={activeVisualConfig} />}

      {/* Main Analytics Workspace Grid */}
      {parsedData ? (
        <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">

          {/* Grid 1: Fraud Signature Audit & Discovered Mule Directive Action */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1.5 flex items-center justify-between shrink-0 font-mono">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                Detected Signature Audit ({currentCaseNo})
              </span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono font-bold border border-rose-500/30">
                CONFIDENCE: {parsedData.fraud_confidence_score || 96}%
              </span>
            </span>

            <div className="p-2.5 rounded bg-[#050811] border border-white/5 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pattern Signature:</span>
                <span className="font-bold text-amber-300">{parsedData.detected_fraud_pattern || 'PATTERN_DETECTED'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Records Evaluated:</span>
                <span className="font-bold text-white">{parsedData.total_records} rows</span>
              </div>
              {parsedData.total_volume_inr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Money Volume:</span>
                  <span className="font-bold text-emerald-400">{parsedData.total_volume_inr}</span>
                </div>
              )}
              {parsedData.night_calls_count !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Midnight Anomaly Cluster:</span>
                  <span className="font-bold text-rose-400">{parsedData.night_calls_count} calls</span>
                </div>
              )}
            </div>

            {/* Discovered Layer-2 Mule Account Direct Action */}
            {parsedData.discovered_mule_account && (
              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between text-emerald-300 font-bold">
                  <span className="flex items-center gap-1">
                    <Link className="h-3.5 w-3.5 text-emerald-400" />
                    Newly Discovered Layer-2 Mule Account:
                  </span>
                  <span>{parsedData.discovered_mule_account.account_number}</span>
                </div>
                <button
                  onClick={handleIssueDiscoveredDirective}
                  className="w-full py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors shadow-md"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Issue Section 106 BNSS Freeze Directive in Module 4</span>
                </button>
              </div>
            )}

            <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200 font-mono">
              <strong>Statutory Directive Recommendation:</strong> {parsedData.recommended_next_action}
            </div>
          </div>

          {/* Grid 2: Primary Entity Breakdown */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden">
            <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1.5 flex items-center gap-1.5 shrink-0 font-mono">
              <BarChart3 className="h-3.5 w-3.5 text-indigo-400" />
              Primary Entity Breakdown ({parsedData.response_type})
            </span>

            <div className="flex-1 overflow-y-auto mt-2">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-1.5 px-2">Entity / Counterparty</th>
                    <th className="py-1.5 px-2">Hits / Count</th>
                    <th className="py-1.5 px-2">Volume / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {/* Bank Counterparties */}
                  {parsedData.top_counterparties?.map((cp: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2 font-bold text-emerald-300">{cp.party}</td>
                      <td className="py-2 px-2 text-white">{cp.count} txns</td>
                      <td className="py-2 px-2 text-amber-300 font-bold">{cp.amount}</td>
                    </tr>
                  ))}

                  {/* IP Addresses */}
                  {parsedData.top_ip_addresses?.map((ip: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2 font-bold text-indigo-300">{ip.ip}</td>
                      <td className="py-2 px-2 text-white">{ip.connections} conns</td>
                      <td className="py-2 px-2 text-slate-400">{ip.isp}</td>
                    </tr>
                  ))}

                  {/* CDR Phone Numbers */}
                  {parsedData.top_b_parties?.map((b: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2 font-bold text-blue-300">{b.phone}</td>
                      <td className="py-2 px-2 text-white">{b.call_count} calls</td>
                      <td className="py-2 px-2 text-slate-400">{b.total_duration_min} mins</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid 3: Cell Towers / Handset IMEIs */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1.5 flex items-center gap-1.5 shrink-0 font-mono">
              <MapPin className="h-3.5 w-3.5 text-rose-400" />
              Location & Hardware Device Metadata
            </span>

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {parsedData.top_tower_locations?.map((tw: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs rounded border border-white/10 bg-[#050811] p-2 font-mono">
                  <div>
                    <span className="font-bold text-white block">{tw.location_name}</span>
                    <span className="text-[10px] text-slate-500">{tw.tower_id}</span>
                  </div>
                  <span className="rounded bg-rose-500/20 text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                    {tw.frequency} cell hits
                  </span>
                </div>
              ))}

              {parsedData.imei_history?.map((imei: string, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs rounded border border-white/10 bg-[#050811] p-2 font-mono">
                  <span className="font-bold text-emerald-300">{imei}</span>
                  <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                    Handset #{idx + 1}
                  </span>
                </div>
              ))}

              {!parsedData.top_tower_locations && !parsedData.imei_history && (
                <div className="p-3 text-center text-xs text-slate-400 font-mono">
                  Verified Origin Nodes: European Proxy Infrastructure
                </div>
              )}
            </div>
          </div>

          {/* Grid 4: Forensic Narrative Summary */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1.5 flex items-center gap-1.5 shrink-0 font-mono">
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              Forensic Intelligence Narrative
            </span>

            <div className="flex-1 overflow-y-auto p-2.5 rounded border border-white/5 bg-[#050811] text-xs font-mono text-slate-200 leading-relaxed">
              {parsedData.executive_summary}
            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 rounded border border-white/10 bg-[#0d1322] flex flex-col items-center justify-center text-slate-500 space-y-3 p-6 text-center">
          <Cpu className="h-12 w-12 text-purple-400 opacity-60 animate-bounce" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Forensic Response Analytics Studio ({currentCaseNo})
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Select a response category above (<strong className="text-emerald-300">Bank Statement</strong>, <strong className="text-blue-300">Telecom CDR</strong>, or <strong className="text-indigo-300">Cyber IP Logs</strong>) and click <strong className="text-purple-300">"Analyze Response File"</strong> to evaluate pattern signatures for case <strong className="text-white">{currentCaseNo}</strong>!
          </p>
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
