import { useState } from 'react';
import { Shield, Search, KeyRound, Terminal, Github, ExternalLink, LayoutDashboard, AlertTriangle } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: typeof Shield;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Security Dashboard', icon: LayoutDashboard },
  { id: 'scans', label: 'Repository Scans', icon: Search },
  { id: 'secrets', label: 'Secrets Scanner', icon: KeyRound },
  { id: 'playground', label: 'Audit Playground', icon: Terminal },
];

const repo = 'marsley01/Edyfra';

export function LeftPanel() {
  const [active, setActive] = useState('dashboard');

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col border-r"
      style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Branding */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-8">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500"
          style={{ boxShadow: '0 0 20px rgba(139,92,246,0.35)' }}
        >
          <AlertTriangle size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-extrabold tracking-wider uppercase"
            style={{
              background: 'linear-gradient(to right, var(--text-primary), var(--text-secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Preflight
          </h1>
          <span className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: 'var(--accent-cyan)' }}
          >
            AI Security Shield
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
                borderLeft: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                boxShadow: isActive ? 'inset 4px 0 0 rgba(6,182,212,0.1)' : 'none',
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom CTA */}
      <div className="px-4 pb-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Scan any public repo. No tokens or sign-in needed.
          </p>
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Github size={14} />
            <span>Star on GitHub</span>
            <ExternalLink size={12} style={{ color: 'var(--text-tertiary)' }} />
          </a>
        </div>
      </div>
    </aside>
  );
}
