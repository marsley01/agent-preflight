import { useScanStore } from '../../store/scan-store';
import { getReadinessLabel } from '@shared/scoring';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export function ScoreOverview() {
  const report = useScanStore((s) => s.report);
  if (!report) return null;

  const { score } = report;
  const readiness = getReadinessLabel(score.percentage);
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
  };
  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    orange: 'bg-orange-500/10 border-orange-500/20',
    red: 'bg-red-500/10 border-red-500/20',
  };
  const ringMap: Record<string, string> = {
    emerald: '#10b981',
    blue: '#3b82f6',
    amber: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444',
  };

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.percentage / 100) * circumference;

  const categoryColors: Record<string, string> = {
    security: 'bg-violet-500',
    'ai-safety': 'bg-blue-500',
    runtime: 'bg-amber-500',
    infrastructure: 'bg-emerald-500',
    observability: 'bg-cyan-500',
    performance: 'bg-orange-500',
    accessibility: 'bg-pink-500',
    compliance: 'bg-indigo-500',
  };

  return (
    <div className="panel p-5 animate-fadeIn">
      <div className="flex items-start gap-6">
        {/* Score circle */}
        <div className="relative flex-shrink-0">
          <svg width="104" height="104" className="transform -rotate-90">
            <circle cx="52" cy="52" r={radius} fill="none" stroke="#27272a" strokeWidth="6" />
            <motion.circle
              cx="52" cy="52" r={radius}
              fill="none"
              stroke={ringMap[readiness.color] || '#3b82f6'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <motion.div
                className="text-[22px] font-bold tracking-tight"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <span className={colorMap[readiness.color]}>{score.percentage}</span>
                <span className="text-base-500 text-[14px]">%</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Readiness info */}
        <div className="flex-1 min-w-0">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-[12px] font-semibold ${bgMap[readiness.color]} ${colorMap[readiness.color]} mb-2`}>
            <Shield size={13} />
            {readiness.label}
          </div>
          <div className="text-[13px] text-base-400 mb-3">{readiness.description}</div>

          <div className="flex items-center gap-4 text-[12px]">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-500" />
              <span className="text-base-400">{report.passedChecks} passed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle size={13} className="text-red-500" />
              <span className="text-base-400">{report.failedChecks} failed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-500" />
              <span className="text-base-400">{report.warningChecks} warnings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category mini scores */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {score.categories.map((cat) => (
          <div key={cat.id} className="panel !bg-base-950 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-base-500 uppercase tracking-wider">{cat.label}</span>
              <span className={`text-[11px] font-semibold ${
                cat.percentage >= 75 ? 'text-emerald-400' : cat.percentage >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {cat.percentage}%
              </span>
            </div>
            <div className="h-1 bg-base-800 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${categoryColors[cat.id] || 'bg-blue-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${cat.percentage}%` }}
                transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
