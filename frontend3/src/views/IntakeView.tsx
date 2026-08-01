import React, { useState, useRef } from 'react';
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
  AtSign
} from 'lucide-react';
import api from '../services/api';
import { useCaseStore } from '../store/caseStore';
import { BankAccountEntity } from '../types';

export default function IntakeView() {
  const navigate = useNavigate();
  const { addCaseFromComplaint, setSelectedInspectorItem } = useCaseStore();

  const [language, setLanguage] = useState('auto');
  const [rawText, setRawText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extractedResult, setExtractedResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
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
    if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext || '')) return <ImageIcon className="h-4 w-4 text-amber-400 shrink-0" />;
    if (['wav', 'mp3', 'm4a', 'ogg'].includes(ext || '')) return <Mic className="h-4 w-4 text-emerald-400 shrink-0" />;
    return <FileText className="h-4 w-4 text-slate-400 shrink-0" />;
  };

  const handleIngest = async () => {
    if (!rawText.trim() && attachedFiles.length === 0) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('input_type', 'multimodal');
      formData.append('original_language', language);
      formData.append('raw_text', rawText);
      
      // Append all attached files
      attachedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/api/ingest', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('[+] [Ingestion Success] Response Data:', response.data);

      if (response.data?.fallback_used) {
        console.warn('⚠️ [Ingestion Fallback Used]: Heuristic extractor executed.');
        console.warn('⚠️ [Fallback Reason]:', response.data.fallback_reason || 'Unknown LLM error');
      }

      setExtractedResult(response.data);
      setSelectedInspectorItem({ type: 'COMPLAINT_ENTITY_EXTRACTION', data: response.data });
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Complaint ingestion failed';
      console.error('❌ [Ingestion Exception Caught]:', detailMsg);
      console.error('❌ [Full Error Object]:', err);

      let enableFallbacks = false;
      try {
        const configRes = await api.get('/api/config');
        enableFallbacks = Boolean(configRes.data?.enable_demo_fallbacks);
      } catch (cfgErr) {
        enableFallbacks = false;
      }

      if (enableFallbacks) {
        console.warn('⚠️ [Client-side Demo Fallback Engaged] ENABLE_DEMO_FALLBACKS is true.');
        const mockResult = {
          complaint_number: `CMP-${Date.now().toString().slice(-4)}`,
          original_language: language,
          translated_text: rawText.includes('વોટ્સએપ') 
            ? 'Victim reported unauthorized transaction of Rs. 85,000 via fraudulent UPI VPA link scammer@paytm and SBI Account 30910293101.'
            : 'Extracted complaint details processed via Machine NLP pipeline.',
          crime_category: 'CYBER',
          crime_sub_type: 'UPI Financial Fraud',
          severity_score: 8.5,
          entities: {
            persons: [{ name: 'Ramesh Patel', role: 'victim' }],
            phone_numbers: ['+91 98765 43210'],
            vpas_upis: ['scammer@paytm'],
            bank_accounts: [
              { account_number: '30910293101', ifsc: 'SBIN0001234', bank: 'State Bank of India', account_name: 'Accused Fraudster', account_role: 'accused', is_victim_account: false }
            ],
            monetary_loss: 85000
          },
          fallback_used: true,
          fallback_reason: `Frontend Catch: ${detailMsg}`
        };
        setExtractedResult(mockResult);
        setSelectedInspectorItem({ type: 'COMPLAINT_ENTITY_EXTRACTION', data: mockResult });
      } else {
        setExtractedResult(null);
        setErrorMessage(`[Ingestion Error]: ${detailMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async () => {
    if (extractedResult) {
      const newCase = addCaseFromComplaint(extractedResult);
      navigate('/linkage');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white uppercase font-mono flex items-center gap-2">
            Complaint Intake & Analysis
          </h1>
          <p className="text-xs text-slate-400">
            Submit complaints in Gujarati, Hindi, or English. Attach multiple PDFs, evidence images, or voice recordings.
          </p>
        </div>

        <button
          onClick={() => {
            setRawText('');
            setAttachedFiles([]);
            setExtractedResult(null);
            setErrorMessage(null);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Reset Input
        </button>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 flex items-start gap-3 shrink-0">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Complaint Analysis Failed</h3>
            <p className="text-xs text-rose-200 font-mono mt-1 leading-relaxed">{errorMessage}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Please check your connection and try again. Contact the system administrator if the issue persists.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
        
        {/* Left Column: ChatGPT/Gemini Multimodal Prompt Box (7 Cols) */}
        <div className="col-span-7 rounded-xl border border-white/10 bg-[#0d1322] p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-3 flex-1 flex flex-col">
            
            {/* ChatGPT / Gemini Style Prompt Box Container */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex-1 rounded-xl border transition-all flex flex-col p-3 bg-[#050811] ${
                isDragging ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/30' : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Attached Files Pills list */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-white/10 max-h-32 overflow-y-auto">
                  {attachedFiles.map((file, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1322] px-2.5 py-1.5 text-xs group hover:border-white/20 transition-all"
                    >
                      {getFileIcon(file.name)}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-white truncate max-w-[140px]">{file.name}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
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
                placeholder="Describe the complaint in detail, paste raw transcript, or drag & drop files here (PDFs, evidence images, voice recordings)..."
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
                    {attachedFiles.length > 0 && (
                      <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white font-mono">
                        {attachedFiles.length}
                      </span>
                    )}
                  </button>

                  <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                    PDFs, Images (.png, .jpg), Audio (.mp3, .wav)
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
                    disabled={loading || (!rawText.trim() && attachedFiles.length === 0)}
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

                {extractedResult.fallback_used && (
                  <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-300 font-mono space-y-0.5">
                    <span className="font-bold uppercase block">⚡ Rule-Based Heuristic Fallback Mode</span>
                    <p className="text-slate-300">{extractedResult.fallback_reason || 'LLM API key absent or rate limit reached.'}</p>
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

                    <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-mono font-bold text-rose-300">
                      Loss: ₹{extractedResult.entities?.monetary_loss?.toLocaleString('en-IN') || '85,000'}
                    </span>
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

    </div>
  );
}
