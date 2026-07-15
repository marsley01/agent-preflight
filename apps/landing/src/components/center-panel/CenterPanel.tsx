import { useState, useEffect, useRef } from 'react';
import { useScanStore } from '../../store/scan-store';
import { ScanProgress } from './ScanProgress';
import { ScanTerminal } from './ScanTerminal';
import { getReadinessLabel } from '@shared/scoring';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, AlertTriangle, CheckCircle, FileWarning, FileCheck,
  Folder, FolderOpen, FileCode, Globe, Database, Cpu, Layers, Wind,
  Banknote, Search, GitFork, ChevronDown, ChevronRight,
  Copy, Check, ExternalLink, Github, LayoutGrid, ListTree,
  Terminal, KeyRound, ShieldCheck, XCircle, Sparkles,
} from 'lucide-react';

/* ───────────── Mock data ───────────── */

const techStack = [
  { name: 'Next.js 15.0', icon: Terminal, color: 'text-slate-200', bg: 'bg-white/[0.03]', border: 'border-white/[0.08]', status: 'All clear' },
  { name: 'Supabase', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', status: 'RLS inspected' },
  { name: 'Vercel AI SDK', icon: Cpu, color: 'text-violet-400', bg: 'bg-violet-500/5', border: 'border-violet-500/20', status: 'APIs audited' },
  { name: 'Prisma ORM', icon: Layers, color: 'text-indigo-400', bg: 'bg-indigo-500/5', border: 'border-indigo-500/20', status: 'Safe ops' },
  { name: 'Tailwind CSS', icon: Wind, color: 'text-cyan-400', bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', status: 'Static assets good' },
];

const vulnerabilities = [
  { id: 'cors', file: 'app/api/chat/route.ts', label: 'Unrestricted CORS', severity: 'warning' as const, desc: 'Wildcard origin header needs scoping.' },
  { id: 'prisma', file: 'prisma/schema.prisma', label: 'RLS Policy Check', severity: 'warning' as const, desc: 'Row-level security flagged on User model.' },
];

const diffData: Record<string, { title: string; subtitle: string; removed: string[]; added: string[] }> = {
  cors: {
    title: 'Unrestricted CORS Configuration',
    subtitle: 'Wildcard origin setup in your API handler.',
    removed: [
      'export async function POST(req: Request) {',
      '  // Overly Permissive CORS Headers',
      '  return Response.json(data, {',
      '    headers: {',
      "      'Access-Control-Allow-Origin': '*'",
      '    }',
      '  });',
      '}',
    ],
    added: [
      'export async function POST(req: Request) {',
      "  const origin = req.headers.get('origin');",
      "  const allowed = ['https://edyfra.ke'];",
      "  const accessControl = allowed.includes(origin) ? origin : '';",
      '  return Response.json(data, {',
      '    headers: {',
      "      'Access-Control-Allow-Origin': accessControl",
      '    }',
      '  });',
      '}',
    ],
  },
  prisma: {
    title: 'Prisma Schema — RLS Check',
    subtitle: 'Row-level security policies could be tighter.',
    removed: ['// No RLS policies defined on User model'],
    added: [
      'datasource db {',
      '  provider = "postgresql"',
      '  url      = env("DATABASE_URL")',
      '}',
      '',
      'model User {',
      '  id    String @id @default(cuid())',
      '  email String @unique',
      '  @@rowLevelSecurity(enabled: true)',
      '}',
    ],
  },
};

type RiskTier = 'critical' | 'warning' | 'secure' | 'info';

const treeData: { name: string; risk: RiskTier; badge?: string; children: { name: string; risk: RiskTier; key?: string }[] }[] = [
  {
    name: 'app', risk: 'critical', badge: '1 Warning',
    children: [
      { name: 'api/chat/route.ts', risk: 'critical', key: 'cors' },
      { name: 'page.tsx', risk: 'secure' },
    ],
  },
  {
    name: 'prisma', risk: 'secure', badge: 'Audited',
    children: [
      { name: 'schema.prisma', risk: 'secure', key: 'prisma' },
    ],
  },
  {
    name: 'components', risk: 'secure', badge: 'Passed',
    children: [
      { name: 'Hero.tsx', risk: 'secure' },
      { name: 'Navbar.tsx', risk: 'secure' },
    ],
  },
];

const RISK: Record<RiskTier, { text: string; bg: string; border: string; fill: string }> = {
  critical: { text: 'text-red-400', bg: 'bg-red-500/[0.03]', border: 'border-l-2 border-red-500', fill: 'from-red-500/20 to-red-950/40' },
  warning: { text: 'text-amber-400', bg: 'bg-amber-500/[0.03]', border: 'border-l-2 border-amber-500', fill: 'from-amber-500/20 to-amber-950/40' },
  secure: { text: 'text-emerald-400', bg: 'bg-emerald-500/[0.02]', border: 'border-l-2 border-emerald-500', fill: 'from-emerald-500/20 to-emerald-950/40' },
  info: { text: 'text-slate-400', bg: '', border: '', fill: 'from-white/[0.04] to-white/[0.01]' },
};

/* ───────────── Sub-Components ───────────── */

function TechBadge({ name, icon: Icon, color, bg, border, status }: typeof techStack[0]) {
  return (
    <div className="group relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 cursor-help"
      style={{ background: bg, border: `1px solid ${border.replace('border-', '')}`, color }}
    >
      <Icon size={14} />
      <span>{name}</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 hidden group-hover:block z-30 shadow-xl rounded-lg p-2 text-[10px]"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
      >
        <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>{name}</span>
        <span className="block mt-1" style={{ color: 'var(--accent-cyan)' }}>Status: {status}</span>
      </div>
    </div>
  );
}

function DiffPanel({ fileKey }: { fileKey: string }) {
  const diff = diffData[fileKey];
  if (!diff) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl"
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
          <FileCode size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span>{vulnerabilities.find(v => v.id === fileKey)?.file}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--diff-remove-bg)', border: '1px solid var(--diff-remove-border)' }}>
          <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'var(--diff-remove-bg)', borderBottom: '1px solid var(--diff-remove-border)' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-rose)' }}>Current</span>
            <span className="text-xs font-mono" style={{ color: 'var(--accent-rose)' }}>- Removed</span>
          </div>
          <pre className="p-4 font-mono text-xs overflow-x-auto leading-relaxed" style={{ color: 'var(--accent-rose)' }}>
            {diff.removed.map((line, i) => (
              <div key={i} className="text-rose-400/80"><span className="text-rose-500 select-none">- </span>{line}</div>
            ))}
          </pre>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--diff-add-bg)', border: '1px solid var(--diff-add-border)' }}>
          <div className="px-3 py-1.5 flex items-center justify-between" style={{ background: 'var(--diff-add-bg)', borderBottom: '1px solid var(--diff-add-border)' }}>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent-emerald)' }}>Fixed</span>
            <span className="text-xs font-mono" style={{ color: 'var(--accent-emerald)' }}>+ Added</span>
          </div>
          <pre className="p-4 font-mono text-xs overflow-x-auto leading-relaxed" style={{ color: 'var(--accent-emerald)' }}>
            {diff.added.map((line, i) => (
              <div key={i} className="text-emerald-400/80"><span className="text-emerald-500 select-none">+ </span>{line}</div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Main Component ───────────── */

export function CenterPanel() {
  const report = useScanStore((s) => s.report);
  const isScanning = useScanStore((s) => s.isScanning);
  const error = useScanStore((s) => s.error);

  /* Simulation state */
  const [simActive, setSimActive] = useState(false);
  const [burnCost, setBurnCost] = useState(0);
  const [burnPct, setBurnPct] = useState(5);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Accordion / view state */
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState('cors');
  const [mapMode, setMapMode] = useState<'tree' | 'grid'>('tree');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['app', 'prisma']));

  /* Badge state */
  const [badgeStyle, setBadgeStyle] = useState<'neon' | 'flat' | 'compact'>('neon');
  const [badgeCopied, setBadgeCopied] = useState(false);

  const score = report?.score?.percentage ?? 95;
  const readiness = getReadinessLabel(score);
  const ringColor = readiness.color === 'emerald' ? '#10b981' : readiness.color === 'blue' ? '#3b82f6' : readiness.color === 'amber' ? '#f59e0b' : '#ef4444';

  /* Simulation interval */
  useEffect(() => {
    if (simActive) {
      simRef.current = setInterval(() => {
        setBurnCost(prev => Math.min(prev + 85, 4850));
        setBurnPct(prev => Math.min(prev + 1.8, 95));
      }, 40);
    } else {
      if (simRef.current) clearInterval(simRef.current);
      setBurnCost(0);
      setBurnPct(5);
    }
    return () => { if (simRef.current) clearInterval(simRef.current); };
  }, [simActive]);

  const toggleFolder = (name: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleBadgeCopy = async () => {
    const code = `[![Agent Preflight](https://agent-preflight.vercel.app/api/badge?repo=${report?.repoName || 'marsley01/Edyfra'})](https://agent-preflight.vercel.app/dashboard?repo=${report?.repoName || 'marsley01/Edyfra'})`;
    try {
      await navigator.clipboard.writeText(code);
      setBadgeCopied(true);
      setTimeout(() => setBadgeCopied(false), 2000);
    } catch {}
  };

  const totalChecks = report?.totalChecks ?? 56;
  const passedChecks = report?.passedChecks ?? 55;
  const failedChecks = report?.failedChecks ?? 0;
  const warningCount = report?.warningChecks ?? 1;

  /* ── Empty state ── */
  if (!report && !isScanning && !error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-2xl opacity-20 blur-xl" />
            <div className="relative w-20 h-20 flex items-center justify-center rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <Shield size={36} style={{ color: 'var(--accent-emerald)' }} />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ready to scan a repo</h2>
          <p className="text-[13px] leading-relaxed mb-8" style={{ color: 'var(--text-tertiary)' }}>
            Paste a GitHub URL in the search bar above to run a full security check.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6 max-w-[1600px] w-full mx-auto">

          {/* ── Section 1: Stack badges ── */}
          <section>
            <div className="rounded-2xl p-5 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent-cyan)' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent-cyan)' }} />
                </span>
                <div>
                  <h3 className="text-xs font-extrabold tracking-widest uppercase" style={{ color: 'var(--text-tertiary)' }}>What We're Working With</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Pulled these from your repo's dependencies.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {techStack.map(t => <TechBadge key={t.name} {...t} />)}
              </div>
            </div>
          </section>

          {/* ── Section 2: Score + Cost Risk ── */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Score ring */}
            <div className="lg:col-span-4 rounded-2xl p-6 flex flex-col justify-between items-center text-center relative overflow-hidden group transition-all duration-300"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none transition-all" style={{ background: `${ringColor}10` }} />
              <div className="w-full flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Readiness Score</span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald-border)' }}
                >
                  Ship it!
                </span>
              </div>
              <div className="relative flex items-center justify-center my-4">
                <svg className="w-36 h-36 transform -rotate-90">
                  <circle cx="72" cy="72" r="60" stroke="var(--border-subtle)" strokeWidth="12" fill="transparent" />
                  <circle cx="72" cy="72" r="60" stroke={ringColor} strokeWidth="12" fill="transparent"
                    strokeDasharray="377" strokeDashoffset={377 - (377 * score) / 100} strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${ringColor}80)` }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>{score}</span>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>of 100</span>
                </div>
              </div>
              <p className="text-xs max-w-xs mt-2 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                Nothing critical going on. A few low-level things to check but you're good.
              </p>
            </div>

            {/* Cost risk */}
            <div className="lg:col-span-8 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300"
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${simActive ? 'var(--accent-rose-border)' : 'var(--border-subtle)'}`,
                boxShadow: simActive ? `0 0 25px ${simActive ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.05)'}` : 'none',
              }}
            >
              <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl" style={{ background: simActive ? 'var(--accent-rose-bg)' : 'var(--accent-emerald-bg)' }}>
                    <Banknote size={20} style={{ color: simActive ? 'var(--accent-rose)' : 'var(--accent-emerald)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cost Risk — What If Someone Spams You?</h3>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Shows what happens if your API endpoints get hammered.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-1.5 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-[10px] font-bold uppercase tracking-wide pl-2" style={{ color: 'var(--text-tertiary)' }}>Simulate Attack</span>
                  <button
                    onClick={() => setSimActive(!simActive)}
                    className="w-11 h-6 flex items-center rounded-full p-1 duration-300 cursor-pointer"
                    style={{ background: simActive ? 'var(--accent-rose)' : 'var(--text-tertiary)' }}
                  >
                    <div className="w-4 h-4 rounded-full shadow-md transform duration-300 bg-white"
                      style={{ transform: simActive ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl"
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="relative w-40 h-24 flex items-end justify-center overflow-hidden">
                    <div className="absolute inset-0 border-8 rounded-full" style={{ borderColor: 'var(--border-subtle)' }} />
                    <div className="absolute inset-0 border-8 border-transparent rounded-full rotate-45 transform duration-500"
                      style={{
                        borderTopColor: simActive ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                        borderRightColor: simActive ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                        transform: `rotate(${45 + (burnPct / 100) * 135}deg)`,
                      }}
                    />
                    <div className="text-center z-10">
                      <span className="text-3xl font-extrabold tracking-tight transition-colors duration-300"
                        style={{ color: simActive ? 'var(--accent-rose)' : 'var(--text-primary)' }}
                      >
                        ${simActive ? burnCost.toLocaleString() : '0'}
                      </span>
                      <span className="block text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        Worst-Case Daily Burn
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                    style={{
                      background: simActive ? 'var(--accent-rose-bg)' : 'var(--accent-emerald-bg)',
                      color: simActive ? 'var(--accent-rose)' : 'var(--accent-emerald)',
                      borderColor: simActive ? 'var(--accent-rose-border)' : 'var(--accent-emerald-border)',
                    }}
                  >
                    {simActive ? 'Risk: Critical' : 'Risk: Negligible'}
                  </div>
                </div>

                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                  >
                    <CheckCircle size={16} style={{ color: 'var(--accent-emerald)' }} className="mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No Keys Leaking</h4>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>No API keys or secrets exposed in your source code.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl transition-all duration-300"
                    style={{
                      background: simActive ? 'var(--accent-rose-bg)' : 'var(--bg-hover)',
                      border: `1px solid ${simActive ? 'var(--accent-rose-border)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    {simActive
                      ? <AlertTriangle size={16} style={{ color: 'var(--accent-rose)' }} className="mt-0.5 shrink-0" />
                      : <CheckCircle size={16} style={{ color: 'var(--accent-emerald)' }} className="mt-0.5 shrink-0" />
                    }
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        {simActive ? 'Recursive Loop Vulnerability Triggered' : 'Rate Limiter Working'}
                      </h4>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                        {simActive
                          ? 'No rate limiter guarding against context window flooding.'
                          : 'Your API routes have throttling in place.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Issues + File Map ── */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Audit findings */}
            <div className="lg:col-span-7 rounded-2xl p-6 flex flex-col space-y-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Issues We Found</h3>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Click around to see what needs fixing.</p>
                </div>
                <div className="flex gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold" style={{ background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald-border)' }}>
                    {passedChecks} Checks OK
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold" style={{ background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-border)' }}>
                    {warningCount} Warning{warningCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Accordion */}
                <div className="rounded-xl overflow-hidden transition-all"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <button
                    onClick={() => setAccordionOpen(!accordionOpen)}
                    className="w-full flex items-center justify-between p-4 transition-all"
                    style={{ background: 'var(--bg-hover)' }}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <AlertTriangle size={16} style={{ color: 'var(--accent-amber)' }} />
                      <div>
                        <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{diffData[selectedFile]?.title}</h4>
                        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{diffData[selectedFile]?.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-border)' }}
                      >
                        Warning
                      </span>
                      <ChevronDown size={16} className="transition-transform duration-200" style={{ transform: accordionOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-tertiary)' }} />
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {accordionOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                        style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--code-bg)' }}
                      >
                        <div className="p-4">
                          <DiffPanel fileKey={selectedFile} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Passed check */}
                <div className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-3 text-left">
                    <CheckCircle size={16} style={{ color: 'var(--accent-emerald)' }} />
                    <div>
                      <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>No Hardcoded Secrets</h4>
                      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No env vars leaked into the frontend bundle.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald-border)' }}
                  >
                    Passed
                  </span>
                </div>
              </div>
            </div>

            {/* File map */}
            <div className="lg:col-span-5 rounded-2xl p-6 flex flex-col overflow-hidden"
              style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Folder size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>File Map</h3>
                </div>
                <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                  <button onClick={() => setMapMode('tree')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${mapMode === 'tree' ? '' : ''}`}
                    style={{
                      background: mapMode === 'tree' ? 'var(--bg-hover)' : 'transparent',
                      color: mapMode === 'tree' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    <ListTree size={12} className="inline mr-1" />Tree
                  </button>
                  <button onClick={() => setMapMode('grid')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${mapMode === 'grid' ? '' : ''}`}
                    style={{
                      background: mapMode === 'grid' ? 'var(--bg-hover)' : 'transparent',
                      color: mapMode === 'grid' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    <LayoutGrid size={12} className="inline mr-1" />Grid
                  </button>
                </div>
              </div>

              {mapMode === 'tree' ? (
                <div className="space-y-3 font-mono text-xs">
                  {treeData.map(dir => {
                    const risk = RISK[dir.risk];
                    const isOpen = openFolders.has(dir.name);
                    return (
                      <div key={dir.name} className="rounded-xl overflow-hidden"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                      >
                        <button onClick={() => toggleFolder(dir.name)}
                          className="w-full flex items-center justify-between p-3 transition-all"
                          style={{ background: risk.bg, borderLeft: risk.border === 'border-l-2 border-red-500' ? '2px solid var(--accent-rose)' : risk.border === 'border-l-2 border-amber-500' ? '2px solid var(--accent-amber)' : risk.border === 'border-l-2 border-emerald-500' ? '2px solid var(--accent-emerald)' : '' }}
                        >
                          <div className="flex items-center gap-2" style={{ color: risk.text }}>
                            {isOpen ? <FolderOpen size={16} /> : <Folder size={16} />}
                            <span className="font-bold">{dir.name}/</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                            style={{ background: risk.bg, border: '1px solid var(--border-subtle)', color: risk.text }}
                          >
                            {dir.badge}
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="overflow-hidden border-t px-2 pb-2 pt-1 pl-6 space-y-1"
                              style={{ borderColor: 'var(--border-subtle)', background: 'var(--code-bg)' }}
                            >
                              {dir.children?.map(child => {
                                const childRisk = RISK[child.risk];
                                return (
                                  <div key={child.name}
                                    onClick={() => { if (child.key) setSelectedFile(child.key); setAccordionOpen(true); }}
                                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all"
                                    style={{ background: 'var(--bg-hover)' }}
                                  >
                                    <div className="flex items-center gap-2" style={{ color: childRisk.text }}>
                                      {child.risk === 'critical' ? <FileWarning size={14} /> : <FileCheck size={14} />}
                                      <span>{child.name}</span>
                                    </div>
                                    {child.risk === 'critical' && (
                                      <span className="text-[8px] uppercase tracking-wider font-bold" style={{ color: 'var(--accent-rose)' }}>CORS Warn</span>
                                    )}
                                    {child.risk === 'secure' && (
                                      <span className="text-[8px] uppercase" style={{ color: 'var(--text-muted)' }}>Passed</span>
                                    )}
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    Bigger blocks = more code. Hot colors = problems.
                  </p>
                  <div className="grid grid-cols-12 h-44 gap-2 font-mono text-[10px]">
                    <div onClick={() => { setSelectedFile('cors'); setAccordionOpen(true); }}
                      className="col-span-8 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                      style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(153,27,27,0.4))', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                      <span className="font-bold block uppercase" style={{ color: 'var(--accent-rose)' }}>/app (API)</span>
                      <span className="text-[8px] font-bold block mt-4" style={{ color: 'var(--accent-rose)' }}>1 CORS Warning</span>
                    </div>
                    <div onClick={() => { setSelectedFile('prisma'); setAccordionOpen(true); }}
                      className="col-span-4 rounded-xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
                      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,78,59,0.4))', border: '1px solid rgba(16,185,129,0.3)' }}
                    >
                      <span className="font-bold block uppercase" style={{ color: 'var(--accent-emerald)' }}>/prisma</span>
                      <span className="text-[8px] block mt-4" style={{ color: 'var(--accent-emerald)' }}>Audit Complete</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 4: Badge exporter ── */}
          <section>
            <div className="rounded-2xl p-6"
              style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Grab a Badge for Your README</h3>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Show off your score on GitHub.</p>
                  </div>
                  <div className="flex gap-2 p-1 rounded-xl w-max"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                  >
                    {(['neon', 'flat', 'compact'] as const).map(s => (
                      <button key={s} onClick={() => setBadgeStyle(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize`}
                        style={{
                          background: badgeStyle === s ? 'var(--bg-hover)' : 'transparent',
                          color: badgeStyle === s ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}
                      >
                        {s === 'neon' ? 'Cyber Neon' : s === 'flat' ? 'Flat Shield' : 'Compact'}
                      </button>
                    ))}
                  </div>
                  <div className="p-6 rounded-2xl flex items-center justify-center min-h-[100px]"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                  >
                    {badgeStyle === 'neon' && (
                      <div className="flex items-center gap-3 rounded-full p-1 pr-4 transition-all hover:scale-105 cursor-pointer"
                        style={{
                          background: 'var(--bg-base)',
                          border: '1px solid var(--accent-emerald-border)',
                          boxShadow: `0 0 15px ${ringColor}20`,
                        }}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-emerald-bg)' }}>
                          <ShieldCheck size={16} style={{ color: 'var(--accent-emerald)' }} />
                        </div>
                        <div>
                          <span className="text-[9px] block font-bold uppercase tracking-wider leading-none" style={{ color: 'var(--text-tertiary)' }}>Preflight</span>
                          <span className="text-xs font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>{score}% Secure</span>
                        </div>
                      </div>
                    )}
                    {badgeStyle === 'flat' && (
                      <div className="flex items-center rounded-md overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-subtle)' }}>
                          <Shield size={12} style={{ color: 'var(--text-tertiary)' }} />
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Preflight</span>
                        </div>
                        <div className="px-3 py-1.5" style={{ background: 'var(--accent-emerald-bg)' }}>
                          <span className="text-[11px] font-bold" style={{ color: 'var(--accent-emerald)' }}>{score}% Secure</span>
                        </div>
                      </div>
                    )}
                    {badgeStyle === 'compact' && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent-emerald)' }} />
                          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent-emerald)' }} />
                        </span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>preflight:{score}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: 'var(--text-tertiary)' }}>Markdown Snippet</span>
                  <div className="relative">
                    <pre className="p-4 rounded-xl font-mono text-xs overflow-x-auto select-all leading-relaxed"
                      style={{ background: 'var(--code-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                      [![Agent Preflight](https://agent-preflight.vercel.app/api/badge?repo={report?.repoName || 'marsley01/Edyfra'})](https://agent-preflight.vercel.app/dashboard?repo={report?.repoName || 'marsley01/Edyfra'})
                    </pre>
                    <button onClick={handleBadgeCopy}
                      className="absolute top-3 right-3 p-2 rounded-lg text-xs transition-all"
                      style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)', color: badgeCopied ? 'var(--accent-emerald)' : 'var(--text-tertiary)' }}
                    >
                      {badgeCopied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    <Github size={11} />
                    <span>Badge links to <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{report?.repoName || 'marsley01/Edyfra'}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Terminal and progress ── */}
          {error && !isScanning && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--accent-rose-bg)', border: '1px solid var(--accent-rose-border)' }}>
              <div className="flex items-start gap-3">
                <XCircle size={16} style={{ color: 'var(--accent-rose)' }} className="mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-rose)' }}>Scan Failed</div>
                  <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{error}</div>
                </div>
              </div>
            </div>
          )}
          <ScanTerminal />
          {isScanning && <ScanProgress />}
        </div>
      </div>
    </div>
  );
}
