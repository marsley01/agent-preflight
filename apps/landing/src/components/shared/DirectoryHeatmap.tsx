import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderOpen,
  FileCode,
  Shield,
  ShieldAlert,
  AlertTriangle,
  LayoutGrid,
  ListTree,
  ChevronRight,
  Lock,
  Eye,
} from 'lucide-react';

type RiskTier = 'critical' | 'warning' | 'secure' | 'info';

interface FileEntry {
  name: string;
  type: 'file' | 'folder';
  risk: RiskTier;
  issues?: { label: string; count: number }[];
  description?: string;
  size?: number;
  children?: FileEntry[];
}

const mockTree: FileEntry[] = [
  {
    name: 'app',
    type: 'folder',
    risk: 'critical',
    issues: [{ label: 'critical', count: 1 }, { label: 'warnings', count: 2 }],
    description: 'Next.js App Router — API routes lack rate-limiting',
    size: 240,
    children: [
      {
        name: 'api',
        type: 'folder',
        risk: 'critical',
        issues: [{ label: 'critical', count: 1 }],
        description: 'Unsecured API handlers',
        size: 180,
        children: [
          {
            name: 'chat',
            type: 'folder',
            risk: 'critical',
            issues: [{ label: 'critical', count: 1 }],
            description: 'OpenAI proxy route',
            size: 120,
            children: [
              { name: 'route.ts', type: 'file', risk: 'critical', issues: [{ label: 'critical', count: 1 }], description: 'Lacks Upstash rate-limiting and auth protection', size: 120 },
            ],
          },
        ],
      },
      {
        name: 'layout.tsx',
        type: 'file',
        risk: 'secure',
        issues: [{ label: 'passed', count: 3 }],
        description: 'Root layout — all checks passed',
        size: 40,
      },
    ],
  },
  {
    name: 'prisma',
    type: 'folder',
    risk: 'warning',
    issues: [{ label: 'warnings', count: 2 }],
    description: 'Schema & migrations — RLS checks flagged',
    size: 200,
    children: [
      { name: 'schema.prisma', type: 'file', risk: 'warning', issues: [{ label: 'warnings', count: 2 }], description: 'Row Level Security policies need review', size: 140 },
      { name: 'seed.ts', type: 'file', risk: 'secure', issues: [{ label: 'passed', count: 1 }], description: 'Seed script — clean', size: 60 },
    ],
  },
  {
    name: 'components',
    type: 'folder',
    risk: 'secure',
    issues: [{ label: 'passed', count: 5 }],
    description: 'React components — fully sanitized',
    size: 160,
    children: [
      { name: 'Hero.tsx', type: 'file', risk: 'secure', issues: [{ label: 'passed', count: 2 }], description: 'Static section — no vulnerabilities', size: 80 },
      { name: 'Navbar.tsx', type: 'file', risk: 'secure', issues: [{ label: 'passed', count: 3 }], description: 'Client nav — all audits passed', size: 80 },
    ],
  },
  {
    name: 'lib',
    type: 'folder',
    risk: 'info',
    issues: [{ label: 'info', count: 1 }],
    description: 'Shared utilities & helpers',
    size: 120,
    children: [
      { name: 'supabase.ts', type: 'file', risk: 'info', issues: [{ label: 'info', count: 1 }], description: 'Supabase client — configured', size: 70 },
      { name: 'utils.ts', type: 'file', risk: 'secure', issues: [], description: 'Utility functions — clean', size: 50 },
    ],
  },
  {
    name: 'package.json',
    type: 'file',
    risk: 'info',
    issues: [{ label: 'info', count: 1 }],
    description: 'Dependencies — 1 outdated package',
    size: 30,
  },
];

type ViewMode = 'tree' | 'treemap';

const RISK_STYLES: Record<RiskTier, {
  text: string; bg: string; border: string; hover: string; glow: string;
  icon: typeof Shield; label: string; fill: string;
}> = {
  critical: {
    text: 'text-red-400', bg: 'bg-red-500/5', border: 'border-l-2 border-red-500',
    hover: 'hover:bg-red-500/10', glow: 'rgba(244,63,94,0.15)',
    icon: ShieldAlert, label: 'CRITICAL', fill: 'from-red-600/40 to-rose-600/20',
  },
  warning: {
    text: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-l-2 border-amber-500',
    hover: 'hover:bg-amber-500/10', glow: 'rgba(245,158,11,0.15)',
    icon: AlertTriangle, label: 'WARNING', fill: 'from-amber-600/40 to-yellow-600/20',
  },
  secure: {
    text: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-l-2 border-emerald-500',
    hover: 'hover:bg-emerald-500/10', glow: 'rgba(16,185,129,0.15)',
    icon: Lock, label: 'SECURE', fill: 'from-emerald-600/40 to-green-600/20',
  },
  info: {
    text: 'text-white/40', bg: 'bg-white/[0.02]', border: 'border-l-2 border-white/[0.06]',
    hover: 'hover:bg-white/[0.04]', glow: 'rgba(255,255,255,0.05)',
    icon: Eye, label: 'INFO', fill: 'from-white/[0.06] to-white/[0.02]',
  },
};

