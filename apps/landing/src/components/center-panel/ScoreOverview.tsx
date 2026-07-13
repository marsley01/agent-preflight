import { useScanStore } from '../../store/scan-store';
import { useThemeStore } from '../../store/theme-store';
import { getReadinessLabel } from '@shared/scoring';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const CATEGORY_COLORS: Record<string, string> = {
  security: '#8b5cf6',
  'ai-safety': '#3b82f6',
  runtime: '#f59e0b',
  infrastructure: '#10b981',
  observability: '#06b6d4',
  performance: '#f97316',
  accessibility: '#ec4899',
  compliance: '#6366f1',
};

const THEME_COLORS: Record<string, { bg: string; panel: string; grid: string; text: string; textPrimary: string }> = {
  dark: {
    bg: '#09090b',
    panel: '#18181b',
    grid: '#27272a',
    text: '#a1a1aa',
    textPrimary: '#f4f4f5',
  },
  light: {
    bg: '#f5f5f5',
    panel: '#ffffff',
    grid: '#e5e5e5',
    text: '#52525b',
    textPrimary: '#171717',
  },
};

export function ScoreOverview() {
  const report = useScanStore((s) => s.report);
  const themeName = useThemeStore((s) => s.theme);
  const T = THEME_COLORS[themeName] || THEME_COLORS.dark;

  if (!report) return null;

  const { score } = report;
  const readiness = getReadinessLabel(score.percentage);
  const ringColor = readiness.color === 'emerald' ? 'var(--accent-emerald)' : readiness.color === 'blue' ? 'var(--accent-blue)' : readiness.color === 'amber' ? 'var(--accent-amber)' : readiness.color === 'orange' ? '#f97316' : 'var(--accent-rose)';

  const ringHex = readiness.color === 'emerald' ? '#10b981' : readiness.color === 'blue' ? '#3b82f6' : readiness.color === 'amber' ? '#f59e0b' : readiness.color === 'orange' ? '#f97316' : '#ef4444';

  const pieData = [
    { name: 'Passed', value: report.passedChecks, color: '#10b981' },
    { name: 'Failed', value: report.failedChecks, color: '#ef4444' },
    { name: 'Warnings', value: report.warningChecks, color: '#f59e0b' },
  ].filter(d => d.value > 0);

  const radarData = score.categories.map(cat => ({
    category: cat.label,
    score: cat.percentage,
    maxScore: 100,
  }));

  const severityMap: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const cat of score.categories) {
    for (const [key, val] of Object.entries(cat.riskCounts)) {
      if (key in severityMap) severityMap[key] += val;
    }
  }
  const severityData = [
    { name: 'Critical', value: severityMap.critical, color: '#ef4444' },
    { name: 'High', value: severityMap.high, color: '#f97316' },
    { name: 'Medium', value: severityMap.medium, color: '#f59e0b' },
    { name: 'Low', value: severityMap.low, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: T.panel, border: `1px solid ${T.grid}`, borderRadius: '6px', padding: '8px 12px', fontSize: '12px' }}>
          <span style={{ color: T.text }}>{label || payload[0].name}: </span>
          <span style={{ color: T.textPrimary, fontWeight: 600 }}>{payload[0].value}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Top row: score ring + pie + stats */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-4 panel p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>Readiness Score</div>
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32">
              <svg width="128" height="128" className="transform -rotate-90">
                <circle cx="64" cy="64" r="56" fill="none" stroke={T.grid} strokeWidth="8" />
                <motion.circle
                  cx="64" cy="64" r="56"
                  fill="none"
                  stroke={ringHex}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 56}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 56 * (1 - score.percentage / 100) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <motion.div
                    className="text-3xl font-bold tracking-tight"
                    style={{ color: ringHex }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    {score.percentage}
                  </motion.div>
                  <div className="text-[10px] mt-0.5" style={{ color: T.text }}>/ 100</div>
                </div>
              </div>
            </div>
            <div className="mt-2 text-center">
              <div className="text-[13px] font-semibold" style={{ color: T.textPrimary }}>{readiness.label}</div>
              <div className="text-[11px]" style={{ color: T.text }}>{readiness.description}</div>
            </div>
          </div>
        </div>

        <div className="col-span-4 panel p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Check Status</div>
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={28}
                    outerRadius={44}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] w-14" style={{ color: T.text }}>{d.name}</span>
                  <span className="text-[12px] font-semibold" style={{ color: T.textPrimary }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-4 panel p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>Scan Summary</div>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Total Checks" value={report.totalChecks} themePanel={T.panel} themeText={T.text} themePrimary={T.textPrimary} />
            <StatBox label="Pass Rate" value={`${score.percentage}%`} color={score.percentage >= 75 ? '#10b981' : score.percentage >= 50 ? '#f59e0b' : '#ef4444'} themePanel={T.panel} themeText={T.text} themePrimary={T.textPrimary} />
            <StatBox label="Blockers" value={report.failedChecks} color={report.failedChecks > 0 ? '#ef4444' : undefined} themePanel={T.panel} themeText={T.text} themePrimary={T.textPrimary} />
            <StatBox label="Duration" value={`${(report.duration / 1000).toFixed(1)}s`} themePanel={T.panel} themeText={T.text} themePrimary={T.textPrimary} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-7 panel p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Category Scores</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke={T.grid} />
                <PolarAngleAxis dataKey="category" tick={{ fill: T.text, fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: T.text, fontSize: 9 }} tickCount={5} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke={ringHex}
                  fill={ringHex}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-5 panel p-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Issues by Severity</div>
          {severityData.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: T.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: T.text, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                  <CartesianGrid stroke={T.grid} horizontal={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: themeName === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={18}>
                    {severityData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-[13px]" style={{ color: 'var(--accent-emerald)' }}>
              ✓ No issues found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, themePanel, themeText, themePrimary }: { label: string; value: string | number; color?: string; themePanel: string; themeText: string; themePrimary: string }) {
  return (
    <div style={{ background: themePanel, border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '12px' }}>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: themeText }}>{label}</div>
      <div className="text-lg font-bold" style={{ color: color || themePrimary }}>{value}</div>
    </div>
  );
}
