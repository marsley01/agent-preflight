import { Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DocsPage from './components/DocsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/docs" element={<DocsPage />} />
    </Routes>
  );
}