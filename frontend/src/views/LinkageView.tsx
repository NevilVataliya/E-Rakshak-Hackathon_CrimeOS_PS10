import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Connection
} from '@xyflow/react';
import { Network, ArrowRight, ShieldCheck, Loader2, Search, Phone, CreditCard, Building, AlertTriangle, RefreshCw, Sparkles, Lock } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { LinkageMatch, LinkageStats } from '../types';
import ModuleSummarizerModal from '../components/common/ModuleSummarizerModal';
import TranslatedText from '../components/common/TranslatedText';

// --- Node & Edge Color Mapping by Entity Type ---
const entityStyle: Record<string, { bg: string; color: string; border: string; stroke: string }> = {
  phone: { bg: '#0d1322', color: '#38bdf8', border: '#0284c7', stroke: '#38bdf8' },
  vpa: { bg: '#f59e0b20', color: '#fbbf24', border: '#f59e0b', stroke: '#f59e0b' },
  bank_account: { bg: '#6366f120', color: '#a5b4fc', border: '#6366f1', stroke: '#6366f1' },
  manual: { bg: '#8b5cf620', color: '#c4b5fd', border: '#8b5cf6', stroke: '#8b5cf6' },
  fir: { bg: '#0d1322', color: '#60a5fa', border: '#3b82f6', stroke: '#3b82f6' },
  linked_fir: { bg: '#f43f5e20', color: '#fda4af', border: '#f43f5e', stroke: '#f43f5e' }
};

function buildGraphFromMatches(matches: LinkageMatch[], caseNumber?: string) {
  if (!caseNumber) {
    return { nodes: [], edges: [] };
  }
  const nodes: any[] = [];
  const edges: any[] = [];
  const seenEntities = new Set<string>();
  const seenCases = new Set<string>();

  // Central FIR node
  const firStyle = entityStyle.fir;
  nodes.push({
    id: 'fir-main',
    type: 'default',
    data: { label: `Active Case: ${caseNumber}` },
    position: { x: matches && matches.length > 0 ? 80 : 380, y: 200 },
    style: { background: firStyle.bg, color: firStyle.color, border: `1px solid ${firStyle.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  });

  if (!matches || matches.length === 0) {
    return { nodes, edges };
  }

  let entityIndex = 0;
  let caseIndex = 0;

  matches.forEach((match, idx) => {
    const entityKey = `${match.entity_type}-${match.entity_value}`;
    const caseKey = match.matched_case;

    // Entity node (column 2)
    if (!seenEntities.has(entityKey)) {
      seenEntities.add(entityKey);
      const es = entityStyle[match.entity_type] || entityStyle.manual;
      const typeLabel = match.entity_type === 'bank_account' ? 'A/C' : match.entity_type === 'vpa' ? 'UPI' : match.entity_type.charAt(0).toUpperCase() + match.entity_type.slice(1);
      nodes.push({
        id: entityKey,
        type: 'default',
        data: { label: `${typeLabel}: ${match.entity_value}`, matchData: match },
        position: { x: 380, y: 60 + entityIndex * 120 },
        style: { background: es.bg, color: es.color, border: `1px solid ${es.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
      });
      edges.push({
        id: `e-fir-${entityKey}`,
        source: 'fir-main',
        target: entityKey,
        style: { stroke: es.stroke },
        markerEnd: { type: MarkerType.ArrowClosed, color: es.stroke }
      });
      entityIndex++;
    }

    // Linked case node (column 3)
    if (!seenCases.has(caseKey)) {
      seenCases.add(caseKey);
      const cs = entityStyle.linked_fir;
      nodes.push({
        id: caseKey,
        type: 'default',
        data: { label: `${match.matched_fir} (${match.police_station})`, matchData: match },
        position: { x: 700, y: 60 + caseIndex * 120 },
        style: { background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
      });
      caseIndex++;
    }

    // Edge from entity to linked case
    const entityKey2 = `${match.entity_type}-${match.entity_value}`;
    const edgeId = `e-${entityKey2}-${caseKey}-${idx}`;
    const es = entityStyle[match.entity_type] || entityStyle.manual;
    const pctLabel = `${Math.round(match.confidence * 100)}% Match`;
    edges.push({
      id: edgeId,
      source: entityKey2,
      target: caseKey,
      label: pctLabel,
      animated: match.confidence >= 0.85,
      style: { stroke: entityStyle.linked_fir.stroke },
      markerEnd: { type: MarkerType.ArrowClosed, color: entityStyle.linked_fir.stroke }
    });
  });

  return { nodes, edges };
}

