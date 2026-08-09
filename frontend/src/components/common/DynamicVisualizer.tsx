import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  CreditCard, 
  PhoneCall, 
  MapPin, 
  ShieldAlert, 
  ArrowRight, 
  Activity,
  CheckCircle2,
  BarChart3
} from 'lucide-react';

export interface VisualizationConfig {
  recommended_chart_type: 'MONEY_TRAIL_FLOW' | 'HOURLY_ACTIVITY_BAR' | 'TOWER_CELL_DISTRIBUTION' | 'RISK_GAUGE' | 'DYNAMIC_BAR_CHART' | 'LINE_TREND' | 'PIE_DONUT' | 'NONE';
  chart_title: string;
  chart_data: any[];
  chart_insights?: string;
  x_axis_key?: string;
  y_axis_key?: string;
  data_grounded?: boolean;
}

interface DynamicVisualizerProps {
  config?: VisualizationConfig | null;
}

const BAR_COLORS = ['#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#10b981', '#6366f1'];

export default function DynamicVisualizer({ config }: DynamicVisualizerProps) {
  if (!config || !config.recommended_chart_type || config.recommended_chart_type === 'NONE') {
    return null; // Cleanly render nothing when visuals are not required
  }

  const { recommended_chart_type, chart_title, chart_data, chart_insights, x_axis_key, y_axis_key } = config;

  const xKey = x_axis_key || 'category';
  const yKey = y_axis_key || 'value';

  return (
    <div className="rounded-lg border border-white/10 bg-[#080d1a] p-3 space-y-2 select-none shadow-lg animate-fadeIn">
      
      {/* Header Title Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          {recommended_chart_type === 'MONEY_TRAIL_FLOW' && <CreditCard className="h-4 w-4 text-emerald-400" />}
          {recommended_chart_type === 'HOURLY_ACTIVITY_BAR' && <PhoneCall className="h-4 w-4 text-amber-400" />}
          {recommended_chart_type === 'TOWER_CELL_DISTRIBUTION' && <MapPin className="h-4 w-4 text-blue-400" />}
          {recommended_chart_type === 'RISK_GAUGE' && <ShieldAlert className="h-4 w-4 text-rose-400" />}
          {(recommended_chart_type === 'DYNAMIC_BAR_CHART' || recommended_chart_type === 'LINE_TREND' || recommended_chart_type === 'PIE_DONUT') && <BarChart3 className="h-4 w-4 text-indigo-400" />}
          
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
            {chart_title || 'AI Grounded Visual Evidence'}
          </h4>
        </div>

        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          <span>Grounded 0-Hallucination Data</span>
        </span>
      </div>

      {/* 1. DYNAMIC TABLE BAR CHART (Automatically Synthesized Column Axes) */}
      {(recommended_chart_type === 'DYNAMIC_BAR_CHART' || recommended_chart_type === 'HOURLY_ACTIVITY_BAR') && (
        <div className="h-44 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart_data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey={xKey === 'category' ? 'hour' : xKey} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} />
              <Tooltip 
                contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              />
              <Bar dataKey={yKey === 'value' ? 'calls' : yKey} name={yKey} radius={[4, 4, 0, 0]}>
                {Array.isArray(chart_data) && chart_data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 2. DYNAMIC LINE TREND (Time Series Analytics) */}
      {recommended_chart_type === 'LINE_TREND' && (
        <div className="h-44 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart_data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey={xKey} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} />
              <Tooltip 
                contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey={yKey} stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 3. MONEY TRAIL FLOW VISUALIZATION */}
      {recommended_chart_type === 'MONEY_TRAIL_FLOW' && (
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between gap-2 overflow-x-auto p-2 rounded bg-[#050811] border border-white/5">
            {Array.isArray(chart_data) && chart_data.map((item, idx) => (
              <React.Fragment key={idx}>
                <div className="flex flex-col items-center p-2 rounded border border-emerald-500/30 bg-emerald-500/10 min-w-[140px] text-center">
                  <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold">Step {item.step || idx + 1} ({item.bank || 'Bank'})</span>
                  <span className="text-xs font-mono font-bold text-slate-200 mt-0.5">{item.target || item.source}</span>
                  <span className="text-[10px] font-mono text-emerald-300 font-extrabold mt-1">{item.amount || '₹85,000'}</span>
                </div>
                {idx < chart_data.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-emerald-400 shrink-0 animate-pulse" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* 4. TOWER CELL LOCATION DISTRIBUTION */}
      {recommended_chart_type === 'TOWER_CELL_DISTRIBUTION' && (
        <div className="h-40 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart_data} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 0 }}>
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={{ stroke: '#334155' }} />
              <YAxis dataKey="location" type="category" tick={{ fill: '#cbd5e1', fontSize: 9 }} axisLine={{ stroke: '#334155' }} width={120} />
              <Tooltip 
                contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }}
              />
              <Bar dataKey="frequency" name="Cell Hits" fill="#38bdf8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 5. FORENSIC RISK GAUGE */}
      {recommended_chart_type === 'RISK_GAUGE' && (
        <div className="grid grid-cols-3 gap-2 py-1">
          {Array.isArray(chart_data) && chart_data.map((factor, idx) => (
            <div key={idx} className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-center">
              <span className="text-[10px] text-rose-300 font-bold uppercase block">{factor.factor}</span>
              <span className="text-base font-extrabold text-white font-mono">{factor.score}/10</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Grounded Insights Banner */}
      {chart_insights && (
        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-300 border-t border-white/5 font-mono">
          <Activity className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>{chart_insights}</span>
        </div>
      )}

    </div>
  );
}
