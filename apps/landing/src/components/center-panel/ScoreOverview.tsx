import { useScanStore } from '../../store/scan-store';
import { getReadinessLabel } from '@shared/scoring';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';

export function ScoreOverview() {
  const report = useScanStore((s) => s.report);

  if (!report) return null;

  const { score } = report;
  const readiness = getReadinessLabel(score.percentage);

  const radarData = score.categories.map(cat => ({
    category: cat.label,
    score: cat.percentage,
  }));

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Col 1: Readiness Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative rounded-2xl bg-[#0F172A]/50 border border-white/[0.08] p-5 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-cyan-500/[0.03]" />
        <div className="relative">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-4">
            Readiness Score
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-36 h-36">
              <svg width="144" height="144" viewBox="0 0 144 144" className="transform -rotate-90">
                <defs>
                  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <filter id="ringGlow">
                    <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.5" />
                  </filter>
                </defs>
                <circle cx="72" cy="72" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <motion.circle
                  cx="72" cy="72" r="60"
                  fill="none"
                  stroke="url(#ringGradient)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 60}
                  initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - score.percentage / 100) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  filter="url(#ringGlow)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <motion.div
                    className="text-4xl font-bold tracking-tight text-white"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
                  >
                    {score.percentage}
                  </motion.div>
                  <div className="text-[11px] mt-0.5 text-white/40">/ 100</div>
                </div>
              </div>
            </div>
            <div className="mt-3 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
              {readiness.label}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Col 2: Radar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
        className="relative rounded-2xl bg-[#0F172A]/50 border border-white/[0.08] p-5"
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
          Category Scores
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <defs>
                <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="category" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} tickCount={5} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#3b82f6"
                fill="url(#radarGradient)"
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Col 3: Scan Summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
        className="relative rounded-2xl bg-[#0F172A]/50 border border-white/[0.08] p-5"
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-4">
          Scan Summary
        </div>
        <div className="space-y-3">
          <SummaryBlock
            label="Total Checks"
            value={report.totalChecks}
            color="#3b82f6"
          />
          <SummaryBlock
            label="Pass Rate"
            value={`${score.percentage}%`}
            color={score.percentage >= 75 ? '#10b981' : score.percentage >= 50 ? '#f59e0b' : '#ef4444'}
          />
          <SummaryBlock
            label="Blockers"
            value={report.failedChecks}
            color={report.failedChecks > 0 ? '#f43f5e' : '#52525b'}
          />
        </div>
      </motion.div>
    </div>
  );
}

function SummaryBlock({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="relative rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5 overflow-hidden transition-all duration-200 hover:bg-white/[0.06]">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: color, boxShadow: `0 0 12px ${color}60` }}
      />
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
