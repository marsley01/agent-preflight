import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useThemeStore } from './store/theme-store';
import MarketingPage from './pages/MarketingPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <Routes>
      <Route path="/" element={<MarketingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
