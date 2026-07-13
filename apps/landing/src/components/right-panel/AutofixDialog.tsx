import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw, Code2, Copy, Sparkles, Download } from 'lucide-react';
import type { PatchFile } from '@shared/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patch: PatchFile | null;
  onAccept?: (patch: PatchFile) => void;
  onReject?: (patch: PatchFile) => void;
}

type ViewMode = 'current' | 'suggested' | 'diff';

export function AutofixDialog({ isOpen, onClose, patch, onAccept, onReject }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [accepted, setAccepted] = useState(false);

  const handleAccept = useCallback(() => {
    if (!patch) return;
    setAccepted(true);
    onAccept?.(patch);
    setTimeout(() => {
      onClose();
      setAccepted(false);
    }, 1500);
  }, [patch, onAccept, onClose]);

  const handleReject = useCallback(() => {
    if (!patch) return;
    onReject?.(patch);
    onClose();
  }, [patch, onReject, onClose]);

  if (!isOpen || !patch) return null;

  const lineCount = {
    current: patch.original.split('\n').length,
    suggested: patch.suggested.split('\n').length,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="w-[720px] max-h-[80vh] panel overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-base-800">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-violet-400" />
                <span className="text-[14px] font-semibold text-base-100">AI Fix</span>
              </div>
              <div className="flex items-center gap-2">
                {accepted && (
                  <span className="text-[12px] text-emerald-400 font-medium flex items-center gap-1">
                    <Check size={13} /> Applied
                  </span>
                )}
                <button onClick={onClose} className="btn-ghost p-1.5">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* File info */}
            <div className="px-5 py-2.5 bg-base-950 border-b border-base-800 flex items-center gap-2">
              <Code2 size={13} className="text-base-500" />
              <span className="text-[12px] font-mono text-base-300">{patch.filePath}</span>
              <span className="text-[11px] text-base-600 ml-auto">
                {lineCount.current} lines → {lineCount.suggested} lines
              </span>
            </div>

            {/* View mode tabs */}
            <div className="flex items-center gap-0.5 px-5 pt-3 pb-2">
              {(['current', 'suggested', 'diff'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-base-800 text-base-200'
                      : 'text-base-500 hover:text-base-300'
                  }`}
                >
                  {mode === 'current' ? 'Current' : mode === 'suggested' ? 'Suggested' : 'Diff'}
                </button>
              ))}
            </div>

            {/* Code view */}
            <div className="px-5 pb-3 max-h-[400px] overflow-y-auto">
              <div className="panel !bg-base-950 rounded-md overflow-hidden">
                <pre className="p-4 text-[12px] font-mono leading-relaxed overflow-x-auto">
                  {viewMode === 'diff' ? (
                    patch.diff.split('\n').map((line, i) => {
                      const className = line.startsWith('+')
                        ? 'text-emerald-400 bg-emerald-500/5 block'
                        : line.startsWith('-')
                          ? 'text-red-400 bg-red-500/5 block'
                          : line.startsWith('@@')
                            ? 'text-blue-400 block'
                            : 'text-base-400 block';
                      return (
                        <span key={i} className={className}>
                          {line.startsWith('+') ? '+' : line.startsWith('-') ? '-' : line.startsWith('@@') ? '@@' : ' '}{'  '}
                          {line.replace(/^[+-]/, '')}
                          {'\n'}
                        </span>
                      );
                    })
                  ) : (
                    (viewMode === 'current' ? patch.original : patch.suggested).split('\n').map((line, i) => (
                      <span key={i} className="text-base-400 block">
                        <span className="text-base-700 select-none mr-4">{String(i + 1).padStart(3, ' ')}</span>
                        {line}
                        {'\n'}
                      </span>
                    ))
                  )}
                </pre>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-base-800">
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-[12px] py-1.5">
                  <Copy size={12} />
                  Copy diff
                </button>
                <button className="btn-ghost text-[12px] py-1.5">
                  <Download size={12} />
                  Download patch
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  className="px-4 py-1.5 rounded-md text-[12px] font-medium text-base-400 hover:text-base-200 hover:bg-base-800 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  disabled={accepted}
                  className="px-4 py-1.5 rounded-md text-[12px] font-medium bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
                >
                  {accepted ? 'Applied' : 'Accept'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
