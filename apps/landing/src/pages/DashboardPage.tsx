import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Footer, Header, NAV_ITEMS } from '../components/Header';
import { OverviewView } from '../components/OverviewView';
import { ProgressView } from '../components/ProgressView';
import { RulesCatalogView } from '../components/RulesCatalogView';
import { DocsView } from '../components/DocsView';
import { SearchModal } from '../components/SearchModal';
import { Toast } from '../components/Toast';

const TABS = new Set(NAV_ITEMS.filter((i) => !i.route).map((i) => i.id));

/** Shared toast + search state, used by both the dashboard and the docs page. */
export function useShellState() {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMessage(null), 2800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  return { navigate, isSearchOpen, setIsSearchOpen, toastMessage, setToastMessage, showToast };
}

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab') ?? 'scan';
  const activeTab = TABS.has(requested) ? requested : 'scan';
  const { navigate, isSearchOpen, setIsSearchOpen, toastMessage, setToastMessage, showToast } = useShellState();

  const handleTabChange = (tab: string) => {
    setSearchParams(tab === 'scan' ? {} : { tab });
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const label = NAV_ITEMS.find((i) => i.id === activeTab)?.label;
    document.title = activeTab === 'scan' ? "Preflight: find what's broken before you ship" : `${label} | Preflight`;
  }, [activeTab]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-on-surface">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary">
        Skip to content
      </a>
      <Header activeTab={activeTab} onTabChange={handleTabChange} onOpenSearch={() => setIsSearchOpen(true)} />

      <SearchModal
        isOpen={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onSelectPath={(path) => (path === '/docs' ? navigate('/docs') : handleTabChange(path))}
      />
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      <main id="main" className="flex-1">
        {activeTab === 'scan' && <OverviewView onNavigateTab={handleTabChange} onShowToast={showToast} />}
        {activeTab === 'progress' && <ProgressView onShowToast={showToast} onNavigateTab={handleTabChange} />}
        {activeTab === 'checks' && <RulesCatalogView onShowToast={showToast} />}
        {activeTab === 'learn' && <DocsView onShowToast={showToast} />}
      </main>

      <Footer />
    </div>
  );
}
