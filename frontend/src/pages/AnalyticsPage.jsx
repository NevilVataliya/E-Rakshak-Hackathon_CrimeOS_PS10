import React from 'react';
import { BarChart3, Network, Activity, Cpu } from 'lucide-react';
import LinkAnalysisGraph from '../components/LinkAnalysisGraph';
import ResponseAnalyticsStudio from '../components/ResponseAnalyticsStudio';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Response Analytics & Serial Link Engine
          </h1>
          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-bold text-cyan-400">
            <Cpu className="h-3.5 w-3.5" /> High-Scale Data Analysis
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Hybrid Pandas pre-aggregation + LLM response agent for large CSVs/Excels (50,000+ rows) and serial offender linkages.
        </p>
      </div>

      {/* Response Analytics Studio Component */}
      <ResponseAnalyticsStudio caseNumber="CR-2026-9910" />

      {/* Qdrant Serial Link Graph Component */}
      <LinkAnalysisGraph />

    </div>
  );
}
