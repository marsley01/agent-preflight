import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, Activity, ChevronRight, Lock, Play, RotateCcw, AlertTriangle, CheckCircle, HelpCircle, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock CLI Output lines for terminal simulation
const CLI_STEPS = [
  { type: 'input', text: 'agent-preflight scan .' },
  { type: 'info', text: '🚀 Preflight — Pre-Deploy Vibe Check' },
  { type: 'info', text: 'Scanning: C:\\Users\\Mash\\Desktop\\Project Apps\\my-awesome-app' },
  { type: 'progress', text: '🔍 Checking for sneaky bugs...' },
  { type: 'category', text: '\n  Security' },
  { type: 'check-pass', text: '  ✅  .env is gitignored' },
  { type: 'check-pass', text: '  ✅  No hardcoded API keys found in source' },
  { type: 'check-fail', text: '  ❌  Supabase service role key in client code (src/lib/supabase.ts:12)' },
  { type: 'category', text: '\n  Authentication' },
  { type: 'check-pass', text: '  ✅  Auth middleware found on protected routes' },
  { type: 'check-warn', text: '  ⚠️  JWT secret not in .env.example' },
  { type: 'category', text: '\n  Payments' },
  { type: 'check-fail', text: '  ❌  Webhook signature validation missing in src/app/api/webhook/route.ts' },
  { type: 'check-pass', text: '  ✅  Payment error handling present' },
  { type: 'category', text: '\n  API & Validation' },
  { type: 'check-warn', text: '  ⚠️  3 API routes missing input validation (Zod/Yup not detected)' },
  { type: 'check-pass', text: '  ✅  Rate limiting detected (Upstash Redis)' },
  { type: 'category', text: '\n  Database' },
  { type: 'check-pass', text: '  ✅  RLS policies found in migrations' },
  { type: 'check-pass', text: '  ✅  .env.example includes DATABASE_URL' },
  { type: 'result', text: '\n🚀 Vibe Score: 6/10 — Fix 2 bad vibes before shipping!' }
];

