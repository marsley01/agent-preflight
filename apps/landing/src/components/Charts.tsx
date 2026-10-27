import { useMemo } from 'react';
import { verdictFromScore, type Verdict } from '../lib/findings';

export type Tone = 'pass' | 'warn' | 'fail';

export function scoreTone(percentage: number): Tone {
  if (percentage >= 90) return 'pass';
  if (percentage >= 75) return 'warn';
  return 'fail';
}

/** Tailwind text color for a tone. Status colors are theme tokens, so they adapt to dark mode. */
export const TONE_TEXT: Record<Tone, string> = {
  pass: 'text-status-pass',
  warn: 'text-status-warn',
  fail: 'text-status-fail',
};

const TONE_STROKE: Record<Tone, string> = {
  pass: 'stroke-status-pass',
  warn: 'stroke-status-warn',
  fail: 'stroke-status-fail',
};

/** Readiness score as a 270° ring. Pure SVG: no chart library, follows the theme. */
export function ScoreRing({ percentage, size = 176, verdict = verdictFromScore(percentage) }: { percentage: number; size?: number; verdict?: Verdict }) {
  const tone = verdict.tone === 'pass' ? scoreTone(percentage) : verdict.tone;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = circumference * 0.75;
  const filled = (arc * Math.max(0, Math.min(100, percentage))) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          className="stroke-surface-container-high"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className={`${TONE_STROKE[tone]} transition-[stroke-dasharray] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-4xl font-semibold tracking-tight tabular-nums ${TONE_TEXT[tone]}`}>
          {percentage}
          <span className="text-xl text-secondary">%</span>
        </div>
        <div className="mt-0.5 font-label-sm text-on-surface-variant">{verdict.title}</div>
      </div>
      <span className="sr-only">
        Readiness {percentage} percent: {verdict.title}
      </span>
    </div>
  );
}

/** Thin score bar for category rows. */
export function ScoreBar({ percentage }: { percentage: number }) {
  const tone = scoreTone(percentage);
  const fill = { pass: 'bg-status-pass', warn: 'bg-status-warn', fail: 'bg-status-fail' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden="true">
      <div className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-out`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

export function useSortedByTime<T extends { timestamp: number }>(items: T[]): T[] {
  return useMemo(() => [...items].sort((a, b) => a.timestamp - b.timestamp), [items]);
}
