import { useScanStore } from '../../store/scan-store';
import { getCheckById } from '@shared/checks/index';
import type { CategoryResult, CategoryId } from '@shared/types';
import { motion } from 'framer-motion';
import { Shield, Cpu, Zap, Server, Activity, Gauge, Accessibility, Scale, ChevronDown, ChevronRight } from 'lucide-react';
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

const riskColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  info: 'bg-base-800 text-base-400 border-base-700',
};

interface Props {
  category: CategoryResult;
}

export function CategorySection({ category }: Props) {
  const [expanded, setExpanded] = useState(true);
  const openInspector = useScanStore((s) => s.openInspector);
  const Icon = categoryIcons[category.categoryId] || Shield;

  const hasIssues = category.failed > 0 || category.warned > 0;

  return (
    <motion.div
      className="panel overflow-hidden animate-fadeIn"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Category header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-base-900/50 transition-colors border-b border-base-800"
      >
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
          hasIssues ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-semibold text-base-100">{category.categoryLabel}</div>
          <div className="text-[11px] text-base-500">
            {category.passed} passed · {category.failed} failed · {category.warned} warnings
          </div>
        </div>
        <div className={`text-[13px] font-semibold ${
          category.score > category.maxScore * 0.7 ? 'text-emerald-400' :
          category.score > category.maxScore * 0.4 ? 'text-amber-400' : 'text-red-400'
        }`}>
          {category.maxScore > 0 ? Math.round((category.score / category.maxScore) * 100) : 0}%
        </div>
        {expanded ? <ChevronDown size={14} className="text-base-500" /> : <ChevronRight size={14} className="text-base-500" />}
      </button>

      {/* Checks */}
      {expanded && (
        <div className="divide-y divide-base-800/50">
          {category.checks.map((check) => {
            const def = getCheckById(check.checkId);
            const risk = def?.risk || 'info';
            const riskColor = riskColors[risk] || riskColors.info;

            return (
              <button
                key={check.checkId}
                onClick={() => openInspector(check, category.categoryId)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-base-800/30 transition-colors group"
              >
                {/* Status dot */}
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {check.status === 'pass' && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 8.5l3 3 5-6" />
                    </svg>
                  )}
                  {check.status === 'fail' && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 5l6 6M11 5l-6 6" />
                    </svg>
                  )}
                  {check.status === 'warn' && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 5.5v4" />
                      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
                    </svg>
                  )}
                  {check.status === 'info' && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 4v6M8 11.5v.5" />
                    </svg>
                  )}
                </div>

                {/* Message */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-base-200 group-hover:text-base-100 transition-colors truncate">
                    {check.message}
                  </div>
                  {check.file && (
                    <div className="text-[11px] text-base-600 font-mono truncate mt-0.5">
                      {check.file}{check.line ? `:${check.line}` : ''}
                    </div>
                  )}
                </div>

                {/* Risk badge */}
                {check.status !== 'pass' && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${riskColor} flex-shrink-0`}>
                    {risk}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
