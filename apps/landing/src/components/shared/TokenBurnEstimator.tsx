import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, AlertTriangle, Shield, Zap, Key, TrendingUp, ToggleLeft, ToggleRight, ShieldAlert } from 'lucide-react';

type RiskLevel = 'safe' | 'medium' | 'critical';

const RISK_CONFIG: Record<RiskLevel, { color: string; glow: string; label: string }> = {
  safe: { color: '#10b981', glow: 'rgba(16,185,129,0.25)', label: 'Minimal Exposure' },
  medium: { color: '#f59e0b', glow: 'rgba(245,158,11,0.25)', label: 'Rate Limiting Incomplete' },
  critical: { color: '#f43f5e', glow: 'rgba(244,63,94,0.35)', label: 'Denial of Wallet Active!' },
};

const GAUGE_CX = 100;
const GAUGE_CY = 108;
const GAUGE_R = 82;
const START_ANGLE = -180;
const END_ANGLE = 0;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const costHistoryData = [
  { x: 0, y: 20 }, { x: 1, y: 35 }, { x: 2, y: 28 }, { x: 3, y: 55 },
  { x: 4, y: 42 }, { x: 5, y: 68 }, { x: 6, y: 55 }, { x: 7, y: 82 },
  { x: 8, y: 70 }, { x: 9, y: 95 }, { x: 10, y: 78 }, { x: 11, y: 60 },
];

const riskFactors = [
  {
    id: 'unprotected-route',
    severity: 'danger' as const,
    icon: ShieldAlert,
    title: 'Unprotected API Route',
    detail: '/api/agent/route.ts lacks Upstash rate-limiting or Auth protection.',
  },
  {
    id: 'request-limit',
    severity: 'warning' as const,
    icon: Zap,
    title: 'Request-Based Limit Only',
    detail: 'Counting requests instead of raw token consumption. Vulnerable to context window flooding.',
  },
  {
    id: 'no-keys',
    severity: 'success' as const,
    icon: Key,
    title: 'No Hardcoded Keys',
    detail: 'No live process.env keys exposed in client code.',
  },
];

function pointToString(p: { x: number; y: number }) {
  return `${p.x},${p.y}`;
}

