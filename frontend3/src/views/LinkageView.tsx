import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  MarkerType 
} from '@xyflow/react';
import { Network, AlertTriangle, ArrowRight, ShieldCheck, Database } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';

const initialNodes = [
  {
    id: 'fir-main',
    type: 'default',
    data: { label: 'Active FIR: CR-2026-9910 (Ahmedabad)' },
    position: { x: 250, y: 150 },
    style: { background: '#0d1322', color: '#60a5fa', border: '1px solid #3b82f6', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  },
  {
    id: 'vpa-1',
    type: 'default',
    data: { label: 'VPA: scammer@paytm (Mule Match)' },
    position: { x: 500, y: 50 },
    style: { background: '#f59e0b20', color: '#fbbf24', border: '1px solid #f59e0b', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  },
  {
    id: 'phone-1',
    type: 'default',
    data: { label: 'Phone: +91 98765 43210 (Suspect Line)' },
    position: { x: 500, y: 250 },
    style: { background: '#0d1322', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  },
  {
    id: 'fir-linked-1',
    type: 'default',
    data: { label: 'Linked FIR: CR-2026-0812 (Surat Cyber)' },
    position: { x: 780, y: 50 },
    style: { background: '#f43f5e20', color: '#fda4af', border: '1px solid #f43f5e', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  },
  {
    id: 'fir-linked-2',
    type: 'default',
    data: { label: 'Linked FIR: CR-2026-0441 (Rajkot Rural)' },
    position: { x: 780, y: 250 },
    style: { background: '#f43f5e20', color: '#fda4af', border: '1px solid #f43f5e', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', padding: '10px' }
  }
];

const initialEdges = [
  { id: 'e1', source: 'fir-main', target: 'vpa-1', label: 'USED_IN_TRANSACTION', animated: true, style: { stroke: '#f59e0b' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' } },
  { id: 'e2', source: 'fir-main', target: 'phone-1', label: 'SUSPECT_CONTACT', style: { stroke: '#38bdf8' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' } },
  { id: 'e3', source: 'vpa-1', target: 'fir-linked-1', label: 'RECURRING_MULE (94%)', animated: true, style: { stroke: '#f43f5e' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' } },
  { id: 'e4', source: 'phone-1', target: 'fir-linked-2', label: 'CDR_RECURRENCE (88%)', animated: true, style: { stroke: '#f43f5e' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f43f5e' } }
];

export default function LinkageView() {
  const navigate = useNavigate();
  const { activeCase, setSelectedInspectorItem } = useCaseStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as any);

  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClick = (_: any, node: any) => {
    setSelectedInspectorItem({
      type: 'TOPOLOGY_NODE_INSPECTOR',
      data: {
        node_id: node.id,
        label: node.data.label,
        similarity_match: '94% Confidence (Qdrant bge-m3 Vector Match)',
        linked_fir: 'CR-2026-0812 (Surat City Cyber Cell)',
        action_recommended: 'Issue Section 94 BNSS Legal Notice to Paytm Nodal Officer.'
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Module 2: Serial Offender Qdrant Topology Link Graph Canvas
          </h1>
          <p className="text-xs text-slate-400">
            Automatically queries Qdrant vector store to match suspect VPAs, phone numbers, and bank accounts across historical Gujarat FIRs.
          </p>
        </div>

        <button
          onClick={() => navigate('/investigation')}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          <span>Proceed to Module 3: Agent Studio</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main Split: React Flow Canvas & Summary */}
      <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden">
        
        {/* React Flow Topology Canvas (2 Columns) */}
        <div className="col-span-2 rounded border border-white/10 bg-[#050811] flex flex-col overflow-hidden relative">
          <div className="h-8 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] z-10 shrink-0">
            <span className="text-xs font-bold text-amber-400 font-mono flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" /> React Flow Topology Canvas (@xyflow/react)
            </span>
            <span className="text-[10px] font-mono text-slate-400">Click any node to inspect context</span>
          </div>

          <div className="flex-1 w-full h-full">
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
          </div>
        </div>

        {/* Intelligence Overlap Summary Card */}
        <div className="col-span-1 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-y-auto space-y-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Serial Overlap Summary
            </span>

            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1">
                <span className="text-[10px] font-bold text-amber-300 uppercase">Target VPA Recurrence</span>
                <p className="font-mono font-bold text-white">scammer@paytm</p>
                <p className="text-[11px] text-slate-300">Linked to 3 previous complaints in Surat & Rajkot (94% Match).</p>
              </div>

              <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5 space-y-1">
                <span className="text-[10px] font-bold text-blue-300 uppercase">Phone CDR Recurrence</span>
                <p className="font-mono font-bold text-white">+91 98765 43210</p>
                <p className="text-[11px] text-slate-300">Matched active suspect line in Rajkot Rural (88% Match).</p>
              </div>

              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-1">
                <span className="text-[10px] font-bold text-emerald-300 uppercase">Beneficiary Account</span>
                <p className="font-mono font-bold text-white">SBI 30910293101</p>
                <p className="text-[11px] text-slate-300">Section 94 BNSS Notice issued for instant freeze.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/investigation')}
            className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
          >
            <span>Proceed to Module 3: Agent Studio</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>

    </div>
  );
}
