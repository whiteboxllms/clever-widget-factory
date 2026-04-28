import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Bug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'ok' | 'error' | 'warn';
  message: string;
}

let entryId = 0;
const MAX_ENTRIES = 50;

// Global event bus so any code can push diagnostics without React context
const listeners = new Set<(entry: DiagEntry) => void>();

export function pushDiag(level: DiagEntry['level'], message: string) {
  const entry: DiagEntry = {
    id: ++entryId,
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    level,
    message,
  };
  listeners.forEach(fn => fn(entry));
  // Also log to console for desktop debugging
  const prefix = '[UPLOAD-DIAG]';
  if (level === 'error') console.error(prefix, message);
  else if (level === 'warn') console.warn(prefix, message);
  else console.log(prefix, message);
}

/**
 * Floating diagnostic overlay for mobile upload debugging.
 * Activate by tapping the 🐛 button (bottom-left corner).
 * Shows a scrollable log of upload events with timing and device info.
 */
export function UploadDiagnosticOverlay() {
  const [entries, setEntries] = useState<DiagEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasEntries = entries.length > 0;

  useEffect(() => {
    const handler = (entry: DiagEntry) => {
      setEntries(prev => [...prev.slice(-(MAX_ENTRIES - 1)), entry]);
      // Auto-open on first entry
      if (!isOpen && entry.level === 'error') {
        setIsOpen(true);
        setIsMinimized(false);
      }
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isOpen && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isOpen, isMinimized]);

  const handleCopy = useCallback(async () => {
    const text = entries.map(e => `[${e.timestamp}] ${e.level.toUpperCase()} ${e.message}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [entries]);

  const levelColor = (level: DiagEntry['level']) => {
    switch (level) {
      case 'ok': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-blue-300';
    }
  };

  // Floating bug button (always visible)
  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setIsMinimized(false); }}
        className={cn(
          'fixed bottom-20 left-3 z-[9999] rounded-full p-2 shadow-lg',
          hasEntries ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300',
          'opacity-60 active:opacity-100'
        )}
        aria-label="Open upload diagnostics"
      >
        <Bug className="h-5 w-5" />
        {entries.filter(e => e.level === 'error').length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
            {entries.filter(e => e.level === 'error').length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="pointer-events-auto bg-gray-900 text-gray-100 border-t border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-mono font-bold">Upload Diagnostics</span>
            <span className="text-[10px] text-gray-500">{entries.length} entries</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleCopy} className="p-1.5 rounded hover:bg-gray-700" title="Copy log">
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded hover:bg-gray-700">
              {isMinimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setEntries([])} className="p-1.5 rounded hover:bg-gray-700 text-[10px] font-mono">CLR</button>
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded hover:bg-gray-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Log entries */}
        {!isMinimized && (
          <div ref={scrollRef} className="max-h-[40vh] overflow-y-auto px-2 py-1 font-mono text-[11px] leading-relaxed">
            {entries.length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No upload events yet. Select photos to start.</p>
            ) : (
              entries.map(entry => (
                <div key={entry.id} className="py-0.5 border-b border-gray-800 last:border-0">
                  <span className="text-gray-500">{entry.timestamp}</span>{' '}
                  <span className={levelColor(entry.level)}>{entry.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
