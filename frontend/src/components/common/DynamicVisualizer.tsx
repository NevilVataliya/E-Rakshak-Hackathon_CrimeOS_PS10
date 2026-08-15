import React from 'react';
import { TrendingUp, CreditCard, Clock, Activity, AlertTriangle, ShieldCheck, MapPin, ArrowRight, Lightbulb, Zap, ShieldAlert, Cpu } from 'lucide-react';

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
  if (!config || !config.recommended_chart_type || config.recommended_chart_type === 'NONE' || !config.chart_data || config.chart_data.length === 0) {
    return null;
  }

  const chartType = config.recommended_chart_type;
  const title = config.chart_title || 'Visual Evidence Plot';
  const insights = config.chart_insights || '';
  const data = config.chart_data || [];

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-[#0a0f1d] p-4 space-y-3 my-2 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            {title}
          </span>
        </div>
        <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          GROUNDED FORENSIC DATA
        </span>
      </div>

      {insights && (
        <div className="text-[11px] text-slate-800 dark:text-slate-200 font-mono bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20 flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-900 dark:text-amber-300">Forensic Pattern Insight: </strong>
            <span>{insights}</span>
          </div>
        </div>
      )}

      {/* 1. Money Trail Flow */}
      {chartType === 'MONEY_TRAIL_FLOW' && (
        <div className="space-y-2 pt-1 font-mono">
          {data.length > 0 ? (
            data.map((item: any, idx: number) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 dark:bg-[#050811] p-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs shadow-sm gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 flex items-center justify-center text-[11px] font-black border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                    {item.step || idx + 1}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">{item.source}</span>
                  <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 animate-pulse" />
                  <span className="text-emerald-800 dark:text-emerald-300 font-black bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/30">{item.target}</span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded">{item.bank}</span>
                  <span className="text-emerald-900 dark:text-emerald-300 font-black bg-emerald-100 dark:bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-500/30 text-xs">
                    {item.amount}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 p-3 text-center">No money trail hops registered in response dataset.</div>
          )}
        </div>
      )}

      {/* 2. Hourly Activity Bar Chart with Midnight Anomaly Highlighter */}
      {chartType === 'HOURLY_ACTIVITY_BAR' && (
        <div className="space-y-2 pt-1 font-mono">
          {(() => {
            const maxVal = Math.max(...data.map((d: any) => d.calls || d.count || 0), 1);
            return data.map((item: any, idx: number) => {
              const calls = item.calls || item.count || 0;
              const percentage = calls === 0 ? 0 : Math.min(100, Math.max(3, (calls / maxVal) * 100));
              const isNight = item.risk === 'High' || (item.hour && (item.hour.startsWith('22:') || item.hour.startsWith('23:') || item.hour.startsWith('00:') || item.hour.startsWith('01:') || item.hour.startsWith('02:') || item.hour.startsWith('03:') || item.hour.startsWith('04:') || item.hour.startsWith('05:')) && calls > 0);

              return (
                <div key={idx} className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.hour || item.category || `Period ${idx+1}`}</span>
                    <span className={isNight ? 'text-rose-700 dark:text-rose-400 font-black flex items-center gap-1' : 'text-slate-600 dark:text-slate-400 font-bold'}>
                      {calls} calls {isNight && <span className="text-[10px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-500/30">[NIGHT BURST]</span>}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-[#050811] h-3 rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                    {percentage > 0 && (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isNight ? 'bg-gradient-to-r from-rose-600 via-amber-500 to-rose-500' : 'bg-gradient-to-r from-blue-600 to-indigo-500'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* 3. Time Series Velocity Line Trend */}
      {chartType === 'LINE_TREND' && (
        <div className="space-y-2 pt-1 font-mono">
          {(() => {
            const maxConns = Math.max(...data.map((d: any) => d.connections || d.value || 0), 1);
            const displayItems = data.filter((item: any) => (item.connections || item.value || 0) > 0).length >= 1
              ? data.filter((item: any) => (item.connections || item.value || 0) > 0)
              : data.slice(0, 8);

            return (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 text-center text-xs">
                {displayItems.map((item: any, idx: number) => {
                  const val = item.connections || item.value || 0;
                  const isHigh = val >= (maxConns * 0.7);
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border shadow-sm transition-all ${
                        isHigh
                          ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-500/40 ring-1 ring-purple-400/30'
                          : 'bg-slate-50 dark:bg-[#050811] border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">{item.timestamp || item.category || `T-${idx}`}</div>
                      <div className={`text-sm font-black mt-1 ${isHigh ? 'text-purple-900 dark:text-purple-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                        {val}
                      </div>
                      <div className="text-[9px] text-slate-400">events</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. Categorical / Cell Tower Distribution */}
      {(chartType === 'DYNAMIC_BAR_CHART' || chartType === 'PIE_DONUT' || chartType === 'RISK_GAUGE' || chartType === 'TOWER_CELL_DISTRIBUTION') && (
        <div className="space-y-1.5 pt-1 font-mono">
          {data.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-[#050811] p-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs shadow-sm">
              <span className="text-slate-800 dark:text-slate-200 font-semibold">{item.location || item.factor || item.category || item.party || `Item ${idx+1}`}</span>
              <span className="text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20">
                {item.frequency ? `${item.frequency} hits` : (item.score ? `Score: ${item.score}` : (item.calls ? `${item.calls} calls` : JSON.stringify(item)))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
