import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSearch: () => void;
  onQuickScan: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenSearch,
  onQuickScan,
}) => {
  const navigate = useNavigate();

  const navItems: Array<{ id: string; label: string; icon: string; route?: string }> = [
    { id: 'scan', label: 'Scan', icon: 'search' },
    { id: 'progress', label: 'Progress', icon: 'timeline' },
    { id: 'checks', label: 'Checks', icon: 'checklist' },
    { id: 'learn', label: 'Learn', icon: 'menu_book' },
    { id: 'docs', label: 'Docs', icon: 'auto_stories', route: '/docs' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-surface-container-high/50">
      <div className="h-14 w-full px-gutter-desktop max-w-[1600px] mx-auto flex items-center justify-between gap-space-md">
        {/* Brand & Nav */}
        <div className="flex items-center gap-space-lg">
          <div
            className="flex items-center gap-space-sm cursor-pointer"
            onClick={() => onTabChange('scan')}
          >
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <svg
                className="w-3.5 h-3.5 text-on-primary"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                viewBox="0 0 16 16"
              >
                <path d="M2 13L14 3M14 3H7M14 3V10"></path>
              </svg>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight">
              Preflight
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-space-xs">
            {navItems.map((item) => {
              const isRoute = !!item.route;
              const isActive = isRoute
                ? window.location.pathname === item.route
                : activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (isRoute && item.route) navigate(item.route);
                    else onTabChange(item.id);
                  }}
                  className={`flex items-center gap-space-xs px-space-sm py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-medium'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-space-sm">
          <a
            href="https://github.com/anomalyco/agent-preflight"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-space-xs px-space-sm py-1.5 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            GitHub
          </a>

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-space-xs px-space-sm py-1.5 rounded-lg text-sm text-on-surface-variant bg-surface-container-low hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-surface-container-lowest text-xs text-on-surface-variant shadow-sm border border-surface-container-high">
              ⌘K
            </kbd>
          </button>

          <button
            type="button"
            onClick={onQuickScan}
            className="flex items-center gap-space-xs px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Scan
          </button>
        </div>
      </div>
    </header>
  );
};