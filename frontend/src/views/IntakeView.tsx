import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Plus,
  Mail,
  User,
  MapPin,
  Calendar,
  Scale,
  Shield,
  CheckCircle2,
  Globe,
  Clock,
  ListChecks,
  DollarSign
} from 'lucide-react';
import api from '../services/api';
import ModuleSummarizerModal from '../components/common/ModuleSummarizerModal';
import { useCaseStore } from '../store/caseStore';
import { BankAccountEntity, AttachedFileMeta } from '../types';

export default function IntakeView() {
  const { t } = useTranslation();
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

      const savedManualText = record?.manual_text ?? activeCase.manual_text ?? '';
      const savedFiles = record?.attached_files ?? activeCase.attached_files ?? [];
      const savedExtracted = record?.extracted_result ?? activeCase.extracted_result ?? null;

      setRawText((prev) => (prev !== savedManualText ? savedManualText : prev));
      setPersistedFiles((prev) => (JSON.stringify(prev) !== JSON.stringify(savedFiles) ? savedFiles : prev));
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
  }, [activeCase?.case_number]);

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

      // Automatically register complaint into PostgreSQL DB and Zustand store on Intake Agent completion
      try {
        const createdCase = await addCaseFromComplaint(response.data, rawText, persistedFiles);
        console.log('[+] Case registered into DB and Store on Intake completion:', createdCase.case_number);
      } catch (regErr) {
        console.warn('[-] Auto-case registration notice:', regErr);
      }
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Complaint ingestion failed';
      console.error('❌ [Ingestion Exception Caught]:', detailMsg);
      setExtractedResult(null);
      setErrorMessage(`[Ingestion Error]: ${detailMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearForm = () => {
    setRawText('');
    setAttachedFiles([]);
    setPersistedFiles([]);
    setExtractedResult(null);
    setErrorMessage(null);
  };

  const [isRegisteringCase, setIsRegisteringCase] = useState(false);

  const handleCreateCase = async () => {
    if (extractedResult) {
      setIsRegisteringCase(true);
      try {
        if (!activeCase) {
          await addCaseFromComplaint(extractedResult, rawText, persistedFiles);
        }
        navigate('/linkage');
      } finally {
        setIsRegisteringCase(false);
      }
    }
  };

  const totalFilesCount = persistedFiles.length;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 bg-[#F8FAFC] dark:bg-[#050811]">

      {/* Header with Mode Status Badge */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-black tracking-wide text-slate-900 dark:text-white uppercase font-mono flex items-center gap-2">
              {t('intake.title', 'Complaint Intake & Multimodal Parsing')}
            </h1>
            {activeCase ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 font-mono">
                {t('brand.active_fir', 'Active Case:')} {activeCase.case_number}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                {t('dashboard.create_case', 'New Complaint Registration')}
              </span>
            )}
            {systemStatus && (
              systemStatus.offline_mode ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 font-mono">
                  <WifiOff className="h-3 w-3 text-amber-700 dark:text-amber-400" />
                  {t('common.offline_ready', 'STANDALONE OFFLINE MODE')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                  <Wifi className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                  {t('common.online_hybrid', 'SOVEREIGN AGENT ACTIVE')}
                </span>
              )
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {t('intake.subtitle', 'Multimodal complaint ingestion with automatic entity extraction, Gujarati/Hindi translation & audio ASR.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeCase && (
            <button
              onClick={() => {
                startNewComplaint();
                setRawText('');
                setAttachedFiles([]);
                setPersistedFiles([]);
                setExtractedResult(null);
                setErrorMessage(null);
              }}
              className="flex items-center gap-1.5 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              title="Start a fresh complaint registration"
            >
              <Plus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{t('dashboard.create_case', 'New Complaint')}</span>
            </button>
          )}

          <button
            onClick={() => setSummarizerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500 dark:border-amber-500/40 bg-amber-400 dark:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-slate-950 dark:text-amber-300 hover:bg-amber-500 dark:hover:bg-amber-500/30 transition-colors shadow-sm cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-slate-950 dark:text-amber-300" />
            <span>{t('nav.summary', 'AI Module Summary')}</span>
          </button>

          <button
            onClick={handleClearForm}
            className="flex items-center gap-1.5 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span>{t('intake.btn_clear', 'Clear Form')}</span>
          </button>

          <button
            onClick={handleIngest}
            disabled={loading || (!rawText.trim() && attachedFiles.length === 0 && persistedFiles.length === 0)}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 shadow-md cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Sparkles className="h-4 w-4 text-amber-300" />}
            <span>{loading ? t('intake.processing_agent', 'Running Extraction...') : t('intake.btn_run_agent', 'Process & Ingest Complaint')}</span>
          </button>

          {activeCase && (
            <button
              onClick={() => navigate('/linkage')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <span>{t('intake.proceed_to_linkage', 'Proceed to Linkage Analysis')}</span>
              <ArrowRight className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Offline Mode Warning Banner */}
      {systemStatus?.offline_mode && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 font-mono shrink-0">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Offline Mode Active:</strong> Running local sovereign extraction engines (OCR, Audio ASR & Structured Entity Extraction).
            </span>
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-400/80 font-bold">Air-Gapped Sovereign Processing</span>
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
        <div className="col-span-7 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] shadow-sm p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-3 flex-1 flex flex-col">

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 rounded-xl border transition-all flex flex-col p-3 bg-slate-50 dark:bg-[#050811] ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-2 ring-blue-500/30' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                }`}
            >
              {/* Attached Files Pills (with Download Options) */}
              {totalFilesCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-white/10 max-h-36 overflow-y-auto">
                  {persistedFiles.map((pfile, idx) => (
                    <div
                      key={`persisted-${idx}`}
                      className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1.5 text-xs group hover:border-blue-400 transition-all"
                    >
                      {getFileIcon(pfile.name)}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[130px]">{pfile.name}</span>
                        <span className="text-[9px] text-blue-700 dark:text-blue-300 font-mono">{(pfile.size / 1024).toFixed(1)} KB</span>
                      </div>

                      {/* Download File Button */}
                      <button
                        onClick={() => handleDownloadFile(pfile)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors ml-1"
                        title="Download Attached File"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      {/* Remove File Button */}
                      <button
                        onClick={() => removePersistedFile(idx)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
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
                className="flex-1 w-full bg-transparent text-xs font-mono text-slate-900 dark:text-slate-200 outline-none resize-none leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder="Describe complaint narrative in Gujarati, Hindi, or English, or drop files here (PDFs, Word .docx, Evidence Images, Voice Recordings)..."
              />

              {/* Drag and drop overlay hint */}
              {isDragging && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-blue-600 dark:text-blue-400 font-semibold border-2 border-dashed border-blue-400 dark:border-blue-500/50 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                  <UploadCloud className="h-5 w-5 animate-bounce" />
                  <span>Drop files here to attach to complaint</span>
                </div>
              )}

              {/* Prompt Controls Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10 mt-2 shrink-0">
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
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0d1322] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
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
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
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
        <div className="col-span-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1322] shadow-sm p-4 flex flex-col justify-between overflow-y-auto space-y-4 max-h-[calc(100vh-140px)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300">
                Extracted Case Information
              </span>
              {extractedResult && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                  {extractedResult.crime_category || 'CYBER'}
                </span>
              )}
            </div>

            {extractedResult ? (
              <div className="space-y-3">
                {/* ID & Severity Bar */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">ID: {extractedResult.complaint_number || 'CMP-2026-PENDING'}</span>
                    {extractedResult.crime_sub_type && (
                      <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                        • {extractedResult.crime_sub_type}
                      </span>
                    )}
                  </div>
                  <span className="rounded bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold font-mono border border-rose-300 dark:border-rose-500/30">
                    Severity: {extractedResult.severity_score} / 10
                  </span>
                </div>

                {/* Processing Mode Metadata Badge */}
                {extractedResult.processing_mode && (
                  <div className="rounded border border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-2 text-[10px] font-mono space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-800 dark:text-blue-300 uppercase">Engine Mode: {extractedResult.processing_mode}</span>
                      <span className="text-slate-600 dark:text-slate-400">{extractedResult.is_offline ? 'Offline Engine' : 'Online Engine'}</span>
                    </div>
                    {extractedResult.engines_used && extractedResult.engines_used.length > 0 && (
                      <p className="text-slate-600 dark:text-slate-400">
                        Processors: {extractedResult.engines_used.join(', ')}
                      </p>
                    )}
                    {extractedResult.warnings && extractedResult.warnings.length > 0 && (
                      <p className="text-amber-800 dark:text-amber-300">
                        Notice: {extractedResult.warnings.join('; ')}
                      </p>
                    )}
                  </div>
                )}

                {/* English Translated Narrative */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1">
                    <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    English Narrative
                  </span>
                  <p className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed">
                    {extractedResult.translated_text}
                  </p>
                </div>

                {/* Identified Legal Sections */}
                {extractedResult.bns_sections_identified && extractedResult.bns_sections_identified.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1.5">
                      <Scale className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                      Identified Legal Sections (BNS / IT Act)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {extractedResult.bns_sections_identified.map((sec: string, i: number) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 text-[11px] font-mono font-semibold text-indigo-900 dark:text-indigo-300">
                          <Shield className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Investigation Facts */}
                {extractedResult.key_facts && extractedResult.key_facts.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1 mb-1.5">
                      <ListChecks className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      Key Investigation Facts
                    </span>
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#050811] p-2.5 text-xs space-y-1.5">
                      {extractedResult.key_facts.map((fact: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-800 dark:text-slate-200 leading-snug">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{fact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Entities */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
                    Extracted Entities & Identifiers
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {/* Persons (Complainant / Accused) */}
                    {extractedResult.entities?.persons?.map((person: any, i: number) => (
                      <span key={`p-${i}`} className="inline-flex items-center gap-1 rounded-md border border-purple-300 dark:border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 px-2 py-1 text-xs font-mono font-bold text-purple-900 dark:text-purple-300">
                        <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        {person.name} [{person.role ? person.role.toUpperCase() : 'PERSON'}{person.age ? `, ${person.age}y` : ''}]
                      </span>
                    ))}

                    {/* Phone Numbers */}
                    {extractedResult.entities?.phone_numbers?.map((p: string, i: number) => (
                      <span key={`ph-${i}`} className="inline-flex items-center gap-1 rounded-md border border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-xs font-mono font-bold text-blue-900 dark:text-blue-300">
                        <Phone className="h-3 w-3 text-blue-600 dark:text-blue-400" /> {p}
                      </span>
                    ))}

                    {/* Email Addresses */}
                    {extractedResult.entities?.email_addresses?.map((email: string, i: number) => (
                      <span key={`em-${i}`} className="inline-flex items-center gap-1 rounded-md border border-teal-300 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10 px-2 py-1 text-xs font-mono font-bold text-teal-900 dark:text-teal-300">
                        <Mail className="h-3 w-3 text-teal-600 dark:text-teal-400" /> {email}
                      </span>
                    ))}

                    {/* Online Handles & URLs */}
                    {extractedResult.entities?.online_handles?.map((h: string, i: number) => (
                      <span key={`h-${i}`} className="inline-flex items-center gap-1 rounded-md border border-cyan-300 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-1 text-xs font-mono font-bold text-cyan-900 dark:text-cyan-300">
                        {h.startsWith('http') ? <Globe className="h-3 w-3 text-cyan-600 dark:text-cyan-400" /> : <AtSign className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />} {h}
                      </span>
                    ))}

                    {/* Bank Accounts */}
                    {extractedResult.entities?.bank_accounts?.map((b: BankAccountEntity, i: number) => (
                      <span key={`b-${i}`} className="inline-flex items-center gap-1 rounded-md border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 text-xs font-mono font-bold text-indigo-900 dark:text-indigo-300">
                        <Building className="h-3 w-3 text-indigo-600 dark:text-indigo-400" /> A/C: {b.account_number} ({b.bank})
                      </span>
                    ))}

                    {/* VPAs / UPI IDs */}
                    {extractedResult.entities?.vpas_upis?.map((v: string, i: number) => (
                      <span key={`v-${i}`} className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-mono font-bold text-amber-900 dark:text-amber-300">
                        <CreditCard className="h-3 w-3 text-amber-600 dark:text-amber-400" /> {v}
                      </span>
                    ))}

                    {/* Crime Locations */}
                    {extractedResult.entities?.crime_locations?.map((loc: string, i: number) => (
                      <span key={`loc-${i}`} className="inline-flex items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-xs font-mono font-bold text-emerald-900 dark:text-emerald-300">
                        <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> {loc}
                      </span>
                    ))}

                    {/* Date / Time of Incident */}
                    {extractedResult.entities?.date_time_of_incident && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60 px-2 py-1 text-xs font-mono font-bold text-slate-800 dark:text-slate-300">
                        <Clock className="h-3 w-3 text-slate-600 dark:text-slate-400" /> {extractedResult.entities.date_time_of_incident}
                      </span>
                    )}

                    {/* Monetary Loss (if > 0) */}
                    {extractedResult.entities?.monetary_loss > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 text-xs font-mono font-bold text-rose-900 dark:text-rose-300">
                        <DollarSign className="h-3 w-3 text-rose-600 dark:text-rose-400" /> Loss: ₹{extractedResult.entities?.monetary_loss?.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-16 text-center text-slate-500 space-y-2">
                <FileText className="h-10 w-10 mx-auto text-slate-400 dark:text-slate-600" />
                <p className="text-xs text-slate-600 dark:text-slate-400">Submit a complaint on the left to extract case details and entities.</p>
              </div>
            )}
          </div>

          {extractedResult && (
            <button
              onClick={handleCreateCase}
              disabled={isRegisteringCase}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {isRegisteringCase ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : null}
              <span>{isRegisteringCase ? t('intake.registering', 'Registering Case...') : t('intake.proceed_to_linkage', 'Register Case & Proceed to Linkage Analysis')}</span>
              {!isRegisteringCase && <ArrowRight className="h-4 w-4 text-white" />}
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

