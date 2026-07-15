import { useState, useEffect, useRef } from 'react';
import { useScanStore } from '../../store/scan-store';
import { ScanProgress } from './ScanProgress';
import { ScanTerminal } from './ScanTerminal';
import { getReadinessLabel } from '@shared/scoring';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, AlertTriangle, CheckCircle, FileCode,
  ChevronDown,
  XCircle,
} from 'lucide-react';

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

/* ───────────── Sub-Components ───────────── */

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
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Accordion / view state */
  const [accordionOpen, setAccordionOpen] = useState(true);
  const [selectedFile, setSelectedFile] = useState('cors');
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['app', 'prisma']));

  const score = report?.score?.percentage ?? 89;
  const readiness = getReadinessLabel(score);
  const ringColor = readiness.color === 'emerald' ? '#10b981' : readiness.color === 'blue' ? '#3b82f6' : readiness.color === 'amber' ? '#f59e0b' : '#ef4444';

  /* Simulation interval */
  useEffect(() => {
    if (simActive) {
      simRef.current = setInterval(() => {
        setBurnCost(prev => Math.min(prev + 85, 4850));
      }, 40);
    } else {
      if (simRef.current) clearInterval(simRef.current);
      setBurnCost(0);
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

  const passedChecks = report?.passedChecks ?? 55;
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

          {/* ── Section 1: Score + Cost Risk ── */}
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

            {/* Cost risk — pink/rose theme matching HTML */}
            <div className="lg:col-span-8 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden transition-all duration-300"
              style={{
                background: simActive ? 'rgba(251,207,232,0.08)' : 'var(--bg-card)',
                border: `1px solid ${simActive ? 'rgba(244,114,182,0.4)' : 'var(--border-subtle)'}`,
                boxShadow: simActive ? '0 0 30px rgba(244,114,182,0.12)' : 'none',
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="h-2 w-2 rounded-full animate-pulse"
                      style={{ background: 'var(--accent-rose)' }}
                    />
                    <span className="text-[11px] font-mono tracking-wider font-semibold uppercase" style={{ color: 'var(--accent-rose)' }}>
                      Cost Risk — What If Someone Spams You?
                    </span>
                  </div>
                  <h3 className="text-base font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                    AI endpoint vulnerable to context flood attacks
                  </h3>
                  <p className="text-xs mt-1.5 max-w-lg leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    Shows what happens if your API endpoints get hammered without protection. An attacker can loop context window inputs, inflating your LLM bills instantly.
                  </p>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg flex-shrink-0" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <span className="text-[10px] font-mono font-semibold" style={{ color: 'var(--text-tertiary)' }}>SIMULATE ATTACK</span>
                  <button
                    onClick={() => setSimActive(!simActive)}
                    className="w-10 h-6 rounded-full p-1 transition-colors duration-300"
                    style={{ background: simActive ? 'var(--accent-rose)' : 'var(--text-tertiary)' }}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300"
                      style={{ transform: simActive ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4 mt-5" style={{ borderColor: simActive ? 'rgba(244,114,182,0.2)' : 'var(--border-subtle)' }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono transition-colors duration-300"
                    style={{ color: simActive ? 'var(--accent-rose)' : 'var(--text-primary)' }}
                  >
                    ${simActive ? burnCost.toLocaleString() : '0'}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: 'var(--accent-rose)' }}>
                    WORST-CASE DAILY BURN
                  </span>
                </div>
                <span
                  className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-md border"
                  style={{
                    background: simActive ? 'rgba(244,114,182,0.15)' : 'var(--bg-hover)',
                    color: simActive ? 'var(--accent-rose)' : 'var(--text-tertiary)',
                    borderColor: simActive ? 'rgba(244,114,182,0.3)' : 'var(--border-subtle)',
                  }}
                >
                  {simActive ? 'RISK: CRITICAL' : 'RISK: NEGLIGIBLE'}
                </span>
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

            {/* File Map — simplified matching HTML */}
            <div className="lg:col-span-5 rounded-2xl p-6 flex flex-col overflow-hidden"
              style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-[11px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>// Repository File Map</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>Tree View</span>
              </div>

              <div className="space-y-1 font-mono text-[12px]">
                {treeData.map(dir => (
                  <div key={dir.name}>
                    <div
                      className="flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer hover:bg-white/[0.03]"
                      style={{ color: 'var(--text-secondary)' }}
                      onClick={() => toggleFolder(dir.name)}
                    >
                      <span>{dir.risk === 'critical' ? '📁' : '📁'} {dir.name}/</span>
                      <span className="text-[10px]" style={{ color: 'var(--accent-amber)' }}>{dir.badge}</span>
                    </div>
                    <AnimatePresence initial={false}>
                      {openFolders.has(dir.name) && dir.children?.map(child => (
                        <motion.div
                          key={child.name}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.12 }}
                        >
                          <div
                            onClick={() => { if (child.key) { setSelectedFile(child.key); setAccordionOpen(true); } }}
                            className="flex items-center justify-between p-2 pl-8 rounded-lg transition-colors cursor-pointer hover:bg-white/[0.03]"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <span>📄 {child.name}</span>
                            {child.risk === 'critical' && (
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent-amber)' }} />
                            )}
                            {child.risk === 'secure' && (
                              <span className="text-[10px]" style={{ color: 'var(--accent-emerald)' }}>PASSED</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Section 4: Readme Badge snippet ── */}
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 space-y-6">
              {/* Other Audits Completed */}
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                <h4 className="text-[11px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>// Other Audits Completed</h4>
                <div className="space-y-2">
                  <div className="flex items-start justify-between p-3 rounded-lg"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-emerald-500 font-bold text-sm mt-0.5">✓</span>
                      <div>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No Keys Leaking</span>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>No API tokens or production credentials found embedded inside raw bundles.</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)', border: '1px solid var(--accent-emerald-border)' }}>
                      PASSED
                    </span>
                  </div>

                  <div className="flex items-start justify-between p-3 rounded-lg"
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-amber-500 font-bold text-sm mt-0.5">!</span>
                      <div>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recursive Loop Vulnerability Detected</span>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>No context limit fallback mechanism found in chat middleware router.</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)', border: '1px solid var(--accent-amber-border)' }}>
                      WARN
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Readme Badge snippet */}
            <div className="xl:col-span-4 rounded-2xl p-6 space-y-4"
              style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)' }}
            >
              <span className="text-[11px] font-mono uppercase block" style={{ color: 'var(--text-tertiary)' }}>// Readme Badge snippet</span>
              <div className="relative rounded-lg p-3" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
                <pre className="text-[11px] font-mono overflow-x-auto select-all" style={{ color: 'var(--text-tertiary)' }}>
                  <code>{`![Preflight](https://preflight.com/shield/${report?.repoName || 'marsley01/Edyfra'})`}</code>
                </pre>
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
