import React from 'react';
import { ShieldCheck, Database, Gavel, BookOpen, Phone, CreditCard, Building, AlertTriangle, MapPin, User, Network, FileText, Target, Clock, ArrowRight } from 'lucide-react';
import { useCaseStore } from '../../store/caseStore';

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 85 ? 'emerald' : pct >= 70 ? 'amber' : 'rose';
  return (
    <span className={`inline-flex items-center gap-1 rounded border border-${color}-500/40 bg-${color}-500/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-${color}-300`}>
      {pct}% Match
    </span>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pb-1.5 border-b border-white/5 mb-2">
      {label}
    </span>
  );
}

function renderComplaintEntities(data: any) {
  return (
    <div className="space-y-3">
      {/* Complaint Header */}
      <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
            Complaint Extraction
          </span>
          {data.severity_score && (
            <span className="rounded bg-rose-500/20 text-rose-300 px-1.5 py-0.5 text-[10px] font-bold font-mono">
              Sev: {data.severity_score}/10
            </span>
          )}
        </div>
        {data.complaint_number && (
          <p className="font-mono text-[11px] font-bold text-white">{data.complaint_number}</p>
        )}
      </div>

      {/* Crime Classification */}
      {(data.crime_category || data.crime_sub_type) && (
        <div className="space-y-1">
          <SectionLabel label="Crime Classification" />
          <div className="rounded border border-white/10 bg-[#050811] p-2 space-y-1.5">
            {data.crime_category && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Category</span>
                <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-300">{data.crime_category}</span>
              </div>
            )}
            {data.crime_sub_type && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Sub-Type</span>
                <span className="text-[11px] font-semibold text-white">{data.crime_sub_type}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* English Narrative */}
      {data.translated_text && (
        <div className="space-y-1">
          <SectionLabel label="Translated Narrative" />
          <p className="rounded border border-white/10 bg-[#050811] p-2 text-[11px] text-slate-300 leading-relaxed font-sans">
            {data.translated_text}
          </p>
        </div>
      )}

      {/* Extracted Entities */}
      {data.entities && (
        <div className="space-y-1">
          <SectionLabel label="Extracted Entities" />
          <div className="space-y-1.5">
            {/* Persons */}
            {data.entities.persons?.map((p: any, i: number) => (
              <div key={`p-${i}`} className="flex items-center gap-2 rounded border border-white/10 bg-[#050811] px-2.5 py-1.5">
                <User className="h-3 w-3 text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-white block truncate">{p.name}</span>
                  <span className="text-[10px] text-violet-300 font-mono uppercase">{p.role}</span>
                </div>
              </div>
            ))}

            {/* Phone Numbers */}
            {data.entities.phone_numbers?.map((phone: string, i: number) => (
              <div key={`ph-${i}`} className="flex items-center gap-2 rounded border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5">
                <Phone className="h-3 w-3 text-cyan-400 shrink-0" />
                <span className="text-[11px] font-mono font-bold text-cyan-200">{phone}</span>
              </div>
            ))}

            {/* UPI VPAs */}
            {data.entities.vpas_upis?.map((vpa: string, i: number) => (
              <div key={`v-${i}`} className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
                <CreditCard className="h-3 w-3 text-amber-400 shrink-0" />
                <span className="text-[11px] font-mono font-bold text-amber-200">{vpa}</span>
              </div>
            ))}

            {/* Bank Accounts */}
            {data.entities.bank_accounts?.map((b: any, i: number) => (
              <div key={`b-${i}`} className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 space-y-0.5">
                <div className="flex items-center gap-2">
                  <Building className="h-3 w-3 text-indigo-400 shrink-0" />
                  <span className="text-[11px] font-mono font-bold text-indigo-200">
                    {typeof b === 'object' ? b.account_number : b}
                  </span>
                </div>
                {typeof b === 'object' && (
                  <div className="ml-5 text-[10px] text-slate-400 font-mono space-y-0.5">
                    {b.bank && <div>{b.bank}</div>}
                    {b.ifsc && <div>IFSC: {b.ifsc}</div>}
                    {b.account_name && <div>Name: {b.account_name}</div>}
                  </div>
                )}
              </div>
            ))}

            {/* Monetary Loss */}
            {data.entities.monetary_loss != null && (
              <div className="flex items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5">
                <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                <span className="text-[11px] font-mono font-bold text-rose-200">Loss: ₹{data.entities.monetary_loss.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderSOPCitation(data: any) {
  return (
    <div className="space-y-3">
      {/* Step Header */}
      <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5 space-y-1">
        <div className="flex items-center gap-2">
          {data.step_number && (
            <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-600/30 text-[10px] font-bold text-blue-300 font-mono shrink-0">
              {data.step_number}
            </span>
          )}
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
            SOP Directive
          </span>
        </div>
        <h3 className="text-xs font-bold text-white leading-snug">{data.title}</h3>
      </div>

      {/* Description */}
      {data.description && (
        <div className="space-y-1">
          <SectionLabel label="Action Description" />
          <p className="rounded border border-white/10 bg-[#050811] p-2 text-[11px] text-slate-300 leading-relaxed font-sans">
            {data.description}
          </p>
        </div>
      )}

      {/* Source Document Citation */}
      {(data.document_name || data.sop_reference) && (
        <div className="space-y-1">
          <SectionLabel label="Source Document" />
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-2">
            {data.document_name && (
              <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-amber-300">
                <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{data.document_name}</span>
              </div>
            )}
            {data.page_number && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Page Number</span>
                <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">{data.page_number}</span>
              </div>
            )}
            {data.sop_reference && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">SOP Reference</span>
                <span className="font-mono font-bold text-emerald-300 text-[10px]">{data.sop_reference}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section Path */}
      {data.section_path && (
        <div className="space-y-1">
          <SectionLabel label="Section Path" />
          <div className="rounded border border-indigo-500/30 bg-indigo-500/10 p-2.5">
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3 w-3 text-indigo-400 shrink-0 mt-0.5" />
              <span className="text-[11px] font-mono text-indigo-200 leading-relaxed">{data.section_path}</span>
            </div>
          </div>
        </div>
      )}

      {/* Raw Citation Text */}
      {data.raw_citation_text && (
        <div className="space-y-1">
          <SectionLabel label="Verbatim Citation" />
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5">
            <p className="text-[11px] text-emerald-100 italic leading-relaxed font-serif">
              "{data.raw_citation_text}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function renderTopologyNode(data: any) {
  return (
    <div className="space-y-3">
      {/* Node Identity */}
      <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-1.5">
        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
          Linked Entity
        </span>
        <p className="text-xs font-bold text-white">{data.label || data.entity_value || 'Unknown'}</p>
      </div>

      {/* Match Confidence */}
      {data.similarity_match && (
        <div className="space-y-1">
          <SectionLabel label="Match Confidence" />
          <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5">
            <p className="text-[11px] font-mono font-bold text-emerald-300">{data.similarity_match}</p>
          </div>
        </div>
      )}

      {/* Linked FIR */}
      {data.linked_fir && (
        <div className="space-y-1">
          <SectionLabel label="Linked FIR" />
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2.5">
            <p className="text-[11px] font-mono font-bold text-rose-200">{data.linked_fir}</p>
          </div>
        </div>
      )}

      {/* Recommended Action */}
      {data.action_recommended && (
        <div className="space-y-1">
          <SectionLabel label="Recommended Action" />
          <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5">
            <div className="flex items-start gap-1.5">
              <ArrowRight className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200 leading-relaxed">{data.action_recommended}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderLinkageNode(data: any) {
  const entityIcons: Record<string, typeof Phone> = {
    phone: Phone, vpa: CreditCard, bank_account: Building, manual: Target
  };
  const entityColors: Record<string, string> = {
    phone: 'cyan', vpa: 'amber', bank_account: 'indigo', manual: 'violet'
  };
  const Icon = entityIcons[data.entity_type] || Network;
  const color = entityColors[data.entity_type] || 'blue';

  return (
    <div className="space-y-3">
      {/* Entity Header */}
      <div className={`rounded border border-${color}-500/30 bg-${color}-500/10 p-2.5 space-y-1.5`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold text-${color}-300 uppercase tracking-wider flex items-center gap-1`}>
            <Icon className="h-3 w-3" /> {data.entity_type?.replace('_', ' ') || 'Entity'}
          </span>
          {data.confidence != null && <ConfidenceBadge confidence={data.confidence} />}
        </div>
        <p className="text-xs font-mono font-bold text-white">{data.entity_value}</p>
      </div>

      {/* Match Type */}
      {data.match_type && (
        <div className="space-y-1">
          <SectionLabel label="Match Classification" />
          <div className="rounded border border-white/10 bg-[#050811] p-2">
            <span className="text-[11px] font-mono font-bold text-emerald-300">{data.match_type}</span>
          </div>
        </div>
      )}

      {/* Linked Case Details */}
      {(data.matched_case || data.matched_fir) && (
        <div className="space-y-1">
          <SectionLabel label="Linked Case" />
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-2.5 space-y-1">
            {data.matched_case && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Case No.</span>
                <span className="font-mono font-bold text-rose-200">{data.matched_case}</span>
              </div>
            )}
            {data.matched_fir && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">FIR No.</span>
                <span className="font-mono font-bold text-rose-200">{data.matched_fir}</span>
              </div>
            )}
            {data.police_station && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Station</span>
                <span className="font-semibold text-white text-[10px]">{data.police_station}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {data.description && (
        <div className="space-y-1">
          <SectionLabel label="Intelligence Summary" />
          <p className="rounded border border-white/10 bg-[#050811] p-2 text-[11px] text-slate-300 leading-relaxed">
            {data.description}
          </p>
        </div>
      )}

      {/* Recommended Action */}
      {data.recommended_action && (
        <div className="space-y-1">
          <SectionLabel label="Recommended Action" />
          <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2.5">
            <div className="flex items-start gap-1.5">
              <ArrowRight className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200 leading-relaxed">{data.recommended_action}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderInspectorContent(item: any) {
  if (!item) return null;
  const { type, data } = item;

  switch (type) {
    case 'COMPLAINT_ENTITY_EXTRACTION':
      return renderComplaintEntities(data);
    case 'SOP_CITATION_INSPECTOR':
      return renderSOPCitation(data);
    case 'TOPOLOGY_NODE_INSPECTOR':
      return renderTopologyNode(data);
    case 'LINKAGE_NODE_INSPECTOR':
      return renderLinkageNode(data);
    default:
      // Graceful fallback for unknown types — still better than raw JSON
      return (
        <div className="space-y-3">
          <div className="rounded border border-slate-500/30 bg-slate-500/10 p-2.5 space-y-1">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
              {type}
            </span>
          </div>
          {Object.entries(data || {}).map(([key, val]) => (
            <div key={key} className="rounded border border-white/10 bg-[#050811] p-2 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
              <p className="text-[11px] font-mono text-white break-all">
                {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
              </p>
            </div>
          ))}
        </div>
      );
  }
}

export default function InspectorDrawer() {
  const { activeCase, selectedInspectorItem } = useCaseStore();

  return (
    <aside className="w-80 h-full border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] text-slate-900 dark:text-slate-100 flex flex-col shrink-0 select-none overflow-hidden shadow-sm">
      
      {/* Header */}
      <div className="h-10 border-b border-slate-200 dark:border-white/10 px-3 flex items-center justify-between bg-slate-50 dark:bg-[#080d1a] shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          Intelligence Inspector
        </span>
        <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400">
          {activeCase?.case_number || 'CR-2026-9910'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        
        {selectedInspectorItem ? (
          renderInspectorContent(selectedInspectorItem)
        ) : (
          <>
            {/* Active FIR Context */}
            <div className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-1.5">
                <span>FIR: {activeCase?.fir_number || 'FIR-042/2026'}</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-mono">Severity {activeCase?.severity_score || 9.2}</span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-400 leading-relaxed font-sans">
                {activeCase?.translated_text}
              </p>
              <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Category: {activeCase?.crime_category}</span>
                <span>IO: {activeCase?.assigned_io}</span>
              </div>
            </div>

            {/* Extracted Entities List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Extracted Grounded Entities
              </span>

              <div className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Target Phone</span>
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400">
                    {activeCase?.entities?.phone_numbers?.[0] || '+91 98765 43210'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Target UPI VPA</span>
                  <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                    {activeCase?.entities?.vpas_upis?.[0] || 'scammer@paytm'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Monetary Loss</span>
                  <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400">
                    ₹{activeCase?.entities?.monetary_loss || 200000}
                  </span>
                </div>
              </div>
            </div>

            {/* Statutory Grounding */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                Statutory Penal Sections
              </span>

              <div className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 space-y-1.5">
                {activeCase?.sections?.map((sec: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] font-mono text-slate-800 dark:text-slate-300">
                    <Gavel className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{sec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Judicial Certificate Guard */}
            <div className="rounded border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3 space-y-1">
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                Section 63 BSA Hash Certifier
              </span>
              <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                SHA-256 digital certificate ready for judicial submission.
              </p>
            </div>
          </>
        )}

      </div>

    </aside>
  );
}
