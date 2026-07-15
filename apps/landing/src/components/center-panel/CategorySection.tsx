import { useScanStore } from '../../store/scan-store';
import { getCheckById } from '@shared/checks/index';
import type { CategoryResult, CategoryId } from '@shared/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Cpu, Zap, Server, Activity, Gauge, Accessibility, Scale, ChevronDown, ChevronRight, Sparkles, ExternalLink, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

const categoryIcons: Record<CategoryId, typeof Shield> = {
  security: Shield,
  'ai-safety': Cpu,
  runtime: Zap,
  infrastructure: Server,
  observability: Activity,
  performance: Gauge,
  accessibility: Accessibility,
  compliance: Scale,
};

const categoryAccent: Record<CategoryId, { border: string; glow: string }> = {
  security: { border: 'border-l-cyan-500', glow: 'rgba(6,182,212,0.15)' },
  'ai-safety': { border: 'border-l-indigo-500', glow: 'rgba(99,102,241,0.15)' },
  runtime: { border: 'border-l-amber-500', glow: 'rgba(245,158,11,0.15)' },
  infrastructure: { border: 'border-l-emerald-500', glow: 'rgba(16,185,129,0.15)' },
  observability: { border: 'border-l-cyan-400', glow: 'rgba(34,211,238,0.15)' },
  performance: { border: 'border-l-orange-500', glow: 'rgba(249,115,22,0.15)' },
  accessibility: { border: 'border-l-pink-500', glow: 'rgba(236,72,153,0.15)' },
  compliance: { border: 'border-l-violet-500', glow: 'rgba(139,92,246,0.15)' },
};

const riskColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  info: 'bg-white/[0.04] text-white/40 border-white/[0.08]',
};

interface Props {
  category: CategoryResult;
}

export function CategorySection({ category }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const openInspector = useScanStore((s) => s.openInspector);
  const Icon = categoryIcons[category.categoryId] || Shield;

  const hasIssues = category.failed > 0 || category.warned > 0;
  const accent = categoryAccent[category.categoryId] || categoryAccent.security;
  const pct = category.maxScore > 0 ? Math.round((category.score / category.maxScore) * 100) : 0;

  return (
    <motion.div
      className="relative rounded-2xl bg-[#0F172A]/50 border border-white/[0.08] overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Category header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 p-4 border-l-4 ${accent.border} transition-colors duration-200 hover:bg-white/[0.02]`}
        style={{ background: expanded ? accent.glow : 'transparent' }}
      >
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
          hasIssues ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          <Icon size={15} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-semibold text-white">{category.categoryLabel}</div>
          <div className="text-[11px] text-white/40">
            {category.passed} passed · {category.failed} failed · {category.warned} warnings
          </div>
        </div>
        <div className={`text-[13px] font-semibold ${
          pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400'
        }`}>
          {pct}%
        </div>
        {expanded ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
      </button>

      {/* Checks */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="divide-y divide-white/[0.04]"
          >
            {category.checks.map((check) => {
              const def = getCheckById(check.checkId);
              const risk = def?.risk || 'info';
              const riskColor = riskColors[risk] || riskColors.info;
              const isOpen = expandedCheck === check.checkId;

              return (
                <div key={check.checkId}>
                  <button
                    onClick={() => setExpandedCheck(isOpen ? null : check.checkId)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors group"
                  >
                    {/* Status indicator */}
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {check.status === 'pass' && (
                        <CheckCircle size={16} className="text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                      )}
                      {check.status === 'fail' && (
                        <XCircle size={16} className="text-rose-400 drop-shadow-[0_0_4px_rgba(244,63,94,0.5)]" />
                      )}
                      {check.status === 'warn' && (
                        <AlertTriangle size={16} className="text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
                      )}
                      {check.status === 'info' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      )}
                    </div>

                    {/* Message */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white/70 group-hover:text-white/90 transition-colors truncate">
                        {check.message}
                      </div>
                      {check.file && (
                        <div className="text-[11px] text-white/30 font-mono truncate mt-0.5">
                          {check.file}{check.line ? `:${check.line}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Risk badge */}
                    {check.status !== 'pass' && check.status !== 'info' && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${riskColor} flex-shrink-0`}>
                        {risk}
                      </span>
                    )}

                    <ChevronRight
                      size={12}
                      className={`text-white/20 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isOpen && def && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-2 pl-12 space-y-3">
                          <p className="text-[12px] text-white/50 leading-relaxed">
                            {def.description}
                          </p>

                          {check.snippet && (
                            <div className="rounded-lg bg-[#030712] border border-white/[0.06] overflow-hidden">
                              <pre className="p-3 text-[11px] font-mono text-white/60 overflow-x-auto leading-relaxed">
                                <code>{check.snippet}</code>
                              </pre>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openInspector(check, category.categoryId);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-[11px] font-medium transition-all duration-200 shadow-lg shadow-violet-500/20"
                            >
                              <Sparkles size={12} />
                              Generate AI Fix
                              <ExternalLink size={10} className="opacity-60" />
                            </button>
                            {def.documentationUrl && (
                              <a
                                href={def.documentationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
                              >
                                Docs
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
