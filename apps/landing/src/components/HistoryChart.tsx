import { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { ScanHistoryEntry } from '../store/scan-store';
import { useIsDark } from '../lib/theme';

/** Readiness over time. Lives in its own module so Recharts is only loaded on the Progress tab. */
export default function HistoryChart({ history }: { history: ScanHistoryEntry[] }) {
  const dark = useIsDark();
  const c = dark
    ? { line: '#f4f4f5', grid: '#2a2a2f', tick: '#a1a1aa', tipBg: '#18181b', tipBorder: '#2a2a2f' }
    : { line: '#18181b', grid: '#ececef', tick: '#71717a', tipBg: '#ffffff', tipBorder: '#e4e4e7' };

  const data = useMemo(
    () =>
      history.map((h) => ({
        label: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: h.score,
        repo: h.repoName,
      })),
    [history],
  );

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: c.tick }} axisLine={false} tickLine={false} dy={8} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: c.tick }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: `1px solid ${c.tipBorder}`, fontSize: 13, background: c.tipBg, color: c.line }}
            formatter={(value) => [`${value}%`, 'Readiness']}
            labelFormatter={(label, payload) => `${payload?.[0]?.payload?.repo ?? 'Scan'} on ${label}`}
          />
          <Line type="monotone" dataKey="score" stroke={c.line} strokeWidth={2} dot={{ r: 3.5, fill: c.line, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
