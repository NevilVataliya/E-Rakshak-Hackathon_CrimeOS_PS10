import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Network, ArrowRight, ShieldCheck, Loader2, Search, Phone, CreditCard, Building, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { LinkageMatch } from '../types';
import { useLangStore } from '../store/langStore';

// --- Node & Edge Color Mapping by Entity Type ---
const entityStyle: Record<string, { bg: string; color: string; border: string; stroke: string }> = {
  phone: { bg: '#0d1322', color: '#38bdf8', border: '#0284c7', stroke: '#38bdf8' },
  vpa: { bg: '#f59e0b20', color: '#fbbf24', border: '#f59e0b', stroke: '#f59e0b' },
  bank_account: { bg: '#6366f120', color: '#a5b4fc', border: '#6366f1', stroke: '#6366f1' },
  manual: { bg: '#8b5cf620', color: '#c4b5fd', border: '#8b5cf6', stroke: '#8b5cf6' },
  fir: { bg: '#0d1322', color: '#60a5fa', border: '#3b82f6', stroke: '#3b82f6' },
  linked_fir: { bg: '#f43f5e20', color: '#fda4af', border: '#f43f5e', stroke: '#f43f5e' }
};

function buildGraphFromMatches(matches: LinkageMatch[], caseNumber: string) {
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
    position: { x: 80, y: 200 },
    style: { background: firStyle.bg, color: firStyle.color, border: `1px solid ${firStyle.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  });

  let entityIndex = 0;
  let caseIndex = 0;

  matches.forEach((match, idx) => {
    const entityKey = `${match.entity_type}-${match.entity_value}`;
    const caseKey = match.matched_case;

    // Entity node (column 2)
    if (!seenEntities.has(entityKey)) {
      seenEntities.add(entityKey);
      const estyle = entityStyle[match.entity_type] || entityStyle.manual;
      nodes.push({
        id: `entity-${entityKey}`,
        type: 'default',
        data: { label: `${match.entity_type.toUpperCase()}: ${match.entity_value}` },
        position: { x: 380, y: 80 + entityIndex * 90 },
        style: { background: estyle.bg, color: estyle.color, border: `1px solid ${estyle.border}`, borderRadius: '8px', fontSize: '10px', fontWeight: 'semibold', padding: '8px' }
      });
      edges.push({
        id: `edge-main-${entityKey}`,
        source: 'fir-main',
        target: `entity-${entityKey}`,
        animated: true,
        style: { stroke: estyle.stroke, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: estyle.stroke }
      });
      entityIndex++;
    }

    // Linked FIR node (column 3)
    if (!seenCases.has(caseKey)) {
      seenCases.add(caseKey);
      const lstyle = entityStyle.linked_fir;
      nodes.push({
        id: `case-${caseKey}`,
        type: 'default',
        data: { label: `${match.matched_case}\n(${match.matched_fir || 'FIR Linked'})` },
        position: { x: 680, y: 80 + caseIndex * 90 },
        style: { background: lstyle.bg, color: lstyle.color, border: `1px solid ${lstyle.border}`, borderRadius: '8px', fontSize: '10px', fontWeight: 'semibold', padding: '8px' }
      });
      caseIndex++;
    }

    // Edge from entity to linked case
    edges.push({
      id: `edge-${entityKey}-${caseKey}`,
      source: `entity-${entityKey}`,
      target: `case-${caseKey}`,
      animated: match.confidence >= 0.85,
      style: { stroke: match.confidence >= 0.85 ? '#f43f5e' : '#f59e0b', strokeWidth: match.confidence >= 0.85 ? 2 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: match.confidence >= 0.85 ? '#f43f5e' : '#f59e0b' }
    });
  });

  return { nodes, edges };
}

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

import NoActiveCaseGuard from '../components/common/NoActiveCaseGuard';

export default function LinkageView() {
  const navigate = useNavigate();
  const { activeCase, linkageMatches, linkageStats, linkageLoading, linkageError, runLinkageSearch, setSelectedInspectorItem } = useCaseStore();
  const { t } = useLangStore();

  if (!activeCase) {
    return (
      <NoActiveCaseGuard
        moduleName="Module 2: Serial Crime Linkage Graph"
        description="Select an active case from the dropdown or ingest a new complaint to construct serial offender topologies, mule account recurrence graphs, and cross-case linkages."
      />
    );
  }

  const [manualQuery, setManualQuery] = useState('');
  const [searchType, setSearchType] = useState('auto');

  const activeCaseNumber = activeCase?.case_number || 'CR-2026-9910';

  // Build graph nodes/edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphFromMatches(linkageMatches, activeCaseNumber),
    [linkageMatches, activeCaseNumber]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => setEdges((eds: any) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = (_: any, node: any) => {
    const matchData = node.data?.matchData;
    if (matchData) {
      setSelectedInspectorItem({ type: 'LINKAGE_NODE_INSPECTOR', data: matchData });
    }
  };

  const handleAutoSearch = () => {
    const entities = activeCase?.entities || {
      phone_numbers: ['9825012345'],
      vpas_upis: ['fraud.scam@upi'],
      bank_accounts: ['30910293101']
    };
    runLinkageSearch(activeCaseNumber, entities, manualQuery, searchType);
  };

  const handleManualSearch = () => {
    if (manualQuery.trim()) {
      runLinkageSearch(activeCaseNumber, {}, manualQuery.trim(), searchType);
    }
  };

  // Stats summary for the right panel
  const highConfMatches = linkageMatches.filter(m => m.confidence >= 0.85);
  const medConfMatches = linkageMatches.filter(m => m.confidence >= 0.7 && m.confidence < 0.85);

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            {t('linkage.title', 'Serial Offender Link Analysis')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('linkage.subtitle', 'Matches suspect entities across historical FIRs to identify serial offenders and linked cases.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSearch}
            disabled={linkageLoading}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {linkageLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            <span>{t('linkage.btn_search', 'Scan for Linked Cases')}</span>
          </button>

          <button
            onClick={() => navigate('/investigation')}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            <span>{t('linkage.proceed_to_investigation', 'Proceed to Investigation Studio')}</span>
            <ArrowRight className="h-4 w-4" />
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
        <div className="col-span-2 rounded border border-white/10 bg-[#050811] flex flex-col overflow-hidden relative">
          <div className="h-8 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] z-10 shrink-0">
            <span className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" /> Entity Connection Graph
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {linkageMatches.length > 0 ? `${linkageMatches.length} matches found` : 'Click "Scan for Linked Cases" to begin'}
            </span>
          </div>

          <div className="flex-1 w-full h-full">
            {linkageLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                <p className="text-xs text-slate-400">Searching across case database for entity matches...</p>
              </div>
            ) : linkageMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Network className="h-10 w-10 text-slate-600" />
                <p className="text-xs text-slate-400">
                  {linkageStats
                    ? `No cross-case links found. ${linkageStats.total_entities_searched} entities searched across all complaints — no repeating suspects detected.`
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
                <Background color="#1e293b" gap={16} />
                <Controls />
              </ReactFlow>
            )}
          </div>
        </div>

        {/* Right: Summary & Manual Search (1 Column) */}
        <div className="col-span-1 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col overflow-y-auto space-y-3">

          {/* Manual Entity Search */}
          <div className="space-y-2 border-b border-white/10 pb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Manual Entity Search</span>
            <div className="flex gap-1.5">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="h-7 rounded border border-white/10 bg-[#050811] px-2 text-[11px] font-mono text-slate-300 outline-none"
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
                className="flex-1 h-7 rounded border border-white/10 bg-[#050811] px-2 text-[11px] font-mono text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>
            <button
              onClick={handleManualSearch}
              disabled={!manualQuery.trim() || linkageLoading}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-white/10 bg-[#050811] py-1.5 text-[11px] font-semibold text-blue-400 hover:border-blue-500/40 transition-colors disabled:opacity-40"
            >
              <Search className="h-3 w-3" /> Search Entity
            </button>
          </div>

          {/* Match Results Summary */}
          <div className="flex-1 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Match Summary
            </span>

            {linkageStats ? (
              <div className="space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded border border-white/10 bg-[#050811] p-2 text-center">
                    <p className="text-lg font-extrabold text-white font-mono">{linkageStats.total_matches}</p>
                    <p className="text-[10px] text-slate-400">Total Matches</p>
                  </div>
                  <div className="rounded border border-white/10 bg-[#050811] p-2 text-center">
                    <p className="text-lg font-extrabold text-white font-mono">{linkageStats.unique_linked_cases}</p>
                    <p className="text-[10px] text-slate-400">Linked Cases</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-1.5 text-center">
                    <p className="text-sm font-bold text-emerald-300 font-mono">{linkageStats.high_confidence}</p>
                    <p className="text-[9px] text-slate-400">High</p>
                  </div>
                  <div className="rounded bg-amber-500/10 border border-amber-500/30 p-1.5 text-center">
                    <p className="text-sm font-bold text-amber-300 font-mono">{linkageStats.medium_confidence}</p>
                    <p className="text-[9px] text-slate-400">Medium</p>
                  </div>
                  <div className="rounded bg-rose-500/10 border border-rose-500/30 p-1.5 text-center">
                    <p className="text-sm font-bold text-rose-300 font-mono">{linkageStats.low_confidence}</p>
                    <p className="text-[9px] text-slate-400">Low</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-2">Run a scan to see match summary statistics.</p>
            )}

            {/* Individual Match Cards */}
            {highConfMatches.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <span className="text-[10px] font-bold text-emerald-300 uppercase block">High Confidence Matches</span>
                {highConfMatches.map((m, i) => {
                  const Icon = m.entity_type === 'phone' ? Phone : m.entity_type === 'vpa' ? CreditCard : Building;
                  return (
                    <div key={i} className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 space-y-0.5 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                      onClick={() => setSelectedInspectorItem({ type: 'LINKAGE_NODE_INSPECTOR', data: m })}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-200">
                          <Icon className="h-3 w-3" /> {m.entity_value}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-300">{Math.round(m.confidence * 100)}%</span>
                      </div>
                      <p className="text-[10px] text-slate-300">{matchTypeLabels[m.match_type] || m.match_type} → {m.matched_fir}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {medConfMatches.length > 0 && (
              <div className="space-y-1.5 mt-2">
                <span className="text-[10px] font-bold text-amber-300 uppercase block">Medium Confidence Matches</span>
                {medConfMatches.map((m, i) => {
                  const Icon = m.entity_type === 'phone' ? Phone : m.entity_type === 'vpa' ? CreditCard : Building;
                  return (
                    <div key={i} className="rounded border border-amber-500/30 bg-amber-500/10 p-2 space-y-0.5 cursor-pointer hover:bg-amber-500/20 transition-colors"
                      onClick={() => setSelectedInspectorItem({ type: 'LINKAGE_NODE_INSPECTOR', data: m })}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-200">
                          <Icon className="h-3 w-3" /> {m.entity_value}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300">{Math.round(m.confidence * 100)}%</span>
                      </div>
                      <p className="text-[10px] text-slate-300">{matchTypeLabels[m.match_type] || m.match_type} → {m.matched_fir}</p>
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

    </div>
  );
}
