import { Link } from 'react-router-dom';
import { Shield, Zap, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MarketingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Navigation */}
      <nav className="border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <span className="font-semibold text-lg tracking-tight">Preflight</span>
          </div>
          <div>
            <Link 
              to="/dashboard" 
              className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight"
          >
            Agentic Security for the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
              Modern Enterprise
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-xl max-w-2xl mx-auto" 
            style={{ color: 'var(--text-secondary)' }}
          >
            Preflight provides autonomous security scanning, threat detection, and continuous monitoring to keep your infrastructure secure.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 flex justify-center gap-4"
          >
            <Link 
              to="/dashboard" 
              className="px-8 py-3 rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
            >
              Open Dashboard
            </Link>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="mt-32 grid gap-8 grid-cols-1 md:grid-cols-3">
          <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-xl border" 
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Lightning Fast</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Scans execute in milliseconds, providing real-time feedback on your security posture.</p>
          </motion.div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-xl border" 
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Comprehensive Coverage</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Detects vulnerabilities across your entire stack, from frontend to cloud infrastructure.</p>
          </motion.div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-xl border" 
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Continuous Monitoring</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Always-on agents track your security metrics and alert you to anomalous activity.</p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
