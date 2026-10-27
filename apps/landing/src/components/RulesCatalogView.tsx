import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { RiskLevel } from '@shared/types';
import { useRulesStore } from '../store/rules-store';
import { RULE_CATEGORIES, type RuleItem } from '../lib/rules-data';
import { SEVERITY_LABEL, SEVERITY_ORDER } from '../lib/findings';
import { SEVERITY_BADGE } from './OverviewView';
import { Icon } from './Icon';

interface RulesCatalogViewProps {
  onShowToast: (msg: string) => void;
}

export const RulesCatalogView: React.FC<RulesCatalogViewProps> = ({ onShowToast }) => {
  const { rules, activeCategory, setActiveCategory, searchQuery, setSearchQuery } = useRulesStore();
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, like GitHub
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rules
      .filter(
        (r) =>
          (activeCategory === 'all' || r.category === activeCategory) &&
          (risk === 'all' || r.risk === risk) &&
          (!q || [r.id, r.title, r.description, r.suggestedFix].some((s) => s.toLowerCase().includes(q))),
      )
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.risk) - SEVERITY_ORDER.indexOf(b.risk));
  }, [rules, activeCategory, risk, searchQuery]);

  const categories = [
    { id: 'all', label: 'All', count: rules.length },
    ...RULE_CATEGORIES.map((c) => ({ id: c.id as string, label: c.label, count: rules.filter((r) => r.category === c.id).length })),
  ];

  const copy = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(msg);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6 md:py-12">
      <div>
        <h1 className="font-headline-lg text-on-surface">Checks</h1>
        <p className="mt-2 max-w-[65ch] font-body-lg text-on-surface-variant">
          All {rules.length} checks the web scan runs, why each matters, and how to fix it.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
        {/* Category filter: vertical list on desktop, scrollable pills on mobile */}
        <nav aria-label="Categories" className="lg:sticky lg:top-20">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible [scrollbar-width:none]">
            {categories.map((c) => {
              const active = activeCategory === c.id;
              return (
                <li key={c.id} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveCategory(c.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 font-label-md transition-colors ${
                      active ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    }`}
                  >
                    {c.label}
                    <span className="tabular-nums text-secondary">{c.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
              <input
                ref={searchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search checks"
                aria-label="Search checks"
                className="h-9 w-full rounded-lg border border-surface-container-high bg-surface-container-lowest pl-9 pr-10 font-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-surface-container-high px-1.5 text-[11px] text-secondary">/</kbd>
            </div>
            <div role="group" aria-label="Filter by risk" className="inline-flex shrink-0 rounded-lg bg-surface-container-low p-0.5">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={risk === r}
                  onClick={() => setRisk(r)}
                  className={`rounded-md px-2.5 py-1 font-label-md transition-colors ${
                    risk === r ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r === 'all' ? 'Any risk' : SEVERITY_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <p className="font-body-sm text-on-surface-variant" aria-live="polite">
            {filtered.length === rules.length ? `${rules.length} checks` : `${filtered.length} of ${rules.length} checks`}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-container-high px-6 py-10 text-center font-body-sm text-on-surface-variant">
              No checks match. Try a different search or category.
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest">
              {filtered.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </ul>
          )}

          <SuppressHelp onCopy={copy} />
        </div>
      </div>
    </div>
  );
};

function RuleRow({ rule }: { rule: RuleItem }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const category = RULE_CATEGORIES.find((c) => c.id === rule.category)?.label ?? rule.category;

  return (
    <li className="border-b border-surface-container-high last:border-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low/60"
      >
        <span className={`mt-0.5 w-[68px] shrink-0 rounded-md px-1.5 py-0.5 text-center font-label-sm ${SEVERITY_BADGE[rule.risk]}`}>
          {SEVERITY_LABEL[rule.risk]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-label-md text-on-surface">{rule.title}</span>
          <span className="mt-0.5 block font-body-sm text-on-surface-variant">{rule.description}</span>
        </span>
        <span className="hidden shrink-0 font-label-sm text-secondary md:inline">{category}</span>
        <Icon name="caret-down" size={16} className={`mt-0.5 text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={bodyId} className="grid gap-4 px-4 pb-4 pl-[100px] font-body-sm max-md:pl-4 md:grid-cols-2">
          <div>
            <p className="font-medium text-on-surface">Why it matters</p>
            <p className="mt-1 text-on-surface-variant">{rule.whyItMatters}</p>
            {rule.exampleExploit && (
              <p className="mt-2 text-on-surface-variant">
                <span className="font-medium text-on-surface">Example attack. </span>
                {rule.exampleExploit}
              </p>
            )}
          </div>
          <div>
            <p className="font-medium text-on-surface">How to fix it</p>
            <p className="mt-1 text-on-surface-variant">{rule.suggestedFix}</p>
            {rule.documentationUrl && (
              <a href={rule.documentationUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-on-surface underline underline-offset-2">
                Read more <Icon name="external" size={12} />
              </a>
            )}
          </div>
          <p className="font-code-inline text-secondary md:col-span-2">{rule.id}</p>
        </div>
      )}
    </li>
  );
}

function SuppressHelp({ onCopy }: { onCopy: (text: string, msg: string) => void }) {
  const inline = '// preflight-ignore: <why this is safe>';
  const file = '# .preflightignore\nscripts/seed/\n**/*.generated.ts';
  return (
    <section className="mt-4 grid gap-4 rounded-xl border border-surface-container-high bg-surface-container-lowest p-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <h2 className="font-headline-sm text-on-surface">Silencing a finding in the CLI</h2>
        <p className="mt-1 font-body-sm text-on-surface-variant">
          Write the reason down so it shows up in code review. Full list of CLI rule IDs in the{' '}
          <a href="https://github.com/anomalyco/agent-preflight/blob/main/docs/rules.md" target="_blank" rel="noreferrer" className="text-on-surface underline underline-offset-2">
            rule reference
          </a>
          .
        </p>
      </div>
      {[
        { title: 'One line', hint: 'On the flagged line or the line above it', code: inline },
        { title: 'Whole paths', hint: 'Gitignore-style globs at the project root', code: file },
      ].map((b) => (
        <div key={b.title} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-label-md text-on-surface">{b.title}</p>
            <button type="button" onClick={() => onCopy(b.code, `${b.title} snippet copied`)} className="inline-flex items-center gap-1 font-label-sm text-on-surface-variant hover:text-on-surface">
              <Icon name="copy" size={13} /> Copy
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-surface-container-low px-3 py-2.5 font-code-inline text-on-surface">{b.code}</pre>
          <p className="font-body-sm text-secondary">{b.hint}</p>
        </div>
      ))}
    </section>
  );
}
