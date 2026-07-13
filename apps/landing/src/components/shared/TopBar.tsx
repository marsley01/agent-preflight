import { Command, Zap } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function TopBar() {
  return (
    <header
      className="h-11 flex items-center px-4 border-b flex-shrink-0 gap-3"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--accent-blue)' }}>
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          preflight
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px]"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
        >
          <Command size={12} />
          <span>K</span>
          <span className="mx-1">—</span>
          <span>Command palette</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <a
          href="https://github.com/anomalyco/agent-preflight"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost p-1.5"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
      </div>
    </header>
  );
}
