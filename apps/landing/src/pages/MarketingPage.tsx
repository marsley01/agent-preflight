import { Link } from 'react-router-dom';
import { Shield, Zap, Activity, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#030712]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white font-display">Preflight</span>
          </div>
          <div>
            <Link 
              to="/dashboard" 
              className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/30 text-white flex items-center gap-2"
            >
              Enter Dashboard
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-40 pb-32 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-center mb-8"
          >
            <div className="px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-medium flex items-center gap-2 backdrop-blur-sm">
              <Lock className="w-4 h-4" />
              <span>Next-Generation Autonomous Security</span>
            </div>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight font-display"
          >
            Secure Your Stack with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
              Agentic Intelligence
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 text-xl max-w-2xl mx-auto text-slate-400 leading-relaxed" 
          >
            Preflight provides continuous, autonomous vulnerability scanning and threat detection, working tirelessly so your engineering team doesn't have to.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 flex justify-center gap-6"
          >
            <Link 
              to="/dashboard" 
              className="px-8 py-4 rounded-full text-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
            >
              Open Dashboard
              <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="relative z-10 mt-32 max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-6 h-6 text-blue-400" />,
                title: "Lightning Execution",
                desc: "Scans execute in milliseconds using advanced heuristics, providing real-time feedback on your security posture without slowing down CI/CD."
              },
              {
                icon: <Shield className="w-6 h-6 text-indigo-400" />,
                title: "Deep Coverage",
                desc: "Detects vulnerabilities across your entire stack—from frontend dependencies to misconfigured cloud infrastructure and IAM roles."
              },
              {
                icon: <Activity className="w-6 h-6 text-purple-400" />,
                title: "Autonomous Agents",
                desc: "Always-on AI agents track your security metrics, automatically triaging alerts and filtering out noise to highlight critical threats."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-black/50 flex items-center justify-center mb-6 border border-white/5">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-white font-display">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