// Human-readable match type labels (keep in sync with ai-service MATCH_TYPE dict)
const matchTypeLabels: Record<string, string> = {
  CDR_RECURRENCE: 'CDR Phone Recurrence',
  SUBSCRIBER_OVERLAP: 'Subscriber Overlap',
  RECURRING_MULE: 'Recurring Mule Account',
  TRANSACTION_PATTERN: 'Transaction Pattern',
  BENEFICIARY_RECURRENCE: 'Beneficiary Account Recurrence',
  EMAIL_OVERLAP: 'Email Address Match',
  CROSS_CASE_RECURRENCE: 'Cross-Case Entity Match',
  SEMANTIC_SIMILARITY: 'Semantic Similarity (SOP)',
  MANUAL_SEARCH_HIT: 'Manual Search Hit',
};

export default function LinkageView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    activeCase,
    completedStepByCase,
    linkageMatchesByCase,
    linkageStatsByCase,
    linkageMatches,
    linkageStats,
    linkageLoading,
    linkageError,
    runLinkageSearch,
    clearLinkage,
    setSelectedInspectorItem
  } = useCaseStore();

  const caseNo = activeCase?.case_number;
  const completedStep = caseNo ? (completedStepByCase[caseNo] ?? activeCase?.completed_step ?? 0) : 0;
  const isModuleLocked = !activeCase || completedStep < 1;

  const [manualQuery, setManualQuery] = useState('');
  const [searchType, setSearchType] = useState<string>('auto');
  const [summarizerOpen, setSummarizerOpen] = useState(false);
  const caseRef = activeCase?.case_number;

  // Derive active matches with fallback to case-specific mappings or case property
  const effectiveMatches: LinkageMatch[] = useMemo(() => {
    if (!caseNo) return [];
    const caseSpecific = linkageMatchesByCase?.[caseNo];
    if (Array.isArray(caseSpecific) && caseSpecific.length > 0) return caseSpecific;
    if (Array.isArray(activeCase?.cross_case_matches) && activeCase.cross_case_matches.length > 0) return activeCase.cross_case_matches;
    return linkageMatches || [];
  }, [caseNo, linkageMatchesByCase, activeCase?.cross_case_matches, linkageMatches]);

  const effectiveStats: LinkageStats | null = useMemo(() => {
    if (!caseNo) return null;
    const caseStats = linkageStatsByCase?.[caseNo];
    if (caseStats) return caseStats;
    if (effectiveMatches.length > 0) {
      return {
        total_entities_searched: effectiveMatches.length,
        total_matches: effectiveMatches.length,
        high_confidence: effectiveMatches.filter(m => m.confidence >= 0.85).length,
        medium_confidence: effectiveMatches.filter(m => m.confidence >= 0.7 && m.confidence < 0.85).length,
        low_confidence: effectiveMatches.filter(m => m.confidence < 0.7).length,
        unique_linked_cases: [...new Set(effectiveMatches.map(m => m.matched_case))].length,
        unique_police_stations: [...new Set(effectiveMatches.map(m => m.police_station))].length,
      };
    }
    return linkageStats || null;
  }, [caseNo, linkageStatsByCase, effectiveMatches, linkageStats]);

  // Build graph dynamically from linkage matches
  const { nodes: graphNodes, edges: graphEdges } = useMemo(
    () => buildGraphFromMatches(effectiveMatches, caseNo),
    [effectiveMatches, caseNo]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);

  // Sync when matches change
  useEffect(() => {
    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [graphNodes, graphEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = (_: any, node: any) => {
    const matchData = node.data?.matchData;
    if (matchData) {
      setSelectedInspectorItem({
        type: 'LINKAGE_NODE_INSPECTOR',
        data: matchData
      });
    } else {
      setSelectedInspectorItem({
        type: 'LINKAGE_NODE_INSPECTOR',
        data: {
          entity_type: 'manual',
          entity_value: node.data.label,
          description: 'This is the active case under investigation.'
        }
      });
    }
  };

  const handleAutoSearch = () => {
    const caseNo = activeCase?.case_number;
    if (!caseNo) return;
    const storeState = useCaseStore.getState();
    const intakeRecord = storeState.intakeDataByCase[caseNo];

    let caseEntities = activeCase?.entities
      || intakeRecord?.extracted_result?.entities
      || {};

    const phones = caseEntities.phone_numbers || [];
    const vpas = caseEntities.vpas_upis || [];
    const accounts = caseEntities.bank_accounts || [];

    // If structured entities are empty, extract heuristically from case narrative
    if (phones.length === 0 && vpas.length === 0 && accounts.length === 0) {
      const narrative = activeCase.complaint_text || activeCase.manual_text || intakeRecord?.manual_text || '';
      const extractedPhones = narrative.match(/\+?\d{10,12}/g) || [];
      const extractedVpas = narrative.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g) || [];
      const extractedAccts = narrative.match(/\b\d{9,18}\b/g) || [];

      caseEntities = {
        ...caseEntities,
        phone_numbers: extractedPhones.length > 0 ? extractedPhones : ['+919876543210'],
        vpas_upis: extractedVpas.length > 0 ? extractedVpas : ['scammer@paytm'],
        bank_accounts: extractedAccts.length > 0
          ? extractedAccts.map((a: string) => ({ account_number: a, bank: 'Target Bank' }))
          : [{ account_number: '30910293101', bank: 'SBI' }]
      };
    }

    runLinkageSearch(
      caseNo,
      caseEntities,
      undefined,
      undefined
    );
  };

  const handleManualSearch = () => {
    if (manualQuery.trim()) {
      const caseNo = activeCase?.case_number || 'CR-2026-9914';
      runLinkageSearch(
        caseNo,
        {},
        manualQuery.trim(),
        searchType
      );
    }
  };

  // Stats summary for the right panel
  const highConfMatches = effectiveMatches.filter(m => m.confidence >= 0.85);
  const medConfMatches = effectiveMatches.filter(m => m.confidence >= 0.7 && m.confidence < 0.85);

  if (isModuleLocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#F8FAFC] dark:bg-[#050811] select-none">
        <div className="max-w-md rounded-2xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] p-8 shadow-2xl space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Lock className="h-7 w-7 text-amber-400" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wide">
              Module 2 Locked: Complaint Intake Required
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              You must ingest and analyze a complaint narrative in <span className="font-bold text-amber-500 dark:text-amber-400">Complaint Intake (Step 1)</span> before initiating Serial Offender Linkage Analysis.
            </p>
          </div>
          <button
            onClick={() => navigate('/intake')}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-[#0A2540] dark:bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors shadow"
          >
            <span>Go to Complaint Intake (Step 1)</span>
            <ArrowRight className="h-4 w-4 text-amber-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none bg-[#F8FAFC] dark:bg-[#050811]">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-wide text-slate-900 dark:text-white uppercase font-mono flex items-center gap-2">
              {t('linkage.title', 'Serial Offender Linkage Analysis Studio')}
            </h1>
            {caseRef && (
              <span className="rounded-full border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 font-mono">
                {t('brand.active_fir', 'Active Case:')} {caseRef}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {t('linkage.subtitle', 'Cross-match phone numbers, VPAs/UPI IDs, and bank accounts against historical police station records.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded border border-amber-500 bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-600 transition-colors shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('nav.summary', 'AI Module Summary')}</span>
          </button>

          <button
            onClick={handleAutoSearch}
            disabled={linkageLoading}
            className="flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-950 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {linkageLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>Scan for Linked Cases</span>
          </button>

          <button
            onClick={() => navigate('/investigation')}
            className="flex items-center gap-1.5 rounded bg-[#0A2540] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
          >
            <span>Proceed to Investigation Studio</span>
            <ArrowRight className="h-4 w-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {linkageError && (
        <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 flex items-start gap-3 shrink-0">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Linkage Search Failed</h3>
            <p className="text-xs text-rose-200 mt-1 leading-relaxed">{linkageError}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Please check your connection and try again. Contact the system administrator if the issue persists.
            </p>
          </div>
        </div>
      )}

      {/* Main Split: Graph Canvas & Summary */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden">

        {/* Entity Connection Graph (2 Columns) */}
        <div className="col-span-2 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050811] flex flex-col overflow-hidden relative shadow-sm">
          <div className="h-8 border-b border-slate-200 dark:border-white/10 px-3 flex items-center justify-between bg-slate-50 dark:bg-[#080d1a] z-10 shrink-0">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" /> Entity Connection Graph
            </span>
            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
              {effectiveMatches.length > 0 ? `${effectiveMatches.length} matches found` : 'Click "Scan for Linked Cases" to begin'}
            </span>
          </div>

          <div className="flex-1 w-full h-full">
            {linkageLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
                <p className="text-xs text-slate-600 dark:text-slate-400">Searching across case database for entity matches...</p>
              </div>
            ) : effectiveMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Network className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {effectiveStats
                    ? `No cross-case links found. ${effectiveStats.total_entities_searched} entities searched across all complaints — no repeating suspects detected.`
                    : 'Click "Scan for Linked Cases" to analyze entities from the active case across the complaints database.'}
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                fitView
              >
                <Background color="#94a3b8" gap={16} />
                <Controls />
              </ReactFlow>
            )}
          </div>
        </div>

        {/* Right: Summary & Manual Search (1 Column) */}
        <div className="col-span-1 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] p-3 flex flex-col overflow-y-auto space-y-3 shadow-sm">

          {/* Manual Entity Search */}
          <div className="space-y-2 border-b border-slate-200 dark:border-white/10 pb-3">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Manual Entity Search</span>
            <div className="flex gap-1.5">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="h-7 rounded border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#050811] px-2 text-[11px] font-mono text-slate-900 dark:text-slate-300 outline-none"
              >
                <option value="auto">Auto Detect</option>
                <option value="phone">Phone Number</option>
                <option value="vpa">UPI VPA</option>
                <option value="bank_account">Bank Account</option>
              </select>
              <input
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                placeholder="Enter entity to search..."
                className="flex-1 h-7 rounded border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#050811] px-2 text-[11px] font-mono text-slate-900 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={handleManualSearch}
              disabled={!manualQuery.trim() || linkageLoading}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-[#050811] py-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-40"
            >
              {linkageLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              <span>{linkageLoading ? 'Searching Entity...' : 'Search Entity'}</span>
            </button>
          </div>

          {/* Match Results Summary */}
          <div className="flex-1 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Match Summary
            </span>

            {effectiveStats ? (
              <div className="space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2 text-center">
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">{effectiveStats.total_matches}</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">Total Matches</p>
                  </div>
                  <div className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2 text-center">
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">{effectiveStats.unique_linked_cases}</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">Linked Cases</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 p-1.5 text-center">
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 font-mono">{effectiveStats.high_confidence}</p>
                    <p className="text-[9px] text-slate-600 dark:text-slate-400">High</p>
                  </div>
                  <div className="rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 p-1.5 text-center">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300 font-mono">{effectiveStats.medium_confidence}</p>
                    <p className="text-[9px] text-slate-600 dark:text-slate-400">Medium</p>
                  </div>
                  <div className="rounded bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/30 p-1.5 text-center">
                    <p className="text-sm font-bold text-rose-800 dark:text-rose-300 font-mono">{effectiveStats.low_confidence}</p>
                    <p className="text-[9px] text-slate-600 dark:text-slate-400">Low</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-2">Run a scan to see match summary statistics.</p>
            )}

            {/* Individual Match Cards */}
            {highConfMatches.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">High Confidence Matches</span>
                {highConfMatches.map((m, i) => {
                  const Icon = m.entity_type === 'phone' ? Phone : m.entity_type === 'vpa' ? CreditCard : Building;
                  return (
                    <div key={i} className="rounded border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-2 space-y-0.5 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                      onClick={() => setSelectedInspectorItem({ type: 'LINKAGE_NODE_INSPECTOR', data: m })}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-950 dark:text-emerald-200">
                          <Icon className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> {m.entity_value}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300">{Math.round(m.confidence * 100)}%</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300">{matchTypeLabels[m.match_type] || m.match_type} → {m.matched_fir}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {medConfMatches.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase block">Medium Confidence Matches</span>
                {medConfMatches.map((m, i) => {
                  const Icon = m.entity_type === 'phone' ? Phone : m.entity_type === 'vpa' ? CreditCard : Building;
                  return (
                    <div key={i} className="rounded border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2 space-y-0.5 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                      onClick={() => setSelectedInspectorItem({ type: 'LINKAGE_NODE_INSPECTOR', data: m })}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-950 dark:text-amber-200">
                          <Icon className="h-3 w-3 text-amber-600 dark:text-amber-400" /> {m.entity_value}
                        </span>
                        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300">{Math.round(m.confidence * 100)}%</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300">{matchTypeLabels[m.match_type] || m.match_type} → {m.matched_fir}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/investigation')}
            className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors mt-auto"
          >
            <span>Proceed to Investigation Studio</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>

      <ModuleSummarizerModal
        isOpen={summarizerOpen}
        onClose={() => setSummarizerOpen(false)}
        moduleId="MODULE_2"
        moduleTitle="Serial Linkage & Cross-FIR Pattern Analysis"
      />
    </div>
  );
}
