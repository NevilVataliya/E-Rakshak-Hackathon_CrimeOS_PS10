import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  FileText, 
  FileSpreadsheet, 
  Mic, 
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Phone,
  CreditCard,
  Building,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Paperclip,
  X,
  UploadCloud,
  AtSign,
  Wifi,
  WifiOff,
  Cpu,
  Download,
  Plus
} from 'lucide-react';
import api from '../services/api';
import ModuleSummarizerModal from '../components/common/ModuleSummarizerModal';
import { useCaseStore } from '../store/caseStore';
import { BankAccountEntity, AttachedFileMeta } from '../types';

export default function IntakeView() {
  const navigate = useNavigate();
  const { activeCase, intakeDataByCase, addCaseFromComplaint, updateCaseIntakeData, setSelectedInspectorItem, startNewComplaint } = useCaseStore();
  const [summarizerOpen, setSummarizerOpen] = useState(false);

  const [language, setLanguage] = useState('auto');
  const [rawText, setRawText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [persistedFiles, setPersistedFiles] = useState<AttachedFileMeta[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractedResult, setExtractedResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<{
    offline_mode: boolean;
    config_mode: string;
    cloud_keys_configured: boolean;
    active_processors?: string[];
    warnings?: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/api/system/status');
        setSystemStatus(res.data);
      } catch (err) {
        console.warn('Unable to fetch system status:', err);
      }
    };
    fetchStatus();
  }, []);

  // Sync state when active case changes or on component mount
  useEffect(() => {
    if (activeCase) {
      const caseNo = activeCase.case_number;
      const record = intakeDataByCase?.[caseNo];

      // Strictly load manual_text typed by user - DO NOT fallback to complaint_text!
      const savedManualText = record?.manual_text ?? activeCase.manual_text ?? '';
      const savedFiles = record?.attached_files ?? activeCase.attached_files ?? [];
      const savedExtracted = record?.extracted_result ?? activeCase.extracted_result ?? null;

      setRawText(savedManualText);
      setPersistedFiles(savedFiles);
      if (savedExtracted) {
        setExtractedResult(savedExtracted);
      }
    } else {
      setRawText('');
      setAttachedFiles([]);
      setPersistedFiles([]);
      setExtractedResult(null);
      setErrorMessage(null);
    }
  }, [activeCase]);

  // Continuously sync manual text & persisted files back to case store for active case
  useEffect(() => {
    if (activeCase?.case_number) {
      updateCaseIntakeData(activeCase.case_number, rawText, persistedFiles);
    }
  }, [rawText, persistedFiles, activeCase?.case_number]);

  const handleFilesAdded = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    setAttachedFiles(prev => [...prev, ...newFiles]);

    // Convert each new file into AttachedFileMeta with dataUrl for downloading
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const meta: AttachedFileMeta = {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl
        };
        setPersistedFiles(prev => {
          if (prev.some(p => p.name === file.name && p.size === file.size)) return prev;
          return [...prev, meta];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeLiveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removePersistedFile = (index: number) => {
    const target = persistedFiles[index];
    setPersistedFiles(prev => prev.filter((_, i) => i !== index));
    if (target) {
      setAttachedFiles(prev => prev.filter(f => f.name !== target.name));
    }
  };

  const handleDownloadFile = (pfile: AttachedFileMeta) => {
    if (!pfile.dataUrl) {
      alert(`No downloadable payload available for ${pfile.name}`);
      return;
    }
    const link = document.createElement('a');
    link.href = pfile.dataUrl;
    link.download = pfile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileSpreadsheet className="h-4 w-4 text-blue-400 shrink-0" />;
    if (['docx', 'doc', 'txt', 'csv'].includes(ext || '')) return <FileText className="h-4 w-4 text-indigo-400 shrink-0" />;
    if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext || '')) return <ImageIcon className="h-4 w-4 text-amber-400 shrink-0" />;
    if (['wav', 'mp3', 'm4a', 'ogg', 'flac'].includes(ext || '')) return <Mic className="h-4 w-4 text-emerald-400 shrink-0" />;
    return <FileText className="h-4 w-4 text-slate-400 shrink-0" />;
  };

  const handleIngest = async () => {
    if (!rawText.trim() && attachedFiles.length === 0 && persistedFiles.length === 0) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('input_type', 'multimodal');
      formData.append('original_language', language);
      formData.append('raw_text', rawText);
      
      attachedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/api/ingest', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('[+] [Ingestion Success] Response Data:', response.data);
      setExtractedResult(response.data);
      setSelectedInspectorItem({ type: 'COMPLAINT_ENTITY_EXTRACTION', data: response.data });
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Complaint ingestion failed';
      console.error('❌ [Ingestion Exception Caught]:', detailMsg);
      setExtractedResult(null);
      setErrorMessage(`[Ingestion Error]: ${detailMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async () => {
    if (extractedResult) {
      addCaseFromComplaint(extractedResult, rawText, persistedFiles);
      navigate('/linkage');
    }
  };

  const totalFilesCount = persistedFiles.length;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 select-none">
      
      {/* Header with Mode Status Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
              Complaint Intake & Multimodal Analysis
            </h1>
            {activeCase ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-bold text-blue-300 font-mono">
                Active Case: {activeCase.case_number}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 font-mono">
                ✨ New Complaint Registration
              </span>
            )}
            {systemStatus && (
              systemStatus.offline_mode ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 font-mono">
                  <WifiOff className="h-3 w-3 text-amber-400" />
                  STANDALONE OFFLINE MODE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 font-mono">
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  HYBRID CLOUD MODE
                </span>
              )
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Submit complaints in Gujarati, Hindi, or English. Attach PDFs, Word documents (.docx), evidence images, or voice recordings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              startNewComplaint();
              setRawText('');
              setAttachedFiles([]);
              setPersistedFiles([]);
              setExtractedResult(null);
              setErrorMessage(null);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-all shadow-md"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Register New Complaint</span>
          </button>

          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-blue-500/20 transition-all shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>AI Module Summary</span>
          </button>

          <button
            onClick={() => {
              setRawText('');
              setAttachedFiles([]);
              setPersistedFiles([]);
              setExtractedResult(null);
              setErrorMessage(null);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear Form
          </button>
        </div>
      </div>

      {/* Offline Mode Warning Banner */}
      {systemStatus?.offline_mode && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-center justify-between text-xs text-amber-200 font-mono shrink-0">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Running local extraction engines (PyMuPDF, python-docx, Tesseract OCR, Faster-Whisper, & Heuristic Regex).
            </span>
          </div>
          <span className="text-[10px] text-amber-400/80">Bypassing Cloud LLMs</span>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 flex items-start gap-3 shrink-0">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Complaint Analysis Failed</h3>
            <p className="text-xs text-rose-200 font-mono mt-1 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
        
        {/* Left Column: Multimodal Prompt Box (7 Cols) */}
        <div className="col-span-7 rounded-xl border border-white/10 bg-[#0d1322] p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-3 flex-1 flex flex-col">
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 rounded-xl border transition-all flex flex-col p-3 bg-[#050811] ${
                isDragging ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30' : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Attached Files Pills (with Download Options) */}
              {totalFilesCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-white/10 max-h-36 overflow-y-auto">
                  {persistedFiles.map((pfile, idx) => (
                    <div 
                      key={`persisted-${idx}`}
                      className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs group hover:border-blue-400 transition-all"
                    >
                      {getFileIcon(pfile.name)}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-slate-100 truncate max-w-[130px]">{pfile.name}</span>
                        <span className="text-[9px] text-blue-300 font-mono">{(pfile.size / 1024).toFixed(1)} KB</span>
                      </div>

                      {/* Download File Button */}
                      <button
                        onClick={() => handleDownloadFile(pfile)}
                        className="text-blue-400 hover:text-blue-200 p-1 rounded hover:bg-blue-500/20 transition-colors ml-1"
                        title="Download Attached File"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      {/* Remove File Button */}
                      <button
                        onClick={() => removePersistedFile(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/20 transition-colors"
                        title="Remove file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea Input */}
              <textarea
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="flex-1 w-full bg-transparent text-xs font-mono text-slate-200 outline-none resize-none leading-relaxed placeholder:text-slate-500"
                placeholder="Describe complaint narrative in Gujarati, Hindi, or English, or drop files here (PDFs, Word .docx, Evidence Images, Voice Recordings)..."
              />

              {/* Drag and drop overlay hint */}
              {isDragging && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-blue-400 font-semibold border-2 border-dashed border-blue-500/50 rounded-lg bg-blue-500/10">
                  <UploadCloud className="h-5 w-5 animate-bounce" />
                  <span>Drop files here to attach to complaint</span>
                </div>
              )}

              {/* Prompt Controls Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-2 shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.docx,.doc,.txt,.csv,.png,.jpg,.jpeg,.bmp,.webp,.wav,.mp3,.m4a,.ogg,.flac"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0d1322] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-blue-400" />
                    <span>Attach Files</span>
                    {totalFilesCount > 0 && (
                      <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white font-mono">
                        {totalFilesCount}
                      </span>
                    )}
                  </button>

                  <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                    PDFs, DOCX, Images (.png, .jpg), Audio (.mp3, .wav)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRawText('')}
                    className="p-1.5 rounded text-slate-500 hover:text-slate-300 transition-colors"
                    title="Clear text"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={handleIngest}
                    disabled={loading || (!rawText.trim() && totalFilesCount === 0)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 shadow-md"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span>{loading ? 'Analyzing...' : 'Analyze Complaint'}</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Right Column: Extracted Entities Panel (5 Cols) */}
        <div className="col-span-5 rounded-xl border border-white/10 bg-[#0d1322] p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-2 block">
              Extracted Case Information
            </span>

            {extractedResult ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#050811] p-2.5 text-xs">
                  <span className="font-mono font-bold text-white">ID: {extractedResult.complaint_number}</span>
                  <span className="rounded bg-rose-500/20 text-rose-300 px-2 py-0.5 text-[10px] font-bold font-mono">
                    Severity: {extractedResult.severity_score} / 10
                  </span>
                </div>

                {/* Processing Mode Metadata Badge */}
                {extractedResult.processing_mode && (
                  <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2 text-[10px] font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-300 uppercase">Engine Mode: {extractedResult.processing_mode}</span>
                      <span className="text-slate-400">{extractedResult.is_offline ? '⚡ Offline' : '🌐 Online'}</span>
                    </div>
                    {extractedResult.engines_used && extractedResult.engines_used.length > 0 && (
                      <p className="text-slate-400">
                        Processors: {extractedResult.engines_used.join(', ')}
                      </p>
                    )}
                    {extractedResult.warnings && extractedResult.warnings.length > 0 && (
                      <p className="text-amber-300">
                        Notice: {extractedResult.warnings.join('; ')}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">English Narrative</span>
                  <p className="mt-1 rounded-lg border border-white/10 bg-[#050811] p-2.5 text-xs text-slate-200 font-sans leading-relaxed">
                    {extractedResult.translated_text}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Extracted Entities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedResult.entities?.phone_numbers?.map((p: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-mono font-bold text-blue-300">
                        <Phone className="h-3 w-3 text-blue-400" /> {p}
                      </span>
                    ))}

                    {extractedResult.entities?.online_handles?.map((h: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-mono font-bold text-cyan-300">
                        <AtSign className="h-3 w-3 text-cyan-400" /> {h}
                      </span>
                    ))}

                    {extractedResult.entities?.vpas_upis?.map((v: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-mono font-bold text-amber-300">
                        <CreditCard className="h-3 w-3 text-amber-400" /> {v}
                      </span>
                    ))}

                    {extractedResult.entities?.bank_accounts?.map((b: BankAccountEntity, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-xs font-mono font-bold text-indigo-300">
                        <Building className="h-3 w-3 text-indigo-400" /> A/C: {b.account_number} ({b.bank})
                      </span>
                    ))}

                    {extractedResult.entities?.monetary_loss > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-mono font-bold text-rose-300">
                        Loss: ₹{extractedResult.entities?.monetary_loss?.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-16 text-center text-slate-500 space-y-2">
                <FileText className="h-10 w-10 mx-auto text-slate-600" />
                <p className="text-xs text-slate-400">Submit a complaint on the left to extract case details and entities.</p>
              </div>
            )}
          </div>

          {extractedResult && (
            <button
              onClick={handleCreateCase}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-md"
            >
              <span>Register Case & Proceed to Linkage Analysis</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>

      <ModuleSummarizerModal
        isOpen={summarizerOpen}
        onClose={() => setSummarizerOpen(false)}
        moduleId="MODULE_1"
        moduleTitle="Complaint Intake & Multimodal Extraction"
      />
    </div>
  );
}

