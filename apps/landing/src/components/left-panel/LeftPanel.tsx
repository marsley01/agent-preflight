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
  Plus,
} from 'lucide-react';
import { useScanStore } from '../../store/scan-store';

interface NavItem {
  id: string;
  label: string;
  icon: typeof FolderGit2;
  badge?: string | number;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { id: 'projects', label: 'Projects', icon: FolderGit2 },
      { id: 'scans', label: 'Scan History', icon: History, badge: 0 },
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
  const report = useScanStore((s) => s.report);

  navGroups[0].items[1].badge = history.length || undefined;

  return (
    <aside className="w-[240px] border-r border-base-800 bg-base-950 flex flex-col flex-shrink-0 overflow-y-auto">
      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-600" />
          <input
            type="text"
            placeholder="Search projects..."
            className="input-field pl-8 text-[12px] py-1.5"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 pb-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-600">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                    isActive
                      ? 'bg-base-800 text-base-100'
                      : 'text-base-400 hover:text-base-200 hover:bg-base-800/50'
                  }`}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-base-800 text-base-400">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight size={12} className="text-base-500" />}
                </button>
              );
            })}
          </div>
        ))}

        {/* Recent Scans */}
        {history.length > 0 && (
          <div>
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-base-600">
              Recent Scans
            </div>
            {history.slice(0, 5).map((scan) => (
              <button
                key={scan.id}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-base-400 hover:text-base-200 hover:bg-base-800/50 transition-colors"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    scan.status === 'complete'
                      ? scan.score.percentage >= 75
                        ? 'bg-emerald-500'
                        : scan.score.percentage >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      : scan.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-base-600'
                  }`}
                />
                <span className="flex-1 text-left truncate">{scan.repoName}</span>
                <span className="text-[10px] text-base-600">
                  {scan.score.percentage}%
                </span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom: Settings */}
      <div className="border-t border-base-800 p-2">
        <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] text-base-400 hover:text-base-200 hover:bg-base-800/50 transition-colors">
          <Settings size={15} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