function TreeFile({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const [open, setOpen] = useState(true);
  const Icon = entry.type === 'folder' ? (open ? FolderOpen : Folder) : FileCode;
  const s = RISK_STYLES[entry.risk];

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 ${s.bg} ${s.hover} ${s.border} transition-all duration-150 rounded-r-lg cursor-default group`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => entry.type === 'folder' && setOpen(!open)}
      >
        {entry.type === 'folder' && (
          <ChevronRight
            size={10}
            className={`text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
        )}
        <Icon size={14} className={`${s.text} flex-shrink-0`} />
        <span className={`text-[13px] font-medium ${s.text} truncate`}>
          {entry.name}
        </span>
        {entry.issues && entry.issues.length > 0 && (
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            {entry.issues.map((iss) => (
              <span
                key={iss.label}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  iss.label === 'critical'
                    ? 'bg-red-500/15 text-red-400'
                    : iss.label === 'warnings'
                      ? 'bg-amber-500/15 text-amber-400'
                      : iss.label === 'passed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/[0.06] text-white/40'
                }`}
              >
                {iss.label === 'passed' ? '' : '!'} {iss.count} {iss.label === 'passed' ? '✓' : iss.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {entry.type === 'folder' && entry.children && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {entry.children.map((child, i) => (
              <div key={child.name + i} className="relative">
                <div className="absolute left-[22px] top-0 bottom-0 w-px bg-white/[0.04]" style={{ marginLeft: `${depth * 20}px` }} />
                <TreeFile entry={child} depth={depth + 1} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TreemapBlock({ entry, depth = 0 }: { entry: FileEntry; depth?: number }) {
  const s = RISK_STYLES[entry.risk];
  const Icon = entry.type === 'folder' ? Folder : FileCode;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`relative rounded-xl bg-gradient-to-br ${s.fill} border border-white/[0.06] p-3 transition-all duration-200 cursor-default overflow-hidden`}
      style={{
        boxShadow: hovered ? `0 0 20px ${s.glow}` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} className={s.text} />
        <span className={`text-[11px] font-semibold ${s.text} truncate`}>{entry.name}</span>
      </div>
      {entry.description && (
        <p className="text-[9px] text-white/40 leading-relaxed line-clamp-2">{entry.description}</p>
      )}
      {entry.issues && entry.issues.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {entry.issues.map((iss) => (
            <span
              key={iss.label}
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                iss.label === 'critical'
                  ? 'bg-red-500/20 text-red-300'
                  : iss.label === 'warnings'
                    ? 'bg-amber-500/20 text-amber-300'
                    : iss.label === 'passed'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/[0.06] text-white/40'
              }`}
            >
              {iss.count} {iss.label}
            </span>
          ))}
        </div>
      )}
      {hovered && entry.children && (
        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
          {entry.children.map((child, i) => (
            <TreemapBlock key={child.name + i} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const totalSize = (entries: FileEntry[]): number =>
  entries.reduce((sum, e) => sum + (e.size || 0) + (e.children ? totalSize(e.children) : 0), 0);

const MAX_VISIBLE_DEPTH = 2;

export function DirectoryHeatmap() {
  const [view, setView] = useState<ViewMode>('tree');
  const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);

  return (
    <div className="rounded-2xl bg-[#0B0F19]/90 border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <ShieldAlert size={15} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-white">Repository Heatmap Explorer</h3>
            <p className="text-[10px] text-white/30">marsley01/Edyfra</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#030712] border border-white/[0.06]">
            <button
              onClick={() => setView('tree')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all duration-200 ${
                view === 'tree' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              <ListTree size={12} />
              Tree
            </button>
            <button
              onClick={() => setView('treemap')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all duration-200 ${
                view === 'treemap' ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/60'
              }`}
            >
              <LayoutGrid size={12} />
              Treemap
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {view === 'tree' ? (
        <div className="py-2 max-h-[420px] overflow-y-auto">
          {mockTree.map((entry, i) => (
            <TreeFile key={entry.name + i} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="p-4 max-h-[420px] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mockTree.map((entry, i) => (
              <TreemapBlock key={entry.name + i} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Footer legend */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-t border-white/[0.06] bg-[#030712]/50">
        {(['critical', 'warning', 'secure', 'info'] as RiskTier[]).map((tier) => {
          const s = RISK_STYLES[tier];
          return (
            <div key={tier} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-sm ${tier === 'critical' ? 'bg-red-500' : tier === 'warning' ? 'bg-amber-500' : tier === 'secure' ? 'bg-emerald-500' : 'bg-white/30'}`} />
              <span className="text-[9px] font-medium uppercase tracking-wider text-white/30">{tier}</span>
            </div>
          );
        })}
        <span className="ml-auto text-[9px] text-white/15">{totalSize(mockTree)} files scanned</span>
      </div>
    </div>
  );
}
