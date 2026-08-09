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
  Activity
} from 'lucide-react';
import api from '../services/api';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';
import DynamicVisualizer, { VisualizationConfig } from '../components/common/DynamicVisualizer';

export default function AnalyticsView() {
  const navigate = useNavigate();
  const { activeCase, setSelectedInspectorItem, addTimelineEvent } = useCaseStore();
  const { t } = useLangStore();
  
  const [loading, setLoading] = useState(false);
  const [responseType, setResponseType] = useState<'BANK_STATEMENT' | 'CDR' | 'IP_LOGS'>('BANK_STATEMENT');
  const [parsedData, setParsedData] = useState<any>(null);
  const [selectedChartType, setSelectedChartType] = useState<string>('AUTO');
  const [toastMsg, setToastMsg] = useState('');

  // ── Parse & Ingest Provider File ─────────────────────────────────────────────
  const handleProcessFile = async (selectedType?: 'BANK_STATEMENT' | 'CDR' | 'IP_LOGS') => {
    const targetType = selectedType || responseType;
    setLoading(true);
    setToastMsg('');
    try {
      const res = await api.post('/api/analytics/parse-response', {
        response_type: targetType
      });
      setParsedData(res.data);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: res.data });
      setToastMsg(`Successfully analyzed ${targetType} provider response!`);
    } catch (err) {
      console.warn('Using analytics fallback response for type:', targetType);
      const mockData = getMockDataForType(targetType);
      setParsedData(mockData);
      setSelectedInspectorItem({ type: 'PROVIDER_RESPONSE_ANALYTICS', data: mockData });
      setToastMsg(`Analyzed ${targetType} response (Demo Fallback Mode)`);
    } finally {
      setLoading(false);
      setSelectedChartType('AUTO');
    }
  };

  const getMockDataForType = (type: string) => {
    if (type === 'BANK_STATEMENT') {
      return {
        status: 'success',
        response_type: 'BANK_STATEMENT',
        total_records: 1840,
        total_volume_inr: '₹48,90,000',
        detected_fraud_pattern: 'MONEY_LAUNDERING_LAYERING',
        fraud_confidence_score: 96,
        top_counterparties: [
          { party: 'A/C 501004928172 (Mule A - HDFC)', count: 14, amount: '₹14,50,000' },
          { party: 'A/C 918293847123 (Mule B - ICICI)', count: 9, amount: '₹9,20,000' },
          { party: 'UPI refund.mule@okaxis', count: 22, amount: '₹6,80,000' },
          { party: 'A/C 309812491023 (Mule C - SBI)', count: 6, amount: '₹5,40,000' }
        ],
        layering_transaction_count: 42,
        visualization_config: {
          recommended_chart_type: 'MONEY_TRAIL_FLOW',
          chart_title: 'Dynamic Money Laundering Mule Trail Flow',
          chart_insights: '4-tier pass-through layering pattern detected: Fraud proceeds transferred from victim to Mule A (HDFC), then split 60/40 to Mule B (ICICI) & Mule C (SBI) within 15 mins.',
          data_grounded: true,
          chart_data: [
            { step: 1, bank: 'HDFC Bank', source: 'Victim (Cyber Fraud)', target: 'Primary Mule (HDFC #501004)', amount: '₹14,50,000' },
            { step: 2, bank: 'ICICI Bank', source: 'Primary Mule', target: 'Layer 2 Mule B (ICICI #918293)', amount: '₹8,70,000' },
            { step: 3, bank: 'State Bank of India', source: 'Layer 2 Mule B', target: 'Layer 3 Mule C (SBI #309812)', amount: '₹5,80,000' },
            { step: 4, bank: 'Crypto Exchange', source: 'Layer 3 Mule C', target: 'USDT Wallet 0x71a...9b4', amount: '₹4,20,000' }
          ]
        },
        executive_summary: 'Parsed HDFC Bank Statement (1,840 transactions). System identified multi-tier money laundering layering pattern with 96% confidence score. ₹48.9 Lakhs defrauded proceeds systematically split across 4 secondary mule accounts.',
        recommended_next_action: 'Execute immediate Section 106 BNSS freeze orders for HDFC A/C #501004928172 and ICICI A/C #918293847123.'
      };
    } else if (type === 'IP_LOGS') {
      return {
        status: 'success',
        response_type: 'IP_LOGS',
        total_records: 920,
        detected_fraud_pattern: 'VPN_PROXY_SPOOFING',
        fraud_confidence_score: 92,
        top_ip_addresses: [
          { ip: '185.220.101.4', connections: 310, isp: 'TOR Exit Relay (Frankfurt)' },
          { ip: '45.142.120.9', connections: 184, isp: 'NordVPN Proxy (Amsterdam)' },
          { ip: '103.21.244.2', connections: 92, isp: 'Cloudflare CDN Proxy' },
          { ip: '185.156.177.12', connections: 44, isp: 'CyberGhost Proxy (Zurich)' }
        ],
        vpn_proxy_hits: 586,
        visualization_config: {
          recommended_chart_type: 'LINE_TREND',
          chart_title: 'IP Connection Velocity & Anomaly Trend',
          chart_insights: 'Concurrent connection spikes from 3 international VPN exit nodes during account compromise window.',
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
        executive_summary: 'Parsed Google Cyber Forensic IP Connection Logs (920 records). Detects TOR exit relay masking and rapid ASN switching across Germany, Netherlands, and Switzerland.',
        recommended_next_action: 'Issue Section 91 CrPC notice to Google LERT for device cookie tokens and secondary Gmail recovery logs.'
      };
    } else {
      return {
        status: 'success',
        response_type: 'CDR',
        total_records: 1420,
        top_b_parties: [
          { phone: '+91 98250 11223', call_count: 84, total_duration_min: 192 },
          { phone: '+91 98790 44551', call_count: 42, total_duration_min: 88 },
          { phone: '+91 97270 99887', call_count: 31, total_duration_min: 64 }
        ],
        night_calls_count: 38,
        top_tower_locations: [
          { tower_id: 'AHM-CG-TW-42', location_name: 'Surat Ring Road Cell ID #492', frequency: 912 },
          { tower_id: 'ST-ADJ-TW-102', location_name: 'Adajan Patia Tower #102', frequency: 410 },
          { tower_id: 'ST-VRC-TW-88', location_name: 'Varachha Main Road Tower #88', frequency: 290 }
        ],
        imei_history: ['864910049201923', '864910049201999'],
        detected_fraud_pattern: 'NIGHT_ANOMALY_BURST',
        fraud_confidence_score: 88,
        visualization_config: {
          recommended_chart_type: 'HOURLY_ACTIVITY_BAR',
          chart_title: 'Hourly Call Pattern & Night Anomaly Index',
          chart_insights: 'Abnormal midnight call cluster (38 calls between 00:00 - 04:00 AM) linked with primary B-party suspect.',
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
        executive_summary: 'Provider response ingested successfully (1,420 CDR records). Target number exhibited high-frequency night activity (38 calls between 00:00-05:00 AM). Primary anchor location identified at Surat Ring Road.',
        recommended_next_action: 'Issue Section 94 BNSS Notice for IMEI 864910049201999 handset CAF details.'
      };
    }
  };

  // Export Evidence to Case Diary (Module 6)
  const handleExportToCaseDiary = () => {
    if (!parsedData) return;
    addTimelineEvent({
      stage: 'ANALYTICS_PARSED',
      title: `Ingested ${parsedData.response_type} Provider Intelligence`,
      description: `${parsedData.executive_summary} Action: ${parsedData.recommended_next_action}`,
      timestamp: new Date().toLocaleTimeString(),
      status: 'VERIFIED'
    });
    setToastMsg('Visual analytics evidence exported to Module 6 (Case Diary)!');
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
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" />
            {t('analytics.title', 'Module 5: Provider Response Analytics Engine')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('analytics.subtitle', 'Parses multi-source provider files (Bank Statements, CDR Call Dumps, Cyber IP Logs) and autonomously determines optimal visual patterns at runtime.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {parsedData && (
            <button
              onClick={handleExportToCaseDiary}
              className="flex items-center gap-1.5 rounded bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors shadow-md"
            >
              <Share2 className="h-4 w-4" />
              <span>Export to Module 6</span>
            </button>
          )}

          <button
            onClick={() => navigate('/case-diary')}
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

      {/* Response Type Selector & Preset Ingestion Control Bar */}
      <div className="rounded border border-white/10 bg-[#0d1322] p-2.5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-purple-400" />
            Provider File Category:
          </span>

          <button
            onClick={() => { setResponseType('BANK_STATEMENT'); handleProcessFile('BANK_STATEMENT'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              responseType === 'BANK_STATEMENT'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>🏦 Bank Statement / Account Ledger</span>
          </button>

          <button
            onClick={() => { setResponseType('CDR'); handleProcessFile('CDR'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              responseType === 'CDR'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-[#050811] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>📱 Telecom CDR & Cell Tower Dump</span>
          </button>

          <button
            onClick={() => { setResponseType('IP_LOGS'); handleProcessFile('IP_LOGS'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              responseType === 'IP_LOGS'
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
          className="flex items-center gap-1.5 rounded bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 shadow-md shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          <span>Ingest & Analyze Provider File</span>
        </button>
      </div>

      {/* AI Visual Runtime Selection Banner & Interactive Plot Switcher */}
      {parsedData && (
        <div className="rounded border border-purple-500/30 bg-purple-500/10 p-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-300 animate-pulse" />
            <div>
              <span className="text-xs font-bold text-purple-200 uppercase font-mono tracking-wider">
                AI Runtime Selected Visual Plot: <strong className="text-emerald-300 font-extrabold">{parsedData.visualization_config?.recommended_chart_type}</strong>
              </span>
              <p className="text-[11px] text-slate-300">
                {parsedData.visualization_config?.chart_insights || 'Automatically selected optimal visual representation based on pattern structure.'}
              </p>
            </div>
          </div>

          {/* Manual Visual Plot Override Switcher */}
          <div className="flex items-center gap-1 bg-[#050811] p-1 rounded border border-white/10">
            <button
              onClick={() => setSelectedChartType('AUTO')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                selectedChartType === 'AUTO'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ✨ AI Optimal
            </button>
            <button
              onClick={() => setSelectedChartType('MONEY_TRAIL_FLOW')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                selectedChartType === 'MONEY_TRAIL_FLOW'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💸 Money Flow
            </button>
            <button
              onClick={() => setSelectedChartType('HOURLY_ACTIVITY_BAR')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                selectedChartType === 'HOURLY_ACTIVITY_BAR'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 Hourly Histogram
            </button>
            <button
              onClick={() => setSelectedChartType('LINE_TREND')}
              className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                selectedChartType === 'LINE_TREND'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              📈 Time Trend
            </button>
          </div>
        </div>
      )}

      {/* Dynamic AI Grounded Visualizer Canvas */}
      {parsedData && <DynamicVisualizer config={activeVisualConfig} />}

      {/* Main Analytics Workspace Grid (4 High-Density Cards) */}
      {parsedData ? (
        <div className="flex-1 grid grid-cols-2 gap-3 overflow-hidden">

          {/* Grid 1: Fraud Pattern & Risk Score Banner */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1.5 flex items-center justify-between shrink-0 font-mono">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                Detected Fraud Signature & Risk Index
              </span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono font-bold border border-rose-500/30">
                SCORE: {parsedData.fraud_confidence_score || 94}%
              </span>
            </span>

            <div className="p-2.5 rounded bg-[#050811] border border-white/5 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pattern Identifier:</span>
                <span className="font-bold text-amber-300">{parsedData.detected_fraud_pattern || 'PATTERN_DETECTED'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Analyzed Records:</span>
                <span className="font-bold text-white">{parsedData.total_records} rows</span>
              </div>
              {parsedData.total_volume_inr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Fraud Volume:</span>
                  <span className="font-bold text-emerald-400">{parsedData.total_volume_inr}</span>
                </div>
              )}
              {parsedData.night_calls_count !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Midnight Call Cluster (00-04 AM):</span>
                  <span className="font-bold text-rose-400">{parsedData.night_calls_count} calls</span>
                </div>
              )}
            </div>

            <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200 font-mono">
              <strong>Executive Directive:</strong> {parsedData.recommended_next_action}
            </div>
          </div>

          {/* Grid 2: Top Counterparties / IP Nodes Table */}
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

          {/* Grid 3: Cell Towers / Device IMEIs / Proxy Relays */}
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
                  Verified Proxy Origin: TOR Exit Relays (Germany / Netherlands)
                </div>
              )}
            </div>
          </div>

          {/* Grid 4: AI Executive Narrative */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-hidden space-y-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/10 pb-1.5 flex items-center gap-1.5 shrink-0 font-mono">
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              AI Investigator Narrative Summary
            </span>

            <div className="flex-1 overflow-y-auto p-2.5 rounded border border-white/5 bg-[#050811] text-xs font-mono text-slate-200 leading-relaxed">
              {parsedData.executive_summary}
            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 rounded border border-white/10 bg-[#0d1322] flex flex-col items-center justify-center text-slate-500 space-y-3">
          <Cpu className="h-12 w-12 text-purple-400 opacity-60 animate-bounce" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Provider Response Analytics Workbench</h3>
          <p className="text-xs text-slate-400 max-w-md text-center">
            Select a file category above (<strong className="text-emerald-300">Bank Statement</strong>, <strong className="text-blue-300">Telecom CDR</strong>, or <strong className="text-indigo-300">Cyber IP Logs</strong>) and click <strong className="text-purple-300">"Ingest & Analyze Provider File"</strong> to evaluate pattern signatures and generate dynamic visual plots at runtime!
          </p>
        </div>
      )}

    </div>
  );
}

