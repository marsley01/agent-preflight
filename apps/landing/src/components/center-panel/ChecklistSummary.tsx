import { useScanStore } from '../../store/scan-store';
import { Shield, Cpu, Zap, Server, Activity, Gauge, Accessibility, Scale } from 'lucide-react';
import type { CategoryId } from '@shared/types';

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

const categoryColors: Record<CategoryId, string> = {
  security: 'text-violet-400 bg-violet-500/10',
  'ai-safety': 'text-blue-400 bg-blue-500/10',
  runtime: 'text-amber-400 bg-amber-500/10',
  infrastructure: 'text-emerald-400 bg-emerald-500/10',
  observability: 'text-cyan-400 bg-cyan-500/10',
  performance: 'text-orange-400 bg-orange-500/10',
  accessibility: 'text-pink-400 bg-pink-500/10',
  compliance: 'text-indigo-400 bg-indigo-500/10',
};

export function ChecklistSummary() {
  const report = useScanStore((s) => s.report);
  if (!report) return null;

  return (
    <div className="grid grid-cols-4 gap-2 animate-fadeIn">
      {report.categories.map((cat) => {
        const Icon = categoryIcons[cat.categoryId] || Shield;
        const colorClass = categoryColors[cat.categoryId] || 'text-base-400 bg-base-800';
        const isGood = cat.score > cat.maxScore * 0.7;
        const hasIssues = cat.failed > 0;

        return (
          <div key={cat.categoryId} className="panel p-3 hover:border-base-700 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${colorClass}`}>
                <Icon size={13} />
              </div>
              <span className="text-[12px] font-medium text-base-200">{cat.categoryLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {hasIssues ? (
                <span className="text-red-400 font-medium">{cat.failed} issue{cat.failed > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-emerald-400 font-medium">All clear</span>
              )}
              {cat.warned > 0 && (
                <>
                  <span className="text-base-700">·</span>
                  <span className="text-amber-400">{cat.warned} warning{cat.warned > 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
