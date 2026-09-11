import { useMemo } from 'react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { verdictFromScore } from '../lib/findings';
import type { ScanHistoryEntry } from '../store/scan-store';

const GREEN = '#16a34a';
const AMBER = '#d97706';
const RED = '#dc2626';
const NO_SCORE = '#e4e4e7';

export function scoreColor(percentage: number): string {
  if (percentage >= 90) return GREEN;
  if (percentage >= 75) return AMBER;
  return RED;
}

export function HealthGauge({ percentage, size = 200 }: { percentage: number; size?: number }) {
  const color = scoreColor(percentage);
  const data = [{ name: 'score', value: percentage }];
  const verdict = verdictFromScore(percentage);

  return (
    <div className="relative w-full" style={{ maxWidth: size, height: size, margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          startAngle={210}
          endAngle={-30}
          data={data}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={10} fill={color} background={{ fill: NO_SCORE }} />
          <Tooltip
            cursor={false}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontSize: 13,
              background: '#ffffff',
            }}
            formatter={(value) => [`${value}%`, 'Readiness']}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-4xl font-bold tracking-tight" style={{ color: color }}>
          {percentage}%
        </div>
        <div className="mt-1 text-[13px] font-medium text-zinc-600">{verdict.title}</div>
      </div>
    </div>
  );
}

export interface DonutData {
  passed: number;
  warned: number;
  failed: number;
}

export function CategoryDonut({ percentage, counts }: { percentage: number; counts: DonutData }) {
  const color = scoreColor(percentage);
  const data = useMemo(() => {
    const segments: Array<{ name: string; value: number; color: string }> = [];
    if (counts.passed > 0) segments.push({ name: 'Passed', value: counts.passed, color: GREEN });
    if (counts.warned > 0) segments.push({ name: 'Warnings', value: counts.warned, color: AMBER });
    if (counts.failed > 0) segments.push({ name: 'Issues', value: counts.failed, color: RED });
    if (segments.length === 0) segments.push({ name: 'Passed', value: 1, color: NO_SCORE });
    return segments;
  }, [counts]);

  return (
    <div className="relative w-full" style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="68%"
            outerRadius="92%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            paddingAngle={2}
            cornerRadius={4}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontSize: 13,
              background: '#ffffff',
            }}
            formatter={(value, name) => [`${value}`, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div>
          <div className="text-center text-3xl font-bold" style={{ color }}>
            {percentage}
            <span className="text-lg font-semibold text-zinc-400">%</span>
          </div>
          <div className="text-center text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            score
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryLineChart({ history }: { history: ScanHistoryEntry[] }) {
  const data = useMemo(
    () =>
      history.map((h) => ({
        label: new Date(h.timestamp).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        score: h.score,
      })),
    [history]
  );

  const singlePoint = data.length === 1;
  const yTop = useMemo(() => {
    const vals = data.map((d) => d.score);
    const max = Math.max(100, ...vals);
    return max + 5;
  }, [data]);

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f2" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            domain={[0, yTop]}
            tick={{ fontSize: 11, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e4e4e7',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              fontSize: 13,
              background: '#ffffff',
            }}
            formatter={(value) => [`${value}%`, 'Readiness']}
            labelFormatter={(label) => `Scan on ${label}`}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#18181b"
            strokeWidth={2.5}
            dot={{ r: singlePoint ? 5 : 3.5, fill: scoreColor(data[0]?.score ?? 0), strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#18181b' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}