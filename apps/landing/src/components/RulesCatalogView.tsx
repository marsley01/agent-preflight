import React, { useEffect, useRef } from 'react';
import { useRulesStore, RuleLevel } from '../store/rules-store';
import { RULE_CATEGORIES, RULES_CATALOG } from '../lib/rules-data';
import type { CategoryId } from '@shared/types';

interface RulesCatalogViewProps {
  onShowToast: (msg: string) => void;
}

export const RulesCatalogView: React.FC<RulesCatalogViewProps> = ({ onShowToast }) => {
  const {
    rules,
    ruleLevels,
    setRuleLevel,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    getConfigJSON,
    exportCatalogJSON
  } = useRulesStore();

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories = [
    { id: 'all', label: 'All', count: rules.length },
    ...RULE_CATEGORIES.map((cat) => ({
      id: cat.id as string,
      label: cat.label,
      count: rules.filter((r) => r.category === cat.id).length
    }))
  ];

  const filteredRules = rules.filter((r) => {
    const matchesCategory = activeCategory === 'all' || r.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.suggestedFix.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const copySnippet = (snippetText: string) => {
    navigator.clipboard.writeText(snippetText);
    onShowToast(`Copied directive: "${snippetText}"`);
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(getConfigJSON());
    onShowToast('Config copied to clipboard');
  };

  const criticalCount = rules.filter((r) => r.risk === 'critical').length;
  const highCount = rules.filter((r) => r.risk === 'high').length;
  const matrixRuleIds = RULES_CATALOG.filter((r) => r.risk === 'critical' || r.risk === 'high').slice(0, 6).map((r) => r.id);

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto px-gutter-desktop py-space-xl gap-space-xl">
      {/* Header Section */}
      <header className="flex flex-col gap-space-md">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm font-label-md text-label-md text-secondary">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-wide">CHECKS</span>
                    <span>/</span>
                    <span>{rules.length} rules across {RULE_CATEGORIES.length} categories</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="w-2 h-2 rounded-full bg-tertiary-container"></div>
            <span className="font-label-sm text-label-sm text-on-surface">Live definitions</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
          <div className="max-w-3xl flex flex-col gap-space-xs">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Everything Preflight checks</h1>
            <p className="font-body-lg text-body-lg text-secondary">
              Browse every check, see why it matters, and tune which ones should fail a scan for your project.
            </p>
          </div>

          <div className="flex items-center gap-space-sm shrink-0">
            <button
              type="button"
              onClick={() => {
                document.getElementById('config-panel')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-space-md py-1.5 rounded bg-surface-container-high text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-highest transition-colors flex items-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Configure .preflightrc</span>
            </button>

            <button
              type="button"
              onClick={exportCatalogJSON}
              className="px-space-md py-1.5 rounded bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary-container hover:text-on-primary-container transition-colors flex items-center gap-space-xs shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Config</span>
            </button>
          </div>
        </div>

        {/* Search & Filters Strip */}
        <div className="mt-space-sm p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-md border border-surface-container">
          <div className="relative flex-1 max-w-xl">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">search</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, title, description, or suggested fix..."
              className="w-full h-9 pl-9 pr-14 rounded bg-surface-container-low text-on-surface font-body-md text-body-md placeholder:text-secondary focus:outline-none focus:bg-surface-container-lowest transition-colors"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-secondary">
              /
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-space-xs">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-space-md py-1 rounded font-label-md text-label-md transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-secondary hover:text-on-surface'
                  }`}
                >
                  {cat.label} <span className="ml-1 opacity-70">{cat.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Metrics Distribution Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container">
          <span className="font-label-sm text-label-sm text-secondary">CRITICAL RISK</span>
          <div className="flex items-baseline justify-between mt-space-sm">
            <span className="font-headline-lg text-headline-lg text-error">{criticalCount}</span>
            <span className="font-label-sm text-label-sm text-error bg-error-container/30 px-space-xs py-0.5 rounded">error level</span>
          </div>
        </div>

        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container">
          <span className="font-label-sm text-label-sm text-secondary">HIGH RISK</span>
          <div className="flex items-baseline justify-between mt-space-sm">
            <span className="font-headline-lg text-headline-lg text-on-surface">{highCount}</span>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container px-space-xs py-0.5 rounded">error / warn</span>
          </div>
        </div>

        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container">
          <span className="font-label-sm text-label-sm text-secondary">TOTAL CHECKS</span>
          <div className="flex items-baseline justify-between mt-space-sm">
            <span className="font-headline-lg text-headline-lg text-on-surface">{rules.length}</span>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container px-space-xs py-0.5 rounded">{RULE_CATEGORIES.length} categories</span>
          </div>
        </div>

        <div className="p-space-md rounded bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container">
          <span className="font-label-sm text-label-sm text-secondary">TARGET FRAMEWORK</span>
          <div className="flex items-baseline justify-between mt-space-sm">
            <span className="font-headline-lg text-headline-lg text-on-surface">Next.js</span>
            <span className="font-label-sm text-label-sm text-secondary bg-surface-container px-space-xs py-0.5 rounded">+ Supabase</span>
          </div>
        </div>
      </div>

      {/* Rule Inspection Cards List */}
      <div className="flex flex-col gap-space-lg">
        {filteredRules.length === 0 && (
          <div className="py-space-xl text-center font-body-sm text-body-sm text-secondary border border-dashed border-surface-container rounded">
            {searchQuery ? 'No checks match your search.' : 'No checks in this category.'}
          </div>
        )}
        {filteredRules.map((rule) => {
          const currentLevel = ruleLevels[rule.id] || 'warn';
          const isCritical = rule.risk === 'critical' || rule.risk === 'high';

          return (
            <article
              key={rule.id}
              className="p-space-lg rounded bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-surface-container"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-sm pb-space-sm border-b border-surface-container-low">
                <div className="flex flex-wrap items-center gap-space-sm">
                  <span className="font-label-md text-label-md px-2 py-0.5 rounded bg-primary-container text-on-primary-container">
                    {rule.id}
                  </span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">{rule.title}</h2>
                  <div
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-label-sm ${
                      isCritical
                        ? 'bg-error-container text-on-error-container'
                        : 'bg-secondary-container text-on-secondary-fixed-variant'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isCritical ? 'bg-error' : 'bg-secondary'}`}></div>
                    <span>{rule.risk.toUpperCase()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-space-md font-label-sm text-label-sm text-secondary">
                  <span className="capitalize">Category: <code className="font-code-inline text-code-inline text-on-surface">{rule.category}</code></span>
                  <span>
                    Level: <strong className={currentLevel === 'error' ? 'text-error' : 'text-on-surface'}>{currentLevel.toUpperCase()}</strong>
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="font-body-md text-body-md text-secondary leading-relaxed">{rule.description}</p>

              {/* Why it matters + Suggested Fix */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
                <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                  <div className="font-label-sm text-label-sm text-secondary">WHY IT MATTERS</div>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    {rule.whyItMatters}
                  </p>
                  {rule.exampleExploit && (
                    <p className="font-body-sm text-body-sm text-secondary leading-relaxed mt-space-xs">
                      <strong className="text-on-surface">Example exploit:</strong> {rule.exampleExploit}
                    </p>
                  )}
                </div>

                <div className="bg-surface-container-low p-space-md rounded flex flex-col gap-space-xs">
                  <div className="font-label-sm text-label-sm text-secondary">SUGGESTED FIX</div>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    {rule.suggestedFix}
                  </p>
                  {rule.documentationUrl && (
                    <a
                      href={rule.documentationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-space-xs inline-flex items-center gap-1 font-body-sm text-body-sm text-primary hover:underline"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      Read more
                    </a>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-space-xs flex flex-wrap items-center justify-between gap-space-sm font-label-sm text-label-sm text-secondary">
                <span>Weight: {rule.weight} • Risk: {rule.risk}</span>
                <button
                  type="button"
                  onClick={() => copySnippet(`// preflight-disable-next-line ${rule.id}`)}
                  className="hover:text-on-surface transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Ignore: <code className="font-code-inline text-code-inline text-on-surface">// preflight-disable-next-line {rule.id}</code></span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Configuration & Customization Workspace */}
      <section id="config-panel" className="pt-space-lg flex flex-col gap-space-lg">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-sm font-label-md text-label-md text-secondary">
            <span className="font-label-md text-label-md text-on-surface">CONFIGURATION</span>
            <span>/</span>
            <span>.preflightrc.json</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Rule Customization &amp; Configuration</h2>
          <p className="font-body-md text-body-md text-secondary">
            Control enforcement levels per rule via config file or inline comments.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* Policy Enforcement Matrix Toggles */}
          <div className="lg:col-span-6 p-space-lg rounded bg-surface-container-lowest shadow-sm flex flex-col gap-space-md border border-surface-container">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-low">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-secondary text-[20px]">tune</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Enforcement Toggles</h3>
              </div>
              <span className="font-label-sm text-label-sm text-secondary">Live Toggle</span>
            </div>

            <div className="flex flex-col gap-space-sm">
              {matrixRuleIds.map((ruleId) => {
                const level = ruleLevels[ruleId] || 'warn';
                return (
                  <div key={ruleId} className="p-space-sm rounded bg-surface-container-low flex items-center justify-between gap-space-md">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">{ruleId}</span>
                      <span className="font-body-sm text-body-sm text-secondary">{RULES_CATALOG.find((r) => r.id === ruleId)?.title ?? 'Unknown'}</span>
                    </div>
                    <div className="flex rounded bg-surface-container p-0.5">
                      {(['error', 'warn', 'off'] as RuleLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            setRuleLevel(ruleId, lvl);
                            onShowToast(`Rule ${ruleId} set to "${lvl}"`);
                          }}
                          className={`px-2.5 py-1 rounded font-label-sm text-label-sm transition-colors ${
                            level === lvl
                              ? 'bg-primary text-on-primary'
                              : 'text-secondary hover:text-on-surface'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Directive instruction box */}
            <div className="mt-space-sm p-space-md rounded bg-surface-container-high/40 flex flex-col gap-space-sm">
              <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface">
                <span className="material-symbols-outlined text-[16px]">terminal</span>
                <span>Inline Ignore Directives</span>
              </div>
              <div className="p-space-sm rounded bg-inverse-surface text-inverse-on-surface flex items-center justify-between gap-space-sm font-code-inline text-code-inline">
                <span className="text-inverse-on-surface">// preflight-disable-next-line security-secrets-client-exposure</span>
                <button
                  type="button"
                  onClick={() => copySnippet('// preflight-disable-next-line security-secrets-client-exposure')}
                  className="text-inverse-on-surface/60 hover:text-inverse-on-surface transition-colors text-[12px]"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          {/* Live Config JSON Preview */}
          <div className="lg:col-span-6 rounded bg-inverse-surface text-inverse-on-surface flex flex-col overflow-hidden shadow-sm">
            <div className="bg-white/10 px-space-md py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-space-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-outline"></span>
                <span className="font-label-md text-label-md text-inverse-on-surface">.preflightrc.json</span>
              </div>
              <button
                type="button"
                onClick={copyConfig}
                className="px-space-sm py-1 rounded bg-white/10 hover:bg-white/20 text-inverse-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copy Config</span>
              </button>
            </div>
            <pre className="p-space-lg font-code-inline text-code-inline text-inverse-on-surface overflow-x-auto leading-relaxed h-[440px]">
              <code>{getConfigJSON()}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};