export default function MarketingPage() {
  const [terminalLines, setTerminalLines] = useState<typeof CLI_STEPS>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [typedInput, setTypedInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(true);

  // Terminal Typing & Output Simulation Loop
  useEffect(() => {
    if (!isSimulating) return;

    if (currentStep === 0) {
      const commandText = CLI_STEPS[0].text;
      if (typedInput.length < commandText.length) {
        const timeout = setTimeout(() => {
          setTypedInput(commandText.slice(0, typedInput.length + 1));
        }, 60);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setTerminalLines([{ type: 'input', text: `\$ ${commandText}` }]);
          setCurrentStep(1);
        }, 500);
        return () => clearTimeout(timeout);
      }
    }

    if (currentStep < CLI_STEPS.length) {
      const nextLine = CLI_STEPS[currentStep];
      const delay = nextLine.type === 'progress' ? 1200 : nextLine.type === 'category' ? 300 : 400;
      
      const timeout = setTimeout(() => {
        setTerminalLines((prev) => [...prev, nextLine]);
        setCurrentStep((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    } else {
      setIsSimulating(false);
    }
  }, [currentStep, typedInput, isSimulating]);

  const restartSimulation = () => {
    setTerminalLines([]);
    setCurrentStep(0);
    setTypedInput('');
    setIsSimulating(true);
  };

  return (
    <div className="min-h-screen bg-cyber-dark text-slate-100 font-sans selection:bg-cyber-blue selection:text-white relative bg-grid-pattern">
      {/* Absolute Glow Bubbles */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyber-blue/10 rounded-full blur-[150px] pointer-events-none animate-glow" />
      <div className="absolute top-[400px] right-1/4 w-[600px] h-[600px] bg-cyber-purple/10 rounded-full blur-[180px] pointer-events-none animate-glow" style={{ animationDelay: '1.5s' }} />

      {/* Navigation Header */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-cyber-dark/65 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-blue to-cyber-purple flex items-center justify-center shadow-lg shadow-cyber-blue/20">
              <Shield className="w-6 h-6 text-white animate-float" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-2xl tracking-tight text-white font-display leading-none">Preflight</span>
              <span className="text-[10px] text-cyber-blue font-semibold tracking-widest uppercase mt-0.5">CLI + Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="btn-apple btn-apple-primary"
            >
              Enter Console
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Hero & Terminal Container */}
      <main className="pt-36 pb-28 relative z-10 max-w-7xl mx-auto px-6">
        
        {/* Intro Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyber-blue/30 bg-cyber-blue/10 text-cyber-blue text-xs font-semibold uppercase tracking-wider mb-6"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>PRE-DEPLOY CODE CHECKLIST FOR VIBE CODERS</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight font-display"
          >
            Catch bugs before <br />
            <span className="text-gradient-cyber">they hit production</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            AI writes code fast. Preflight catches the bugs, leaks, and missing configs before you ship.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <Link
              to="/dashboard"
              className="btn-apple btn-apple-primary"
            >
              Start Scanning Free
              <ChevronRight className="w-5 h-5" />
            </Link>
            <a
              href="#terminal"
              className="btn-apple btn-apple-secondary"
            >
              <Terminal className="w-5 h-5" />
              View CLI Demo
            </a>
          </motion.div>
        </div>

        {/* Interactive Terminal Showcase */}
        <motion.div
          id="terminal"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="max-w-4xl mx-auto rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl relative"
        >
          {/* Terminal Titlebar */}
          <div className="bg-[#050811] px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs text-slate-500 font-mono ml-3">bash - agent-preflight scan</span>
            </div>
            
            <div className="flex items-center gap-2">
              {isSimulating ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-[10px] text-blue-400 font-bold uppercase font-mono tracking-wider">Scanning</span>
                </div>
              ) : (
                <button
                  onClick={restartSimulation}
                  className="btn-apple btn-apple-ghost"
                  style={{ padding: '4px 10px', fontSize: '10px', gap: '4px' }}
                >
                  <RotateCcw className="w-3 h-3" />
                  Re-run
                </button>
              )}
            </div>
          </div>

          {/* Terminal Screen */}
          <div className="p-6 bg-[#04060d] font-mono text-sm leading-relaxed min-h-[420px] overflow-y-auto max-h-[500px]">
            {/* Command Line Input */}
            {currentStep === 0 && (
              <div className="flex items-center gap-2 text-white">
                <span className="text-emerald-400 font-bold">$</span>
                <span>{typedInput}</span>
                <span className="w-2.5 h-4 bg-white animate-pulse" />
              </div>
            )}

            {/* Generated Outputs */}
            <div className="space-y-1.5">
              {terminalLines.map((line, idx) => {
                if (line.type === 'input') {
                  return (
                    <div key={idx} className="text-white font-semibold">
                      <span className="text-emerald-400 font-bold mr-2">$</span>
                      {line.text.replace('$ ', '')}
                    </div>
                  );
                }
                if (line.type === 'info') {
                  return <div key={idx} className="text-slate-400">{line.text}</div>;
                }
                if (line.type === 'progress') {
                  return (
                    <div key={idx} className="text-blue-400 flex items-center gap-2 py-1">
                      {line.text}
                    </div>
                  );
                }
                if (line.type === 'category') {
                  return <div key={idx} className="text-white font-bold tracking-wide mt-2 underline decoration-white/20">{line.text}</div>;
                }
                if (line.type === 'check-pass') {
                  return <div key={idx} className="text-emerald-400 pl-4">{line.text}</div>;
                }
                if (line.type === 'check-warn') {
                  return <div key={idx} className="text-amber-400 pl-4">{line.text}</div>;
                }
                if (line.type === 'check-fail') {
                  return <div key={idx} className="text-rose-400 pl-4 font-medium">{line.text}</div>;
                }
                if (line.type === 'result') {
                  return (
                    <div key={idx} className="mt-4 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 font-bold">
                      {line.text.trim()}
                    </div>
                  );
                }
                return null;
              })}
            </div>
            
            {/* Auto-scroll anchor */}
            {isSimulating && currentStep > 0 && (
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-2 pl-4 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>running analysis...</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="mt-40 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold font-display text-white">Full-Spectrum Static Analysis</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">Catch costly mistakes before they mess up your database, leak secrets, or lose payments.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-6 h-6 text-cyber-blue" />,
                title: "Instant Execution",
                desc: "Scan your entire codebase in under 200ms, no complex setup or waiting."
              },
              {
                icon: <Shield className="w-6 h-6 text-cyber-purple" />,
                title: "Strict Rule Engine",
                desc: "Detects hardcoded tokens, unprotected routes, Supabase role leaks, and missing webhook checks."
              },
              {
                icon: <Activity className="w-6 h-6 text-cyber-pink" />,
                title: "Developer First",
                desc: "Works with git hooks and CI pipelines. Block unsafe PR branches with a simple pass/fail code."
              }
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="p-8 rounded-2xl glass-panel glass-panel-hover"
              >
                <div className="w-12 h-12 rounded-xl bg-[#090e1b] border border-white/10 flex items-center justify-center mb-6">
                  {feat.icon}
                </div>
                <h3 className="text-xl font-bold text-white font-display mb-3">{feat.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{feat.desc}</p>
              </motion.div>
))}
          </div>
        </div>

        {/* How It Works with GitHub Actions */}
        <div className="mt-48 border border-white/5 rounded-3xl p-8 md:p-12 bg-gradient-to-br from-cyber-card to-cyber-dark relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <span className="text-cyber-purple font-semibold text-xs uppercase tracking-widest">Automation First</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white font-display mt-2">Run Preflight in CI/CD</h2>
              <p className="text-slate-400 mt-4 leading-relaxed">
                Drop Preflight into GitHub Actions in seconds. Every PR gets scanned, security rules checked, and a report posted as a comment.
              </p>
              
              <ul className="mt-8 space-y-3.5">
                {[
                  "Block merges on critical issues (leaked keys, etc.)",
                  "Enforce JWT secrets in staging",
                  "Verify payment routes validate signatures",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                    <CheckCircle className="w-5 h-5 text-cyber-emerald shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-[#04060c] p-6 rounded-xl border border-white/10 font-mono text-xs text-slate-300 overflow-x-auto shadow-2xl">
              <div className="flex items-center gap-1.5 mb-4 text-slate-500 border-b border-white/5 pb-3">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>.github/workflows/preflight.yml</span>
              </div>
              <pre className="text-sky-300">
{`name: Preflight Scan
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: preflight-agent/cli@main
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          strict: true`}
              </pre>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#03060f] py-12 text-center text-xs text-slate-500 relative z-10">
        <p>© 2026 Anomaly Co. Preflight is open source software licensed under MIT.</p>
      </footer>
    </div>
  );
}
