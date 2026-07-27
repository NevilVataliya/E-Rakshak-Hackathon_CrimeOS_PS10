import React from 'react';
import { Command } from 'cmdk';
import { Search, FileText, Network, Bot, Send, BarChart3, FileCheck2, ShieldCheck, Gavel, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CommandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPaletteDialog({ open, onOpenChange }: CommandPaletteDialogProps) {
  const navigate = useNavigate();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  if (!open) return null;

  const handleSelect = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-[#0d1322] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        
        <Command className="w-full font-sans text-xs">
          
          <div className="flex items-center border-b border-white/10 px-3">
            <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
            <Command.Input
              placeholder="Search active FIRs, VPAs, IMEIs, or BNS statutory sections (Ctrl+K)..."
              className="h-11 w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="p-4 text-center text-xs text-slate-500">
              No matching intelligence record or statute found.
            </Command.Empty>

            <Command.Group heading="PIPELINE MODULES" className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => handleSelect('/intake')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-300"
              >
                <FileText className="h-3.5 w-3.5 text-blue-400" />
                <span>Module 1: Multimodal Intake & Waveform ASR / OCR Inspector</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect('/linkage')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-amber-600/20 hover:text-amber-300"
              >
                <Network className="h-3.5 w-3.5 text-amber-400" />
                <span>Module 2: Qdrant Serial Offender Topology Link Graph</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect('/investigation')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-300"
              >
                <Bot className="h-3.5 w-3.5 text-blue-400" />
                <span>Module 3: LangGraph Multi-Agent SOP Execution Matrix</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect('/subpoenas')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300"
              >
                <Send className="h-3.5 w-3.5 text-emerald-400" />
                <span>Module 4: Turnkey Subpoena Builder & PDF Email Hub</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect('/analytics')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-300"
              >
                <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                <span>Module 5: High-Scale CDR Pattern Analytics Studio</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect('/case-diary')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300"
              >
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Module 6: Court-Ready Master FIR Case Diary & Section 63 BSA</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="STATUTORY PROVISIONS" className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <Command.Item
                onSelect={() => handleSelect('/investigation')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Gavel className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono">BNS Section 318(4) — Punishment for Cheating by Personation</span>
              </Command.Item>

              <Command.Item
                onSelect={() => handleSelect('/investigation')}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono">BSA Section 63 — Electronic Evidence Certificate</span>
              </Command.Item>
            </Command.Group>

          </Command.List>

          <div className="flex items-center justify-between border-t border-white/10 px-3 py-1.5 text-[10px] text-slate-500">
            <span>Use ↑↓ to navigate, Enter to select</span>
            <button onClick={() => onOpenChange(false)} className="hover:text-slate-300">ESC to close</button>
          </div>

        </Command>

      </div>

    </div>
  );
}
