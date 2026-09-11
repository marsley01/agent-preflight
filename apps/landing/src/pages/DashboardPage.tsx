import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { OverviewView } from '../components/OverviewView';
import { ProgressView } from '../components/ProgressView';
import { RulesCatalogView } from '../components/RulesCatalogView';
import { DocsView } from '../components/DocsView';
import { SearchModal } from '../components/SearchModal';
import { Toast } from '../components/Toast';
import { useScanStore } from '../store/scan-store';
import { getReadinessLabel } from '@shared/scoring';

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = searchParams.get('tab') || 'scan';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleQuickScan = async () => {
    handleTabChange('scan');
    showToast('Starting scan...');
    const report = await useScanStore.getState().triggerScan();
    if (report?.status === 'complete') {
      showToast(`Scan complete: ${report.score.percentage}% readiness (${getReadinessLabel(report.score.percentage).label})`);
    } else if (report?.status === 'error') {
      showToast(`Scan failed: ${report.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-body-md text-on-surface flex flex-col justify-between selection:bg-secondary-container selection:text-on-surface">
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenSearch={() => setIsSearchOpen(true)}
        onQuickScan={handleQuickScan}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onSelectPath={(path) => {
          if (path === '/docs') navigate('/docs');
          else handleTabChange(path);
        }}
      />

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      <main className="w-full pt-14 bg-background min-h-[calc(100vh-80px)] flex-1">
        {activeTab === 'scan' && (
          <OverviewView onNavigateTab={handleTabChange} onShowToast={showToast} />
        )}
        {activeTab === 'progress' && (
          <ProgressView onShowToast={showToast} onNavigateTab={handleTabChange} />
        )}
        {activeTab === 'checks' && (
          <RulesCatalogView onShowToast={showToast} />
        )}
        {activeTab === 'learn' && (
          <DocsView onShowToast={showToast} />
        )}
      </main>

      <footer className="w-full bg-surface-container-low border-t border-surface-container-high mt-space-xl">
        <div className="w-full px-gutter-desktop max-w-[1600px] mx-auto py-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-md font-body-sm text-body-sm text-on-surface-variant">
          <div className="flex items-center gap-space-md">
            <span>© 2025 Preflight</span>
          </div>
          <div className="flex items-center gap-space-lg">
            <button
              type="button"
              onClick={() => navigate('/docs')}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Docs
            </button>
            <a
              href="https://github.com/anomalyco/agent-preflight"
              target="_blank"
              rel="noreferrer"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={() => showToast('Changes land in the repository changelog')}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Changelog
            </button>
            <a
              href="https://github.com/anomalyco/agent-preflight/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Apache 2.0
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}