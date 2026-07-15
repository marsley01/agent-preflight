import { useState } from 'react';
import { Globe, Cpu, Database, Palette, Terminal } from 'lucide-react';

interface TechItem {
  id: string;
  name: string;
  icon: typeof Globe;
  color: {
    text: string;
    bg: string;
    border: string;
    shadow: string;
  };
  version: string;
  category: string;
}

const techStack: TechItem[] = [
  {
    id: 'nextjs',
    name: 'Next.js',
    icon: Globe,
    color: {
      text: 'text-white',
      bg: 'bg-white/[0.06]',
      border: 'border-white/[0.12]',
      shadow: 'rgba(255,255,255,0.15)',
    },
    version: '^15.0.0',
    category: 'Framework',
  },
  {
    id: 'vercel-ai',
    name: 'Vercel AI SDK',
    icon: Cpu,
    color: {
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      shadow: 'rgba(139,92,246,0.3)',
    },
    version: '^4.0.0',
    category: 'AI SDK',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: Database,
    color: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      shadow: 'rgba(16,185,129,0.3)',
    },
    version: '^2.10.0',
    category: 'Database',
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    icon: Palette,
    color: {
      text: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      shadow: 'rgba(6,182,212,0.3)',
    },
    version: '^4.3.0',
    category: 'Styling',
  },
  {
    id: 'prisma',
    name: 'Prisma',
    icon: Terminal,
    color: {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      shadow: 'rgba(99,102,241,0.3)',
    },
    version: '^6.0.0',
    category: 'ORM',
  },
];

export function TechStackDetector() {
  const [scanning, setScanning] = useState(false);
  const [tooltipId, setTooltipId] = useState<string | null>(null);

  return (
    <div className="relative rounded-2xl bg-[#0D1224]/80 backdrop-blur-sm border border-white/[0.06] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-50" />
            <span className="relative w-2 h-2 bg-cyan-400 rounded-full" />
          </span>
          <h3 className="text-[13px] font-semibold text-white">Detected Stack</h3>
        </div>
        <span className="text-[10px] text-white/30 font-medium tracking-wide">
          Live Scan Complete
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {techStack.map((tech) => {
          const Icon = tech.icon;
          return (
            <div key={tech.id} className="relative">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${tech.color.bg} ${tech.color.border} ${scanning ? 'animate-pulse' : ''} cursor-default transition-all duration-200 hover:scale-105`}
                style={{
                  boxShadow: tooltipId === tech.id
                    ? `0 0 16px ${tech.color.shadow}`
                    : 'none',
                }}
                onMouseEnter={() => setTooltipId(tech.id)}
                onMouseLeave={() => setTooltipId(null)}
              >
                <Icon size={13} className={tech.color.text} />
                <span className={`text-[12px] font-medium ${tech.color.text}`}>
                  {tech.name}
                </span>
              </div>

              {tooltipId === tech.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
                  <div className="bg-[#0D1224] border border-white/[0.08] rounded-xl px-3.5 py-2.5 shadow-2xl backdrop-blur-xl min-w-[180px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={12} className={tech.color.text} />
                      <span className={`text-[12px] font-semibold ${tech.color.text}`}>
                        {tech.name}
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Version</span>
                        <span className="text-white/80 font-mono">{tech.version}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Category</span>
                        <span className="text-white/80">{tech.category}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/40">Scan Status</span>
                        <span className="text-emerald-400 font-medium">Audited</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0D1224] border-r border-b border-white/[0.08] rotate-45" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
