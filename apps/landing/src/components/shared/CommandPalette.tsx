import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Scan, FileText, Settings, Command, ArrowRight, GitPullRequest } from 'lucide-react';
import { useScanStore } from '../../store/scan-store';
import { generateHTML, generateMarkdown } from './ReportExport';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: typeof Search;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const report = useScanStore((s) => s.report);
  const setRepoInput = useScanStore((s) => s.setRepoInput);

  const commands: Command[] = [
    {
      id: 'scan',
      label: 'Scan repository',
      description: 'Start a new scan from a GitHub URL',
      icon: Scan,
      shortcut: 'S',
      action: () => {
        setRepoInput('');
        setIsOpen(false);
      },
    },
    {
      id: 'export-md',
      label: 'Export as Markdown',
      description: 'Download report as .md file',
      icon: FileText,
      shortcut: 'E',
      action: () => {
        if (!report) return;
        const content = generateMarkdown(report);
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preflight-${report.repoName.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        setIsOpen(false);
      },
    },
    {
      id: 'export-json',
      label: 'Export as JSON',
      description: 'Download report as .json file',
      icon: FileText,
      action: () => {
        if (!report) return;
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preflight-${report.repoName.replace(/[^a-zA-Z0-9]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setIsOpen(false);
      },
    },
    {
      id: 'export-html',
      label: 'Export as HTML',
      description: 'Download report as .html file',
      icon: FileText,
      action: () => {
        if (!report) return;
        const content = generateHTML(report);
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preflight-${report.repoName.replace(/[^a-zA-Z0-9]/g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(url);
        setIsOpen(false);
      },
    },
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure GitHub token and preferences',
      icon: Settings,
      action: () => {
        setIsOpen(false);
      },
    },
    {
      id: 'github',
      label: 'Open GitHub',
      description: 'View source code on GitHub',
      icon: GitPullRequest,
      action: () => {
        window.open('https://github.com/anomalyco/agent-preflight', '_blank');
        setIsOpen(false);
      },
    },
  ];

  // Filter commands
  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase()),
  );

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    },
    [filtered, selectedIndex],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-base-950/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            className="w-[540px] panel overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-base-800">
              <Search size={15} className="text-base-500 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-[14px] text-base-100 placeholder:text-base-500 outline-none border-none"
              />
              <span className="text-[10px] text-base-600 bg-base-800 px-1.5 py-0.5 rounded font-mono">esc</span>
            </div>

            {/* Commands */}
            <div className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="text-[13px] text-base-500 text-center py-8">No results for "{query}"</div>
              ) : (
                filtered.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                        idx === selectedIndex ? 'bg-base-800' : 'hover:bg-base-800/50'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-md bg-base-800 flex items-center justify-center flex-shrink-0">
                        <Icon size={14} className="text-base-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-base-200">{cmd.label}</div>
                        <div className="text-[11px] text-base-500 truncate">{cmd.description}</div>
                      </div>
                      {cmd.shortcut && (
                        <span className="text-[10px] text-base-600 bg-base-800 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                          {cmd.shortcut}
                        </span>
                      )}
                      {idx === selectedIndex && <ArrowRight size={14} className="text-blue-400 flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-base-800 text-[10px] text-base-600">
              <span><Command size={10} className="inline mr-1" />K — Open</span>
              <span>↑↓ — Navigate</span>
              <span>↵ — Select</span>
              <span>esc — Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


