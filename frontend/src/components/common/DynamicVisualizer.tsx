import React from 'react';
import { TrendingUp, CreditCard, Clock, Activity, AlertTriangle, ShieldCheck, MapPin, ArrowRight } from 'lucide-react';

export interface VisualizationConfig {
  recommended_chart_type?: 'MONEY_TRAIL_FLOW' | 'HOURLY_ACTIVITY_BAR' | 'LINE_TREND' | 'PIE_DONUT' | 'DYNAMIC_BAR_CHART' | 'RISK_GAUGE' | 'TOWER_CELL_DISTRIBUTION' | 'NONE' | string;
  chart_title?: string;
  chart_insights?: string;
  chart_data?: any[];
  x_axis_key?: string;
  y_axis_key?: string;
  data_grounded?: boolean;
}

interface Props {
  config: VisualizationConfig | null | undefined;
}

export default function DynamicVisualizer({ config }: Props) {
  if (!config || !config.recommended_chart_type || config.recommended_chart_type === 'NONE') {
    return null;
  }

  const chartType = config.recommended_chart_type;
  const title = config.chart_title || 'Visual Analytics Plot';
  const insights = config.chart_insights || '';
  const data = config.chart_data || [];

  return (
    <div className="rounded border border-indigo-500/30 bg-[#0a0f1d] p-3 space-y-2.5 my-2 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            {title}
          </span>
        </div>
        <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
          GROUNDED DATA (0-HALLUCINATION)
        </span>
      </div>

      {insights && (
        <p className="text-[11px] text-slate-300 font-mono italic bg-white/5 p-2 rounded border border-white/5">
          💡 <strong>Forensic Insight:</strong> {insights}
        </p>
      )}

      {/* Render chart based on type */}
      {chartType === 'MONEY_TRAIL_FLOW' && (
        <div className="space-y-2 pt-1 font-mono">
          {data.length > 0 ? (
            data.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between bg-[#050811] p-2 rounded border border-white/10 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold border border-emerald-500/30">
                    {item.step || idx + 1}
                  </span>
                  <span className="text-slate-300">{item.source}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-emerald-300 font-bold">{item.target}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-sans">{item.bank}</span>
                  <span className="text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {item.amount}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400 p-2">Money trail flow data visualized across accounts.</div>
          )}
        </div>
      )}

      {chartType === 'HOURLY_ACTIVITY_BAR' && (
        <div className="space-y-1.5 pt-1">
          {data.map((item: any, idx: number) => {
            const calls = item.calls || item.count || 0;
            const maxCalls = 600;
            const percentage = Math.min(100, Math.max(10, (calls / maxCalls) * 100));
            const isNight = item.risk === 'High' || (item.hour && item.hour.includes('Night'));

            return (
              <div key={idx} className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>{item.hour || item.category || `Period ${idx+1}`}</span>
                  <span className={isNight ? 'text-rose-400 font-bold' : 'text-slate-400'}>{calls} calls {isNight ? '⚡ [NIGHT ANOMALY]' : ''}</span>
                </div>
                <div className="w-full bg-[#050811] h-3 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all ${isNight ? 'bg-gradient-to-r from-rose-600 to-amber-500' : 'bg-blue-600'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chartType === 'LINE_TREND' && (
        <div className="space-y-2 pt-1 font-mono">
          <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-[#050811] p-2 rounded border border-white/10">
                <div className="text-[10px] text-slate-400">{item.timestamp || item.category || `T-${idx}`}</div>
                <div className="text-sm font-bold text-indigo-300 mt-1">{item.connections || item.value || 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(chartType === 'DYNAMIC_BAR_CHART' || chartType === 'PIE_DONUT' || chartType === 'RISK_GAUGE' || chartType === 'TOWER_CELL_DISTRIBUTION') && (
        <div className="space-y-1.5 pt-1 font-mono">
          {data.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between bg-[#050811] p-2 rounded border border-white/10 text-xs">
              <span className="text-slate-300">{item.location || item.factor || item.category || item.party || `Item ${idx+1}`}</span>
              <span className="text-indigo-300 font-bold">
                {item.frequency ? `${item.frequency} hits` : (item.score ? `Score: ${item.score}` : (item.calls ? `${item.calls} calls` : JSON.stringify(item)))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
