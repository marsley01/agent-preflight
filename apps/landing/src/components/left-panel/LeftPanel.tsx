import { useState } from 'react';
import {
  FolderGit2,
  History,
  GitBranch,
  GitPullRequest,
  Cloud,
  Settings,
  Search,
  ChevronRight,
} from 'lucide-react';
import { useScanStore } from '../../store/scan-store';

interface NavItem {
  id: string;
  label: string;
  icon: typeof FolderGit2;
  badge?: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'projects', label: 'Projects', icon: FolderGit2 },
      { id: 'scans', label: 'Scan History', icon: History },
      { id: 'branches', label: 'Branches', icon: GitBranch },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'github', label: 'GitHub', icon: GitPullRequest },
      { id: 'deployments', label: 'Deployments', icon: Cloud },
    ],
  },
];

export function LeftPanel() {
  const [active, setActive] = useState('projects');
  const history = useScanStore((s) => s.history);

  const badges: Record<string, string | undefined> = {
    scans: history.length > 0 ? String(history.length) : undefined,
  };

  return (
    <aside
      className="w-[220px] border-r flex flex-col flex-shrink-0"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
    >
      {/* Search — height-aligned with header inputs */}
      <div className="px-3 pt-2.5 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search projects..."
            className="input-field pl-8 text-[12px]"
            style={{ height: '30px', borderRadius: '4px' }}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div
              className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              const badge = badges[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] transition-colors"
                  style={{
                    background: isActive ? 'var(--bg-hover)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderRadius: '4px',
                  }}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)', borderRadius: '4px' }}
                    >
                      {badge}
                    </span>
                  )}
                  {isActive && <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />}
                </button>
              );
            })}
          </div>
        ))}

        {/* Recent Scans */}
        {history.length > 0 && (
          <div>
            <div
              className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Recent Scans
            </div>
            {history.slice(0, 5).map((scan) => (
              <button
                key={scan.id}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] transition-colors"
                style={{ color: 'var(--text-secondary)', borderRadius: '4px' }}
              >
                <div
                  className="w-1.5 h-1.5 flex-shrink-0"
                  style={{
                    background: scan.status === 'complete'
                      ? scan.score.percentage >= 75
                        ? 'var(--accent-emerald)'
                        : scan.score.percentage >= 50
                          ? 'var(--accent-amber)'
                          : 'var(--accent-rose)'
                      : 'var(--text-tertiary)',
                    borderRadius: '4px',
                  }}
                />
                <span className="flex-1 text-left truncate">{scan.repoName}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {scan.score.percentage}%
                </span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom: Settings */}
      <div className="border-t p-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] transition-colors"
          style={{ color: 'var(--text-secondary)', borderRadius: '4px' }}
        >
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
