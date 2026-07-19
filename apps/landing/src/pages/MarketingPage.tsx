import { Link } from 'react-router-dom';
import { Shield, Zap, Activity, ChevronRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MarketingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#030712] text-slate-200">
      
      {/* Background Effects */}
      <div className="absolute top-0 inset-x-0 h-[500px] pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/4 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[-10%] right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] mix-blend-screen animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">Preflight</span>
          </div>
          <div>
            <Link 
              to="/dashboard" 
              className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white flex items-center gap-2"
            >
              Enter Dashboard
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex justify-center mb-8"
        >
          <div className="px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-medium flex items-center gap-2 backdrop-blur-sm">
            <Lock className="w-4 h-4" />
            <span>Next-Generation Autonomous Security</span>
          </div>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight"
        >
          Secure Your Stack with <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 drop-shadow-sm">
            Agentic Intelligence
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-8 text-xl max-w-2xl mx-auto text-slate-400 leading-relaxed" 
        >
          Preflight provides continuous, autonomous vulnerability scanning and threat detection, working tirelessly so your engineering team doesn't have to.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="mt-12 flex justify-center gap-6"
        >
          <Link 
            to="/dashboard" 
            className="group relative px-8 py-4 rounded-full text-lg font-bold text-white bg-white/10 hover:bg-white/15 transition-all overflow-hidden border border-white/20 hover:border-white/40 shadow-2xl hover:shadow-blue-500/20 flex items-center gap-2 backdrop-blur-md"
          >
            <span className="relative z-10">Access Dashboard</span>
            <ChevronRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/50 to-purple-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>
        </motion.div>

        {/* Floating Dashboard Preview or Graphic could go here */}
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
          className="mt-24 relative mx-auto max-w-5xl rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-2 shadow-2xl shadow-blue-900/20 overflow-hidden"
        >
           <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent z-10" />
           <div className="h-[400px] w-full rounded-xl border border-white/5 bg-[#0a0f1e] overflow-hidden flex items-center justify-center">
              {/* Abstract visualization of the dashboard/scanning */}
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                 <div className="w-64 h-64 border border-blue-500/20 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                    <div className="w-48 h-48 border border-purple-500/20 rounded-full border-t-purple-500/60" />
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <Shield className="w-16 h-16 text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                 </div>
              </div>
           </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="mt-32 grid gap-6 grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto text-left">
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
              whileHover={{ y: -5 }}
              className="p-8 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:border-white/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