export function TokenBurnEstimator() {
  const [attackMode, setAttackMode] = useState(false);
  const [burnPercent, setBurnPercent] = useState(32);
  const [displayBurn, setDisplayBurn] = useState(4850);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const risk: RiskLevel = attackMode ? 'critical' : burnPercent < 40 ? 'safe' : burnPercent < 70 ? 'medium' : 'critical';
  const cfg = RISK_CONFIG[risk];

  useEffect(() => {
    if (attackMode) {
      const target = 5000;
      const step = 15;
      intervalRef.current = setInterval(() => {
        setDisplayBurn((prev) => {
          const next = prev + step;
          if (next >= target) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return target;
          }
          return next;
        });
        setBurnPercent((prev) => {
          const next = prev + 0.5;
          if (next >= 98) return 98;
          return next;
        });
      }, 30);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayBurn(4850);
      setBurnPercent(32);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [attackMode]);

  const endAngle = START_ANGLE + (burnPercent / 100) * 180;
  const arcPath = describeArc(GAUGE_CX, GAUGE_CY, GAUGE_R, START_ANGLE, endAngle);
  const bgArcPath = describeArc(GAUGE_CX, GAUGE_CY, GAUGE_R, START_ANGLE, END_ANGLE);

  const maxCostY = Math.max(...costHistoryData.map(d => d.y));
  const sparkLine = costHistoryData.map(d => ({
    x: (d.x / 11) * 100,
    y: 100 - (d.y / maxCostY) * 80,
  }));

  return (
    <div
      className="relative rounded-2xl bg-[#0D1224]/80 backdrop-blur-sm border border-white/[0.08] p-5 transition-all duration-500"
      style={{ boxShadow: `0 0 30px ${cfg.glow}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <DollarSign size={15} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-white">Financial Risk & Token Burn</h3>
          <p className="text-[10px] text-white/30 tracking-wide">{cfg.label}</p>
        </div>
        {attackMode && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30"
          >
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-rose-400"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-semibold text-rose-400 whitespace-nowrap">DoW Active</span>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Gauge */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[220px] mx-auto">
            <svg viewBox="0 0 200 130" className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="gaugeFill" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={cfg.color} />
                  <stop offset="100%" stopColor={attackMode ? '#f43f5e' : burnPercent < 40 ? '#06b6d4' : cfg.color} />
                </linearGradient>
                <filter id="gaugeGlow">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={cfg.color} floodOpacity="0.6" />
                </filter>
              </defs>

              {/* Background arc */}
              <path d={bgArcPath} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14" strokeLinecap="round" />

              {/* Fill arc */}
              <motion.path
                d={arcPath}
                fill="none"
                stroke="url(#gaugeFill)"
                strokeWidth="14"
                strokeLinecap="round"
                filter="url(#gaugeGlow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: burnPercent / 100 }}
                transition={{ duration: attackMode ? 0.1 : 1.2, ease: 'easeOut' }}
              />

              {/* Tick marks */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const angle = START_ANGLE + (tick / 100) * 180;
                const outer = polarToCartesian(GAUGE_CX, GAUGE_CY, GAUGE_R + 10, angle);
                const inner = polarToCartesian(GAUGE_CX, GAUGE_CY, GAUGE_R - 4, angle);
                const labelP = polarToCartesian(GAUGE_CX, GAUGE_CY, GAUGE_R + 22, angle);
                return (
                  <g key={tick}>
                    <line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
                    <text
                      x={labelP.x} y={labelP.y}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="rgba(255,255,255,0.25)"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      {tick === 0 ? '$0' : tick === 100 ? '$10k' : `$${tick / 10}k`}
                    </text>
                  </g>
                );
              })}

              {/* Center label */}
              <text x="100" y="92" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="sans-serif" fontWeight="500" letterSpacing="2">
                EST. MAX DAILY BURN
              </text>
            </svg>

            <div className="absolute inset-0 top-2 flex flex-col items-center justify-center pointer-events-none">
              <motion.span
                className="text-2xl font-bold tracking-tight"
                style={{ color: cfg.color, textShadow: `0 0 20px ${cfg.color}40` }}
              >
                ${displayBurn.toLocaleString()}
              </motion.span>
              <span className="text-[10px] text-white/30 font-medium mt-0.5">/ day</span>
            </div>
          </div>

          {/* Burn bar below gauge */}
          <div className="w-full max-w-[200px] mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-white/30">
              <span>Burn Exposure</span>
              <span style={{ color: cfg.color }}>{burnPercent.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${cfg.color}, ${attackMode ? '#f43f5e' : burnPercent < 40 ? '#06b6d4' : cfg.color})` }}
                animate={{ width: `${burnPercent}%` }}
                transition={{ duration: attackMode ? 0.1 : 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Right: Risk factors */}
        <div className="lg:col-span-3 space-y-3">
          {riskFactors.map((factor, i) => {
            const Icon = factor.icon;
            const severityStyles = {
              danger: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
              warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
              success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            };
            const badgeLabels = {
              danger: attackMode ? 'CRITICAL' : 'DANGER',
              warning: 'WARNING',
              success: 'PASS',
            };
            return (
              <motion.div
                key={factor.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 * i }}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${severityStyles[factor.severity]}`}>
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-semibold text-white">{factor.title}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${severityStyles[factor.severity]}`}>
                        {badgeLabels[factor.severity]}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 leading-relaxed">{factor.detail}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Cost velocity sparkline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <TrendingUp size={12} className="text-rose-400" />
              <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Simulated Cost Velocity Spike</span>
            </div>
            <svg viewBox="0 0 100 30" className="w-full h-8 overflow-visible">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cfg.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={cfg.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M ${sparkLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}`}
                fill="none"
                stroke={cfg.color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={attackMode ? 'url(#gaugeGlow)' : undefined}
              />
              <path
                d={`M ${sparkLine.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} L ${sparkLine[sparkLine.length - 1].x.toFixed(1)} 100 L ${sparkLine[0].x.toFixed(1)} 100 Z`}
                fill="url(#sparkFill)"
              />
              {attackMode && (
                <motion.circle
                  cx={sparkLine[sparkLine.length - 1].x}
                  cy={sparkLine[sparkLine.length - 1].y}
                  r="2.5"
                  fill={cfg.color}
                  animate={{ r: [2.5, 4, 2.5] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </svg>
          </motion.div>
        </div>
      </div>

      {/* Bottom: Toggle */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={13} className={attackMode ? 'text-rose-400' : 'text-white/30'} />
          <span className="text-[11px] font-medium text-white/60">Simulate Attack</span>
        </div>
        <button
          onClick={() => setAttackMode(!attackMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-300 ${
            attackMode
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60'
          }`}
        >
          {attackMode ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {attackMode ? 'ACTIVE' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
