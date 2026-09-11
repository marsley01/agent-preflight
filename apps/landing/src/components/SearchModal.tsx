import React, { useState, useEffect } from 'react';
import { useRulesStore } from '../store/rules-store';

interface SearchModalProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectPath: (path: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onOpen, onClose, onSelectPath }) => {
  const [query, setQuery] = useState('');
  const rules = useRulesStore((s) => s.rules);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onOpen();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpen, onClose]);

  if (!isOpen) return null;

  const filteredRules = rules.filter(
    (r) =>
      r.id.toLowerCase().includes(query.toLowerCase()) ||
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-on-surface/30 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl overflow-hidden border border-surface-container-high flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="p-space-md border-b border-surface-container-high flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
          <input
            type="text"
            className="flex-1 bg-transparent font-body-lg text-body-lg text-on-surface placeholder:text-outline outline-none"
            placeholder="Search checks, categories, or rules..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant border border-surface-container-high">
            ESC
          </kbd>
        </div>

        <div className="max-h-96 overflow-y-auto p-space-sm divide-y divide-surface-container-high">
          {/* Navigation */}
          <div className="px-space-sm py-1 font-label-sm text-label-sm text-on-surface-variant">
            Navigation
          </div>
          {[
            { path: 'scan', icon: 'search', label: 'Scan', desc: 'Paste a repo link and run checks' },
            { path: 'progress', icon: 'timeline', label: 'Progress', desc: 'Readiness score over time' },
            { path: 'checks', icon: 'checklist', label: 'Checks', desc: 'All checks and settings' },
            { path: 'learn', icon: 'menu_book', label: 'Learn', desc: 'Docs, CI setup, and guides' },
            { path: '/docs', icon: 'auto_stories', label: 'Full documentation', desc: 'Detailed check reference' },
          ].map((item) => (
            <button
              key={item.path}
              className="w-full text-left p-space-sm rounded-xl hover:bg-surface-container-low flex items-center gap-space-sm transition-colors"
              onClick={() => {
                onSelectPath(item.path);
                onClose();
              }}
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{item.icon}</span>
              <div>
                <div className="font-body-md text-body-md text-on-surface">{item.label}</div>
                <div className="font-body-sm text-body-sm text-on-surface-variant">{item.desc}</div>
              </div>
            </button>
          ))}

          {/* Rules */}
          <div className="px-space-sm pt-space-md pb-1 font-label-sm text-label-sm text-on-surface-variant">
            Checks ({filteredRules.length})
          </div>
          {filteredRules.map((rule) => (
            <button
              key={rule.id}
              className="w-full text-left p-space-sm rounded-xl hover:bg-surface-container-low flex items-center justify-between transition-colors"
              onClick={() => {
                onSelectPath('checks');
                onClose();
              }}
            >
              <div>
                <span className="font-label-md text-label-md text-on-surface font-semibold mr-2">{rule.id}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{rule.title}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-xs text-on-surface-variant">
                {rule.category}
              </span>
            </button>
          ))}
        </div>

        <div className="p-space-sm bg-surface-container-low border-t border-surface-container-high flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span>
            Tip: Press <kbd className="px-1 py-0.5 rounded bg-surface-container">⌘K</kbd> to open from anywhere
          </span>
          <span>Preflight</span>
        </div>
      </div>
    </div>
  );
};