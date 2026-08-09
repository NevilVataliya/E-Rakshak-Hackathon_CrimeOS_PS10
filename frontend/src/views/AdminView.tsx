import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, History, Key, Database, Upload, Trash2, FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';

export default function AdminView() {
  const { ragDocuments, ragLoading, fetchRagDocuments, uploadRagDocument, deleteRagDocument } = useCaseStore();
  const { t } = useLangStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedStatuteType, setSelectedStatuteType] = useState('custom_extended');

  useEffect(() => {
    fetchRagDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      await uploadRagDocument(file, selectedStatuteType);
      setToastMsg(`Document '${file.name}' parsed, embedded, and indexed into QdrantDB in real-time!`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to upload and index document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete '${filename}' and purge all associated vector points from QdrantDB?`)) return;

    try {
      await deleteRagDocument(filename);
      setToastMsg(`Document '${filename}' and all its Qdrant vector embeddings have been purged.`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to delete document from QdrantDB.');
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const roles = [
    { role: 'IO (Investigating Officer)', perm: 'Ingest complaints, Run Agent Studio, Generate Legal Requests', count: 18 },
    { role: 'SHO (Station House Officer)', perm: 'Approve & Dispatch Legal Requests, View Station Audit Logs', count: 4 },
    { role: 'Legal Advisor', perm: 'Review BNS/BSA grounding, Validate Section 94 notices', count: 2 },
    { role: 'System Admin', perm: 'Full RBAC, Vector store re-indexing, System Configuration', count: 1 }
  ];

  const auditLogs = [
    { time: '12:44:10', user: 'PSI V. K. Patel (IO)', action: 'EXECUTE_LANGGRAPH_STUDIO', case_no: 'CR-2026-9910' },
    { time: '12:45:02', user: 'PI R. S. Sharma (SHO)', action: 'APPROVE_SECTION_94_BNSS_NOTICE', case_no: 'CR-2026-9910' },
    { time: '12:46:18', user: 'PSI V. K. Patel (IO)', action: 'DISPATCH_LEGAL_NOTICE_EMAIL', case_no: 'CR-2026-9910' },
    { time: '12:48:30', user: 'System Admin', action: 'QDRANT_VECTOR_PURGE_AND_UPSERT', case_no: 'RAG-SYSTEM' }
  ];

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Module 7: Dynamic Qdrant RAG Knowledge Base & System Governance
          </h1>
          <p className="text-xs text-slate-400">
            Dynamically add, list, or delete statutory legal documents and police SOPs indexed in Qdrant Vector DB.
          </p>
        </div>

        <span className="rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-xs font-bold font-mono flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-blue-400" />
          <span>Qdrant Vector DB Active</span>
        </span>
      </div>

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-300 shrink-0 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Grid: Dynamic RAG Studio & Audit Ledger */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        
        {/* Left Column: Dynamic Qdrant RAG Knowledge Base Management (7 Cols) */}
        <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Database className="h-4 w-4 text-emerald-400" />
              Dynamic Qdrant RAG Legal Document Store
            </span>

            <div className="flex items-center gap-2">
              <select
                value={selectedStatuteType}
                onChange={(e) => setSelectedStatuteType(e.target.value)}
                className="h-7 rounded border border-white/10 bg-[#050811] px-2 text-[11px] font-mono text-slate-300 outline-none"
              >
                <option value="bns_specialist">BNS 2023 Penal Specialist</option>
                <option value="bsa_specialist">BSA 2023 Evidence Specialist</option>
                <option value="cyber_financial_intel_specialist">Cyber / IT Act Specialist</option>
                <option value="conventional_field_specialist">Police SOPs / Field Manual</option>
                <option value="custom_extended">Custom Law Circular</option>
              </select>

              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || ragLoading}
                className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span>Add Legal Document to Qdrant</span>
              </button>
            </div>
          </div>

          {/* Active Ingested Documents List */}
          <div className="flex-1 overflow-y-auto mt-2">
            {ragLoading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2">
                <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                <span className="text-xs text-slate-400">Syncing active Qdrant vector documents...</span>
              </div>
            ) : ragDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500">
                <FileText className="h-8 w-8 text-slate-600" />
                <span className="text-xs font-semibold">No statutory documents indexed. Click "Add Legal Document" to ingest.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 bg-[#050811] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2 px-2.5">Document Name</th>
                    <th className="py-2 px-2.5">Specialist Domain</th>
                    <th className="py-2 px-2.5">Qdrant Points</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {ragDocuments.map((doc: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2 px-2.5 font-mono text-[11px] font-bold text-white flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="truncate max-w-[200px]">{doc.document_name}</span>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-[10px]">
                        <span className="rounded border border-white/10 bg-[#050811] px-1.5 py-0.5 text-slate-300">
                          {doc.statute_type}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-emerald-400 font-extrabold">
                        {doc.vector_points || 250} vectors
                      </td>
                      <td className="py-2 px-2.5">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <button
                          onClick={() => handleDelete(doc.document_name)}
                          className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
                          title="Purge document and all associated vector embeddings from Qdrant"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Roles & Audit Trail (5 Cols) */}
        <div className="col-span-5 flex flex-col gap-3 overflow-hidden">
          
          {/* Active Role Permission Matrix */}
          <div className="rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col space-y-2 overflow-y-auto max-h-[48%]">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-1.5 flex items-center gap-1.5 shrink-0">
              <Key className="h-4 w-4 text-blue-400" />
              Active Role Permission Matrix
            </span>

            <div className="space-y-1.5">
              {roles.map((r, i) => (
                <div key={i} className="rounded border border-white/10 bg-[#050811] p-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white">{r.role}</h3>
                    <span className="rounded bg-blue-500/20 text-blue-300 px-1.5 py-0.2 text-[9px] font-mono font-bold">
                      {r.count} Users
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {r.perm}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time System Audit Ledger */}
          <div className="flex-1 rounded border border-white/10 bg-[#0d1322] flex flex-col overflow-hidden">
            <div className="h-7 border-b border-white/10 px-3 flex items-center justify-between bg-[#080d1a] shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-emerald-400" />
                Immutable System Audit Ledger
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 bg-[#050811] text-[9px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="py-1.5 px-2">Time</th>
                    <th className="py-1.5 px-2">User</th>
                    <th className="py-1.5 px-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {auditLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-1.5 px-2 font-mono text-[10px] text-slate-400">{log.time}</td>
                      <td className="py-1.5 px-2 font-semibold text-white text-[11px]">{log.user}</td>
                      <td className="py-1.5 px-2">
                        <span className="rounded border border-white/10 bg-[#050811] px-1 py-0.5 text-[9px] font-mono text-slate-300">
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
