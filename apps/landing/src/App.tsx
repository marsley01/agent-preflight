import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';

// The reference docs are a large static page; load them only when visited.
const DocsPage = lazy(() => import('./components/DocsPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route
        path="/docs"
        element={
          <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
            <DocsPage />
          </Suspense>
        }
      />
    </Routes>
  );
}
