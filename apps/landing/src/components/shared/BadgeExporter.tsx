import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Share, Copy, Check, Code, FileText, FileCode, Github, Sparkles, Palette } from 'lucide-react';

type BadgeStyle = 'neon' | 'flat' | 'dot';
type CodeTab = 'markdown' | 'html' | 'react';

const REPO = 'marsley01/agent-preflight';
const SCORE = 95;

function buildBadgeUrl(style: BadgeStyle): string {
  const base = `https://img.shields.io/badge`;
  switch (style) {
    case 'neon':
      return `${base}/Preflight-${SCORE}%25_Secure-10b981?style=for-the-badge&logo=github&logoColor=white&labelColor=0B0F19`;
    case 'flat':
      return `${base}/Preflight-%20${SCORE}%25%20Secure-0F172A?style=flat-square&logo=shield&logoColor=white&labelColor=030712`;
    case 'dot':
      return `${base}/Preflight-Active-10b981?style=social&logo=github&logoColor=10b981&label=`;
  }
}

function getCodeSnippet(style: BadgeStyle, tab: CodeTab): string {
  const url = buildBadgeUrl(style);
  const alt = `Agent Preflight Security Score: ${SCORE}%`;

  switch (tab) {
    case 'markdown':
      return `[![${alt}]( ${url} )](https://github.com/${REPO})`;
    case 'html':
      return `<a href="https://github.com/${REPO}">\n  <img src="${url}"\n       alt="${alt}" />\n</a>`;
    case 'react':
      return `import Image from "next/image";\n\n<Link href="https://github.com/${REPO}">\n  <Image\n    src="${url}"\n    alt="${alt}"\n    width={220}\n    height={28}\n  />\n</Link>`;
  }
}

function NeonBadge() {
  return (
    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0B0F19] border border-emerald-500/40 shadow-lg shadow-emerald-500/10">
      <div className="flex items-center gap-1.5">
        <Shield size={13} className="text-emerald-400" />
        <span className="text-[12px] font-semibold text-white/90">Preflight</span>
      </div>
      <span className="text-white/20">:</span>
      <span className="text-[12px] font-bold text-emerald-400">{SCORE}% Secure</span>
    </div>
  );
}

function FlatBadge() {
  return (
    <div className="inline-flex items-center bg-[#030712] rounded-md border border-white/[0.1] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] border-r border-white/[0.06]">
        <Shield size={12} className="text-white/50" />
        <span className="text-[11px] font-semibold text-white/70">Preflight</span>
      </div>
      <div className="px-3 py-1.5">
        <span className="text-[11px] font-bold text-emerald-400">{SCORE}% Secure</span>
      </div>
    </div>
  );
}

function DotBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-50" />
        <span className="relative w-2 h-2 bg-emerald-400 rounded-full" />
      </span>
      <span className="text-[11px] font-medium text-white/60">Preflight</span>
      <span className="text-[11px] font-semibold text-emerald-400">Active</span>
    </div>
  );
}

const BADGE_COMPONENTS: Record<BadgeStyle, React.FC> = {
  neon: NeonBadge,
  flat: FlatBadge,
  dot: DotBadge,
};

const STYLE_NAMES: Record<BadgeStyle, string> = {
  neon: 'Cyber Neon',
  flat: 'Flat Shield',
  dot: 'Compact Dot',
};

function SparkleParticles() {
  const particles = Array.from({ length: 12 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-emerald-400"
          initial={{ opacity: 0, x: '50%', y: '50%' }}
          animate={{
            opacity: [0, 1, 0],
            x: `${50 + (Math.random() - 0.5) * 80}%`,
            y: `${50 + (Math.random() - 0.5) * 80}%`,
            scale: [0, 1.5, 0],
          }}
          transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

const CODE_TABS: { id: CodeTab; label: string; icon: typeof Code }[] = [
  { id: 'markdown', label: 'Markdown', icon: FileText },
  { id: 'html', label: 'HTML', icon: FileCode },
  { id: 'react', label: 'React', icon: Code },
];

export function BadgeExporter() {
  const [style, setStyle] = useState<BadgeStyle>('neon');
  const [tab, setTab] = useState<CodeTab>('markdown');
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const BadgePreview = BADGE_COMPONENTS[style];
  const code = getCodeSnippet(style, tab);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setShowConfetti(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => setShowConfetti(false), 1500);
    } catch {}
  }, [code]);

  return (
    <div className="relative rounded-2xl bg-[#070B14]/80 backdrop-blur-md border border-white/[0.08] p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Shield size={16} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-white">Share Your Security Status</h3>
          <p className="text-[10px] text-white/30 tracking-wide">Embed your Preflight badge in any README or site</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Preview */}
        <div className="space-y-4">
          {/* Style selector */}
          <div className="flex items-center gap-2">
            {(['neon', 'flat', 'dot'] as BadgeStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200 ${
                  style === s
                    ? 'bg-white/[0.08] border-white/[0.12] text-white'
                    : 'bg-transparent border-white/[0.06] text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                }`}
              >
                <Palette size={12} />
                {STYLE_NAMES[s]}
              </button>
            ))}
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Live Preview</div>

            {/* Dark GitHub theme */}
            <div className="rounded-xl bg-[#0d1117] border border-white/[0.06] p-5 flex items-center justify-center min-h-[72px]">
              <BadgePreview />
            </div>

            {/* Light GitHub theme */}
            <div className="rounded-xl bg-white border border-white/[0.15] p-5 flex items-center justify-center min-h-[72px]">
              <BadgePreview />
            </div>
          </div>
        </div>

        {/* Right: Code snippets */}
        <div className="space-y-3">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#03050C] border border-white/[0.06] w-fit">
            {CODE_TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
                    tab === t.id
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Code block */}
          <div className="relative group">
            <div className="bg-[#03050C] border border-white/[0.05] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05]">
                <span className="text-[9px] font-mono text-white/20">{tab.toUpperCase()}</span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                    copied
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy Snippet'}
                </button>
              </div>
              <pre className="p-4 overflow-x-auto max-h-[180px] scrollbar-thin">
                <code className="text-[11px] font-mono leading-relaxed text-white/60 whitespace-pre">{code}</code>
              </pre>
            </div>
          </div>

          {/* Repo info */}
          <div className="flex items-center gap-2 text-[10px] text-white/25">
            <Github size={11} />
            <span>Badge links to <span className="text-white/40 font-mono">{REPO}</span></span>
          </div>
        </div>
      </div>

      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && <SparkleParticles />}
      </AnimatePresence>
    </div>
  );
}
