import React from 'react';
import { 
  Database, 
  Sparkles, 
  ShieldAlert, 
  UserCheck, 
  FileCheck, 
  CheckCircle2, 
  Layers
} from 'lucide-react';

export default function AgentFlowGraph({ activeStep = 4, status = 'APPROVED' }) {
  const steps = [
    { id: 1, title: 'Multimodal Ingestion', desc: 'PDF / Audio / Vision Parser', icon: Database },
    { id: 2, title: 'Cross-Case Memory', desc: 'Qdrant Serial Offender Link', icon: Layers },
    { id: 3, title: 'Specialist Pods', desc: 'BNS, BSA, Cyber Parallel', icon: Sparkles },
    { id: 4, title: 'Evaluator Anti-Laziness', desc: 'Grounding & Quality Filter', icon: ShieldAlert },
    { id: 5, title: 'HITL Review', desc: 'Officer Approval', icon: UserCheck },
    { id: 6, title: 'Synthesis & PDF', desc: 'Master FIR & Sec 94 Notice', icon: FileCheck }
  ];

  return (
    <div className="glass-panel rounded-2xl p-5 mb-6">
      
      {/* Graph Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          LangGraph Multi-Agent Execution Pipeline
        </h2>

        <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
          status === 'APPROVED'
            ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-glow-emerald'
            : 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
        }`}>
          <CheckCircle2 className="h-3 w-3" />
          {status === 'APPROVED' ? 'EVALUATOR PASSED' : 'REJECTED (RETRYING)'}
        </span>
      </div>

      {/* Steps Pipeline Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((step) => {
          const isCompleted = step.id <= activeStep;
          const isCurrent = step.id === activeStep;
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className={`relative rounded-xl p-3 text-center transition-all ${
                isCurrent
                  ? 'border border-cyan-500/60 bg-cyan-500/20 text-white shadow-glow-cyan'
                  : isCompleted
                  ? 'border border-emerald-500/30 bg-emerald-500/10 text-slate-200'
                  : 'border border-slate-800 bg-slate-950/40 text-slate-500'
              }`}
            >
              <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${
                isCurrent
                  ? 'bg-cyan-500/30 text-cyan-300'
                  : isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-900 text-slate-500'
              }`}>
                <StepIcon className="h-4 w-4" />
              </div>

              <h3 className="text-xs font-bold leading-tight">{step.title}</h3>
              <p className="mt-1 text-[10px] text-slate-400 truncate">{step.desc}</p>
            </div>
          );
        })}
      </div>

    </div>
  );
}
