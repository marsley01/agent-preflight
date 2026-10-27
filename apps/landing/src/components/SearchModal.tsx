import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRulesStore } from '../store/rules-store';
import { SEVERITY_LABEL } from '../lib/findings';
import { Icon, type IconName } from './Icon';
import { NAV_ITEMS } from './Header';

interface SearchModalProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelectPath: (path: string) => void;
}

interface Item {
  key: string;
  icon: IconName;
  label: string;
  hint: string;
  run: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onOpen, onClose, onSelectPath }) => {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { rules, setSearchQuery, setActiveCategory } = useRulesStore();

  // Global shortcut: Ctrl/Cmd+K toggles, Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onOpen();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCursor(0);
    }
  }, [isOpen]);

  const items = useMemo<Item[]>(() => {
    const q = query.toLowerCase().trim();
    const pages: Item[] = NAV_ITEMS.filter((n) => !q || n.label.toLowerCase().includes(q)).map((n) => ({
      key: `nav-${n.id}`,
      icon: n.icon,
      label: n.label,
      hint: 'Go to',
      run: () => onSelectPath(n.route ?? n.id),
    }));
    const checks: Item[] = (q ? rules.filter((r) => [r.id, r.title, r.category].some((s) => s.toLowerCase().includes(q))) : rules)
      .slice(0, 30)
      .map((r) => ({
        key: r.id,
        icon: 'shield',
        label: r.title,
        hint: SEVERITY_LABEL[r.risk],
        run: () => {
          setActiveCategory('all');
          setSearchQuery(r.id);
          onSelectPath('checks');
        },
      }));
    return [...pages, ...checks];
  }, [query, rules, onSelectPath, setActiveCategory, setSearchQuery]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!isOpen) return null;

  const choose = (item: Item | undefined) => {
    if (!item) return;
    item.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fade-in flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-2xl shadow-black/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-surface-container-high px-4">
          <Icon name="search" size={18} className="text-secondary" />
          <input
            type="text"
            /* preflight-ignore: the dialog's only, autofocused input; the caret shows focus */
            className="h-12 flex-1 bg-transparent font-body-md text-on-surface placeholder:text-secondary outline-none"
            placeholder="Search pages and checks"
            aria-label="Search pages and checks"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === 'Enter') {
                choose(items[cursor]);
              }
            }}
            autoFocus
          />
          <kbd className="rounded border border-surface-container-high px-1.5 text-[11px] text-secondary">Esc</kbd>
        </div>

        <ul ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 && <li className="px-3 py-8 text-center font-body-sm text-on-surface-variant">No matches for "{query}"</li>}
          {items.map((item, i) => (
            <li key={item.key} role="option" aria-selected={i === cursor} data-index={i}>
              <button
                type="button"
                onMouseMove={() => setCursor(i)}
                onClick={() => choose(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === cursor ? 'bg-surface-container-low' : ''}`}
              >
                <Icon name={item.icon} size={16} className="text-secondary" />
                <span className="min-w-0 flex-1 truncate font-body-md text-on-surface">{item.label}</span>
                <span className="shrink-0 font-label-sm text-secondary">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
