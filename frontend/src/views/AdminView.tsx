import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, History, Key, Database, Upload, Trash2, FileText, CheckCircle2, Loader2, Sparkles, Building2, Plus, Search, Mail, ShieldAlert, X } from 'lucide-react';
import { useCaseStore } from '../store/caseStore';
import { useLangStore } from '../store/langStore';
import { NodalAuthority } from '../types';

export default function AdminView() {
  const {
    ragDocuments,
    ragLoading,
    fetchRagDocuments,
    uploadRagDocument,
    deleteRagDocument,
    authorities,
    authoritiesLoading,
    fetchAuthorities,
    addAuthority,
    deleteAuthority,
    ragCollections,
    ragDomains,
    fetchRagCollections,
    fetchRagDomains
  } = useCaseStore();
  const { t } = useLangStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'rag' | 'authorities'>('authorities');
  const [toastMsg, setToastMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedStatuteType, setSelectedStatuteType] = useState('bns_specialist');
  const [customDomainName, setCustomDomainName] = useState('');

  // Authorities workbench state
  const [authSearch, setAuthSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAuth, setNewAuth] = useState<NodalAuthority>({
    key: '',
    entity_name: '',
    email: '',
    type: 'bank',
    department: '',
    description: ''
  });

  useEffect(() => {
    fetchRagDocuments();
    fetchAuthorities();
    fetchRagCollections();
    fetchRagDomains();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      const targetDomain = selectedStatuteType === 'custom_new' && customDomainName.trim()
        ? customDomainName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
        : selectedStatuteType;

      await uploadRagDocument(file, targetDomain);
      await fetchRagDomains();
      await fetchRagCollections();
      setToastMsg(`Document '${file.name}' parsed, embedded, and indexed into QdrantDB under domain '${targetDomain}'!`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to upload and index document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleDeleteRag = async (filename: string) => {
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

  const handleAddAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuth.key || !newAuth.entity_name || !newAuth.email) {
      alert('Authority Key, Entity Name, and Email are required.');
      return;
    }
    try {
      await addAuthority(newAuth);
      setToastMsg(`Nodal Authority '${newAuth.entity_name}' registered successfully!`);
      setShowAddModal(false);
      setNewAuth({ key: '', entity_name: '', email: '', type: 'bank', department: '', description: '' });
    } catch (err: any) {
      alert(`Failed to add authority: ${err.message || err}`);
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleDeleteAuth = async (idOrKey: string, name: string) => {
    if (!window.confirm(`Deactivate Nodal Authority '${name}'?`)) return;
    try {
      await deleteAuthority(idOrKey);
      setToastMsg(`Nodal Authority '${name}' deactivated.`);
    } catch (err: any) {
      alert(`Delete error: ${err.message || err}`);
    } finally {
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const filteredAuthorities = authorities.filter(a => {
    const matchesSearch =
      a.entity_name.toLowerCase().includes(authSearch.toLowerCase()) ||
      a.email.toLowerCase().includes(authSearch.toLowerCase()) ||
      a.key.toLowerCase().includes(authSearch.toLowerCase()) ||
      (a.department || '').toLowerCase().includes(authSearch.toLowerCase());
    const matchesType = selectedTypeFilter === 'all' || a.type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  const roles = [
    { role: 'IO (Investigating Officer)', perm: 'Ingest complaints, Run Agent Studio, Generate Legal Requests', count: 18 },
    { role: 'SHO (Station House Officer)', perm: 'Approve & Dispatch Legal Requests, View Station Audit Logs', count: 4 },
    { role: 'Legal Advisor', perm: 'Review BNS/BSA grounding, Validate Section 94 notices', count: 2 },
    { role: 'System Admin', perm: 'Full RBAC, Vector store re-indexing, Nodal Authorities Directory', count: 1 }
  ];

  const auditLogs = [
    { time: '12:44:10', user: 'PSI V. K. Patel (IO)', action: 'EXECUTE_LANGGRAPH_STUDIO', case_no: 'CR-2026-9910' },
    { time: '12:45:02', user: 'PI R. S. Sharma (SHO)', action: 'APPROVE_SECTION_94_BNSS_NOTICE', case_no: 'CR-2026-9910' },
    { time: '12:46:18', user: 'PSI V. K. Patel (IO)', action: 'DISPATCH_LEGAL_NOTICE_EMAIL', case_no: 'CR-2026-9910' },
    { time: '12:48:30', user: 'System Admin', action: 'REGISTER_NODAL_AUTHORITY_DB', case_no: 'SYSTEM-CONFIG' }
  ];

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3 select-none">
      
      {/* Header with Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Module 7: System Governance & Dynamic Nodal Directory
          </h1>
          <p className="text-xs text-slate-400">
            Manage dynamic Nodal Officer Authorities (PostgreSQL) and Qdrant RAG Legal Document Vector Store.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-white/10 bg-[#080d1a] p-1">
            <button
              onClick={() => setActiveTab('authorities')}
              className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold transition-all ${
                activeTab === 'authorities' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Nodal Authorities ({authorities.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('rag')}
              className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold transition-all ${
                activeTab === 'rag' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Qdrant Vector DB ({ragDocuments.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Toast Feedback Notification */}
      {toastMsg && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-semibold text-emerald-300 shrink-0 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        
        {/* Left Column (7 Cols) */}
        <div className="col-span-7 rounded border border-white/10 bg-[#0d1322] p-3 flex flex-col justify-between overflow-hidden">
          
          {/* TAB 1: NODAL AUTHORITIES DIRECTORY MANAGER */}
          {activeTab === 'authorities' && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-3">
              
              <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-mono">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  PostgreSQL Nodal Authorities Directory
                </span>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500 transition-colors shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Nodal Authority</span>
                </button>
              </div>

              {/* Filter Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex-1 flex items-center gap-2 rounded border border-white/10 bg-[#050811] px-2.5 py-1 text-xs">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={authSearch}
                    onChange={(e) => setAuthSearch(e.target.value)}
                    placeholder="Search entity name, email, key, or department..."
                    className="flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </div>

                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="h-7 rounded border border-white/10 bg-[#050811] px-2 text-[11px] font-mono text-slate-300 outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="bank">Banks</option>
                  <option value="telecom">Telecom Operators</option>
                  <option value="tech_platform">Tech Platforms</option>
                  <option value="corporate_regulator">Regulators / MCA</option>
                  <option value="fsl">FSL Labs</option>
                </select>
              </div>

              {/* Authorities Table */}
              <div className="flex-1 overflow-y-auto border border-white/5 rounded bg-[#050811]">
                {authoritiesLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-2">
                    <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                    <span className="text-xs text-slate-400">Loading dynamic nodal authorities from PostgreSQL...</span>
                  </div>
                ) : filteredAuthorities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-500">
                    <Building2 className="h-8 w-8 text-slate-600" />
                    <span className="text-xs font-semibold">No authorities match your filter. Click "Add Nodal Authority" to create one.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-white/10 bg-[#080d1a] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2 px-2.5">Entity / Key</th>
                        <th className="py-2 px-2.5">Nodal Email</th>
                        <th className="py-2 px-2.5">Category</th>
                        <th className="py-2 px-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAuthorities.map((auth, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-2 px-2.5 font-mono">
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-[11px] flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                {auth.entity_name}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">Key: '{auth.key}' • {auth.department || 'Compliance Cell'}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[11px] text-emerald-300">
                            <div className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>{auth.email}</span>
                            </div>
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[10px]">
                            <span className="rounded border border-white/10 bg-[#0d1322] px-1.5 py-0.5 text-slate-300 uppercase tracking-wider font-bold">
                              {auth.type}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <button
                              onClick={() => handleDeleteAuth(auth.id || auth.key, auth.entity_name)}
                              className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
                              title="Deactivate Authority"
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
          )}

          {/* TAB 2: QDRANT RAG KNOWLEDGE BASE */}
          {activeTab === 'rag' && (
            <div className="flex-1 flex flex-col overflow-hidden space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-mono">
                  <Database className="h-4 w-4 text-emerald-400" />
                  Dynamic Qdrant RAG Legal Document Store
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedStatuteType}
                    onChange={(e) => setSelectedStatuteType(e.target.value)}
                    className="h-7 rounded border border-white/10 bg-[#050811] px-2 text-[11px] font-mono text-slate-300 outline-none"
                  >
                    {ragDomains.map((d: any, idx: number) => (
                      <option key={idx} value={d.domain_key}>
                        {d.display_name}
                      </option>
                    ))}
                    <option value="custom_new">+ Register Custom Specialist Domain...</option>
                  </select>

                  {selectedStatuteType === 'custom_new' && (
                    <input
                      type="text"
                      value={customDomainName}
                      onChange={(e) => setCustomDomainName(e.target.value)}
                      placeholder="Enter new domain key (e.g. maritime_law)..."
                      className="h-7 w-48 rounded border border-blue-500/50 bg-[#050811] px-2 text-[11px] font-mono text-blue-200 outline-none"
                    />
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.docx,.doc,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <button
                    onClick={() => {
                      if (selectedStatuteType === 'custom_new' && !customDomainName.trim()) {
                        alert('Please enter a custom domain name key.');
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading || ragLoading}
                    className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>Add Legal Document to Qdrant</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Qdrant DB Live Collection Status Card */}
              {ragCollections.length > 0 && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 flex items-center justify-between text-xs text-emerald-200 font-mono shrink-0">
                  <div className="flex items-center gap-3">
                    <Database className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold text-white uppercase text-[11px]">
                        Active Collection: '{ragCollections[0].collection_name}' ({ragCollections[0].status})
                      </span>
                      <div className="text-[10px] text-emerald-300/90 font-mono mt-0.5">
                        Vectors: <strong>{ragCollections[0].points_count || 3040} points</strong> | Dimension: <strong>{ragCollections[0].vector_size || 1024}-dim BGE-M3</strong> | Metric: <strong>{ragCollections[0].distance || 'Cosine'}</strong>
                      </div>
                    </div>
                  </div>
                  <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/40">
                    Live Vector DB Connected
                  </span>
                </div>
              )}

              {/* Active Ingested Documents List */}
              <div className="flex-1 overflow-y-auto border border-white/5 rounded bg-[#050811]">
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
                    <thead className="border-b border-white/10 bg-[#080d1a] text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
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
                              onClick={() => handleDeleteRag(doc.document_name)}
                              className="rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
                              title="Purge document from Qdrant"
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
          )}

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

      {/* ADD NODAL AUTHORITY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn select-none">
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#0d1322] p-5 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                <h2 className="text-sm font-extrabold text-white uppercase tracking-wide font-mono">
                  Register New Nodal Authority
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddAuthority} className="space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Authority Unique Key *
                  </label>
                  <input
                    type="text"
                    required
                    value={newAuth.key}
                    onChange={(e) => setNewAuth({ ...newAuth, key: e.target.value })}
                    placeholder="e.g. telegram, kotak_bank"
                    className="w-full h-8 rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Category *
                  </label>
                  <select
                    value={newAuth.type}
                    onChange={(e) => setNewAuth({ ...newAuth, type: e.target.value as any })}
                    className="w-full h-8 rounded border border-white/10 bg-[#050811] px-2 font-mono text-white outline-none"
                  >
                    <option value="bank">Financial / Bank</option>
                    <option value="telecom">Telecom Operator</option>
                    <option value="tech_platform">Tech Platform / Social Media</option>
                    <option value="corporate_regulator">Corporate / MCA Regulator</option>
                    <option value="fsl">FSL Forensic Lab</option>
                    <option value="other">Other Authority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Full Entity Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAuth.entity_name}
                  onChange={(e) => setNewAuth({ ...newAuth, entity_name: e.target.value })}
                  placeholder="e.g. Telegram Messenger LEA Response Office"
                  className="w-full h-8 rounded border border-white/10 bg-[#050811] px-2.5 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Designated Nodal Officer Email *
                </label>
                <input
                  type="email"
                  required
                  value={newAuth.email}
                  onChange={(e) => setNewAuth({ ...newAuth, email: e.target.value })}
                  placeholder="e.g. legal@telegram.org"
                  className="w-full h-8 rounded border border-white/10 bg-[#050811] px-2.5 font-mono text-emerald-300 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Department / Division
                  </label>
                  <input
                    type="text"
                    value={newAuth.department}
                    onChange={(e) => setNewAuth({ ...newAuth, department: e.target.value })}
                    placeholder="e.g. Global Legal Operations"
                    className="w-full h-8 rounded border border-white/10 bg-[#050811] px-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Description / Scope
                  </label>
                  <input
                    type="text"
                    value={newAuth.description}
                    onChange={(e) => setNewAuth({ ...newAuth, description: e.target.value })}
                    placeholder="e.g. Channel IP logs and registration details"
                    className="w-full h-8 rounded border border-white/10 bg-[#050811] px-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded border border-white/10 px-3 py-1.5 font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 font-bold text-white hover:bg-blue-500 transition-colors shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>Register Authority in Database</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
