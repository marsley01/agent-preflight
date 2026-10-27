import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { setThemePref, useThemePref, type ThemePref } from '../lib/theme';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSearch: () => void;
}

export const NAV_ITEMS: Array<{ id: string; label: string; icon: IconName; route?: string }> = [
  { id: 'scan', label: 'Scan', icon: 'search' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
  { id: 'checks', label: 'Checks', icon: 'list-checks' },
  { id: 'learn', label: 'CLI & CI', icon: 'terminal' },
  { id: 'docs', label: 'Docs', icon: 'books', route: '/docs' },
];

export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const THEME_ORDER: ThemePref[] = ['system', 'light', 'dark'];
const THEME_ICON: Record<ThemePref, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onOpenSearch }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const theme = useThemePref();
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.route ? pathname === item.route : pathname === '/' && activeTab === item.id;

  const go = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.route) navigate(item.route);
    else onTabChange(item.id);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-surface-container-high bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-space-md px-4 sm:px-6">
        <button
          type="button"
          onClick={() => (pathname === '/' ? onTabChange('scan') : navigate('/'))}
          className="flex items-center gap-2 rounded-lg pr-1"
          aria-label="Preflight home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Icon name="arrow-up-right" size={15} weight="bold" />
          </span>
          <span className="font-headline-sm text-on-surface">Preflight</span>
        </button>

        <nav aria-label="Main" className="ml-space-md hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item)}
              aria-current={isActive(item) ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 font-label-md transition-colors ${
                isActive(item)
                  ? 'bg-surface-container text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-9 items-center gap-2 rounded-lg border border-surface-container-high bg-surface-container-lowest px-2.5 font-label-md text-on-surface-variant transition-colors hover:text-on-surface sm:w-52"
          >
            <Icon name="search" size={15} />
            <span className="hidden sm:inline">Search checks</span>
            <kbd className="ml-auto hidden rounded border border-surface-container-high px-1.5 text-[11px] text-secondary sm:inline">
              {MOD_KEY} K
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => setThemePref(nextTheme)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label={`Theme: ${theme}. Switch to ${nextTheme}`}
            title={`Theme: ${theme}`}
          >
            <Icon name={THEME_ICON[theme]} size={17} />
          </button>
          <a
            href="https://github.com/marsley01/agent-preflight"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            aria-label="Preflight on GitHub"
          >
            <Icon name="github" size={18} />
          </a>
        </div>
      </div>

      {/* Mobile: tabs move to a scrollable row under the bar */}
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden [scrollbar-width:none]">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item)}
            aria-current={isActive(item) ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-label-md transition-colors ${
              isActive(item) ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
};

export const Footer: React.FC = () => (
  <footer className="mt-16 border-t border-surface-container-high">
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-6 font-body-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span>Preflight is open source under the MIT license.</span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {[
          ['GitHub', 'https://github.com/marsley01/agent-preflight'],
          ['Changelog', 'https://github.com/marsley01/agent-preflight/blob/main/CHANGELOG.md'],
          ['Security', 'https://github.com/marsley01/agent-preflight/blob/main/SECURITY.md'],
          ['npm', 'https://www.npmjs.com/package/@preflight-agent/cli'],
        ].map(([label, href]) => (
          <a key={label} href={href} target="_blank" rel="noreferrer" className="transition-colors hover:text-on-surface">
            {label}
          </a>
        ))}
      </div>
    </div>
  </footer>
);
