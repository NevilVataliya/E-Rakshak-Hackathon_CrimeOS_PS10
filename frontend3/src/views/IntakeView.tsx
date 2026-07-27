import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileUp, 
  Languages, 
  CheckCircle2, 
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
  Play,
  Pause,
  AlertTriangle
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import api from '../services/api';
import { useCaseStore } from '../store/caseStore';
import { BankAccountEntity } from '../types';

export default function IntakeView() {
  const navigate = useNavigate();
  const { addCaseFromComplaint, setSelectedInspectorItem } = useCaseStore();

  const [inputType, setInputType] = useState('text');
  const [language, setLanguage] = useState('gu');
  const [rawText, setRawText] = useState('મને વોટ્સએપ પર લોન અને યુપીઆઈ લિંક મોકલીને 85,000 રૂપિયાનું ફ્રોડ કર્યું છે. મોબાઈલ નંબર +91 98765 43210, UPI ID scammer@paytm અને સ્ટેટ બેંક ખાતા નંબર 30910293101 (IFSC: SBIN0001234) માં નાણાં ટ્રાન્સફર કરાવ્યા છે.');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractedResult, setExtractedResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // WaveSurfer Audio State
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (inputType === 'audio' && waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#3b82f6',
        progressColor: '#10b981',
        cursorColor: '#f43f5e',
        barWidth: 2,
        height: 48,
      });

      // Load mock audio waveform representation
      wavesurfer.current.load('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');

      wavesurfer.current.on('play', () => setIsPlaying(true));
      wavesurfer.current.on('pause', () => setIsPlaying(false));

      return () => {
        wavesurfer.current?.destroy();
      };
    }
  }, [inputType]);

  const togglePlayPause = () => {
    wavesurfer.current?.playPause();
  };

  const presets = {
    gu: 'મને વોટ્સએપ પર લોન અને યુપીઆઈ લિંક મોકલીને 85,000 રૂપિયાનું ફ્રોડ કર્યું છે. મોબાઈલ નંબર +91 98765 43210, UPI ID scammer@paytm અને સ્ટેટ બેંક ખાતા નંબર 30910293101 (IFSC: SBIN0001234) માં નાણાં ટ્રાન્સફર કરાવ્યા છે.',
    hi: 'मुझे टेलीग्राम पार्ट-टाइम जॉब के नाम पर 1,50,000 रुपये का चूना लगाया गया। आरोपी का मोबाइल नंबर +91 94260 11223 और यूपीआई आईडी fraudster@ybl है।',
    en: 'Victim reported extortion of Rs. 2,00,000 through unauthorized transaction link. Suspect phone: +91 98250 44551, SBI A/C: 30910293101 (IFSC: SBIN0001234).'
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleIngest = async () => {
    if (!rawText.trim() && !selectedFile) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('input_type', inputType);
      formData.append('original_language', language);
      formData.append('raw_text', rawText);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await api.post('/api/ingest', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setExtractedResult(response.data);
      setSelectedInspectorItem({ type: 'COMPLAINT_ENTITY_EXTRACTION', data: response.data });
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Complaint ingestion failed';
      console.error('[-] Ingestion Error:', detailMsg);

      let enableFallbacks = false;
      try {
        const configRes = await api.get('/api/config');
        enableFallbacks = Boolean(configRes.data?.enable_demo_fallbacks);
      } catch (cfgErr) {
        enableFallbacks = false;
      }

      if (enableFallbacks) {
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
              { account_number: '30910293101', ifsc: 'SBIN0001234', bank: 'State Bank of India', account_name: 'Accused Fraudster' }
            ],
            monetary_loss: 85000
          }
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
            Module 1: Multimodal Intake & Waveform ASR / OCR Inspector
          </h1>
          <p className="text-xs text-slate-400">
            Ingests Gujarati, Hindi, and English complaints from PDFs, audio recordings, scanned handwriting, or raw text.
          </p>
        </div>

        <button
          onClick={() => {
            setRawText('');
            setSelectedFile(null);
            setExtractedResult(null);
            setErrorMessage(null);
          }}
          className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear Form
        </button>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="rounded border border-rose-500/50 bg-rose-500/10 p-3 flex items-start gap-3 shrink-0">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Ingestion Pipeline Failed</h3>
            <p className="text-xs text-rose-200 font-mono mt-1 leading-relaxed">{errorMessage}</p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Strict Debug Mode active (<code className="text-amber-300">ENABLE_DEMO_FALLBACKS=false</code>). Ensure backend AI service and LLM keys are operational.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        
        {/* Left Column: Source Input & Waveform Canvas */}
        <div className="rounded border border-white/10 bg-[#0d1322] p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div className="space-y-4">
            
            {/* Format Selection Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Input Format Mode
                </label>
                <select
                  value={inputType}
                  onChange={(e) => setInputType(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                >
                  <option value="text">Direct Text Entry</option>
                  <option value="pdf">PDF File Document</option>
                  <option value="audio">Audio Voice Recording (.mp3/.wav)</option>
                  <option value="image">Scanned FIR Image OCR</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Original Source Language
                </label>
                <select
                  value={language}
                  onChange={(e: any) => {
                    setLanguage(e.target.value);
                    setRawText(presets[e.target.value as keyof typeof presets] || '');
                  }}
                  className="h-8 w-full rounded border border-white/10 bg-[#050811] px-2.5 text-xs font-semibold text-slate-200 outline-none"
                >
                  <option value="gu">Gujarati (ગુજરાતી)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            {/* Audio WaveSurfer Visualizer Pane */}
            {inputType === 'audio' && (
              <div className="rounded border border-blue-500/30 bg-[#050811] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-blue-400 font-mono font-bold">
                  <span>Gemini Multimodal Speech-to-Text ASR Waveform</span>
                  <span>00:42 / 02:15</span>
                </div>
                <div ref={waveformRef} className="w-full" />
                <button
                  onClick={togglePlayPause}
                  className="flex items-center gap-1.5 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300 hover:bg-blue-500/20"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{isPlaying ? 'Pause Playback' : 'Play Audio Stream'}</span>
                </button>
              </div>
            )}

            {/* Text Input Area */}
            {inputType === 'text' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Victim Complaint Narrative Text
                  </label>
                  <button
                    onClick={() => setRawText(presets[language as keyof typeof presets] || '')}
                    className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset Sample
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050811] p-3 text-xs font-mono text-slate-200 outline-none leading-relaxed"
                  placeholder="Enter complaint in Gujarati, Hindi or English..."
                />
              </div>
            ) : (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Upload Evidence File
                </label>
                <label className="flex flex-col items-center justify-center rounded border border-dashed border-white/20 bg-[#050811] p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
                  <input type="file" className="hidden" onChange={handleFileChange} />
                  {inputType === 'pdf' ? <FileSpreadsheet className="h-8 w-8 text-blue-400 mb-1" /> : <ImageIcon className="h-8 w-8 text-blue-400 mb-1" />}
                  <span className="text-xs font-bold text-white">{selectedFile ? selectedFile.name : `Select ${inputType.toUpperCase()} File`}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Click to browse'}</span>
                </label>
              </div>
            )}

          </div>

          <button
            onClick={handleIngest}
            disabled={loading || (!rawText.trim() && !selectedFile)}
            className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 p-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span>Run Multimodal NLP Ingestion Engine</span>
          </button>
        </div>

        {/* Right Column: Extracted Entities Panel */}
        <div className="rounded border border-white/10 bg-[#0d1322] p-4 flex flex-col justify-between overflow-y-auto space-y-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 pb-2 block">
              Extracted Legal Entity Inspector
            </span>

            {extractedResult ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded border border-white/10 bg-[#050811] p-2.5 text-xs">
                  <span className="font-mono font-bold text-white">ID: {extractedResult.complaint_number}</span>
                  <span className="rounded bg-rose-500/20 text-rose-300 px-2 py-0.5 text-[10px] font-bold font-mono">
                    Severity: {extractedResult.severity_score} / 10
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">English Narrative</span>
                  <p className="mt-1 rounded border border-white/10 bg-[#050811] p-2.5 text-xs text-slate-200 font-sans leading-relaxed">
                    {extractedResult.translated_text}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Extracted Entities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedResult.entities?.phone_numbers?.map((p: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-mono font-bold text-blue-300">
                        <Phone className="h-3 w-3 text-blue-400" /> {p}
                      </span>
                    ))}

                    {extractedResult.entities?.vpas_upis?.map((v: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-mono font-bold text-amber-300">
                        <CreditCard className="h-3 w-3 text-amber-400" /> {v}
                      </span>
                    ))}

                    {extractedResult.entities?.bank_accounts?.map((b: BankAccountEntity, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-xs font-mono font-bold text-indigo-300">
                        <Building className="h-3 w-3 text-indigo-400" /> A/C: {b.account_number} ({b.bank})
                      </span>
                    ))}

                    <span className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-mono font-bold text-rose-300">
                      Loss: ₹{extractedResult.entities?.monetary_loss || 85000}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-16 text-center text-slate-500 space-y-2">
                <FileText className="h-10 w-10 mx-auto text-slate-600" />
                <p className="text-xs text-slate-400">Run Ingestion Engine above to extract grounded entities.</p>
              </div>
            )}
          </div>

          {extractedResult && (
            <button
              onClick={handleCreateCase}
              className="flex w-full items-center justify-center gap-2 rounded bg-emerald-600 p-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
            >
              <span>Register Official FIR & Transition to Topology Linkage</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
