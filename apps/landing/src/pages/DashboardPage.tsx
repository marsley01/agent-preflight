import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Activity, 
  Settings, 
  Bell, 
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Server,
  Code,
  Copy,
  Check,
  Folder,
  File,
  Info,
  Coins,
  LayoutGrid,
  Terminal,
  ChevronRight,
  Sparkles,
  Download,
  Sliders,
  Eye,
  Github,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// --- MOCK & DATA TYPES ---
interface ThreatItem {
  id: string;
  category: 'security' | 'auth' | 'payments' | 'api' | 'database';
  title: string;
  severity: 'critical' | 'warning' | 'info';
  file: string;
  line: number;
  description: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
}

// Default mock vulnerability reports
const DEFAULT_THREATS: ThreatItem[] = [
  {
    id: 't1',
    category: 'security',
    title: 'Supabase Service Role Key Exposed',
    severity: 'critical',
    file: 'src/lib/supabase.ts',
    line: 12,
    description: 'A Supabase service_role key was found in your client-side code. This key bypasses Row-Level Security (RLS) and must never be in the browser.',
    originalCode: `import { createClient } from '@supabase/supabase-js';\n\n// CRITICAL: Exposed service role key\nexport const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL,\n  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role_key_exposed_secret_12345'\n);`,
    fixedCode: `import { createClient } from '@supabase/supabase-js';\n\n// FIX: Use the standard anon key for client-side operations\nexport const supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL,\n  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY\n);`,
    explanation: 'Move the service role key to your secure backend env vars. Use the public anon key for client-side API calls. If you need admin access, write a secure server action or backend endpoint.'
  },
  {
    id: 't2',
    category: 'payments',
    title: 'Stripe Webhook Missing Signature Check',
    severity: 'critical',
    file: 'src/app/api/webhook/route.ts',
    line: 18,
    description: 'Your payment webhook processes requests without verifying the Stripe-Signature header. This lets attackers forge payment events and trigger unauthorized database updates.',
    originalCode: `export async function POST(req: Request) {\n  const payload = await req.json();\n  \n  // CRITICAL: Processing event without signature check\n  const event = payload;\n  if (event.type === 'checkout.session.completed') {\n    await fulfillOrder(event.data.object);\n  }\n  return Response.json({ received: true });\n}`,
    fixedCode: `import stripe from '@/lib/stripe';\n\nexport async function POST(req: Request) {\n  const body = await req.text();\n  const signature = req.headers.get('stripe-signature') || '';\n  \n  let event;\n  try {\n    // FIX: Verify signature using webhook secret\n    event = stripe.webhooks.constructEvent(\n      body,\n      signature,\n      process.env.STRIPE_WEBHOOK_SECRET!\n    );\n  } catch (err) {\n    return new Response('Webhook Signature Verification Failed', { status: 400 });\n  }\n  \n  if (event.type === 'checkout.session.completed') {\n    await fulfillOrder(event.data.object);\n  }\n  return Response.json({ received: true });\n}`,
    explanation: 'Read the raw request body as text and verify it against the webhook secret using Stripe\'s SDK constructEvent function. Return a 400 error if verification fails.'
  },
  {
    id: 't3',
    category: 'auth',
    title: 'Unprotected API Route',
    severity: 'warning',
    file: 'src/app/api/user/settings/route.ts',
    line: 5,
    description: 'API endpoint fetches user data from request params but skips authentication, letting anyone access sensitive info.',
    originalCode: `export async function GET(req: Request) {\n  const { searchParams } = new URL(req.url);\n  const userId = searchParams.get('userId');\n  \n  // WARNING: Fetching user settings without auth check\n  const settings = await db.select().from(users).where(eq(users.id, userId));\n  return Response.json(settings);\n}`,
    fixedCode: `import { auth } from '@/lib/auth';\n\nexport async function GET(req: Request) {\n  // FIX: Protect the route using authentication helpers\n  const session = await auth();\n  if (!session?.user) {\n    return new Response('Unauthorized', { status: 401 });\n  }\n  \n  const settings = await db.select().from(users).where(eq(users.id, session.user.id));\n  return Response.json(settings);\n}`,
    explanation: 'Import the auth helper middleware and restrict database queries to the authenticated user ID from the secure session cookie.'
  },
  {
    id: 't4',
    category: 'api',
    title: 'Missing Zod Input Validation',
    severity: 'warning',
    file: 'src/app/api/feedback/route.ts',
    line: 8,
    description: 'Route accepts POST payload directly without validation, opening doors for SQL injection or schema issues.',
    originalCode: `export async function POST(req: Request) {\n  const data = await req.json();\n  \n  // WARNING: Saving raw payload directly\n  await db.insert(feedback).values(data);\n  return Response.json({ success: true });\n}`,
    fixedCode: `import { z } from 'zod';\n\nconst feedbackSchema = z.object({\n  title: z.string().min(3).max(100),\n  content: z.string().min(10),\n  rating: z.number().int().min(1).max(5),\n});\n\nexport async function POST(req: Request) {\n  const rawData = await req.json();\n  \n  // FIX: Parse and validate input schema\n  const parsed = feedbackSchema.safeParse(rawData);\n  if (!parsed.success) {\n    return Response.json({ error: parsed.error.format() }, { status: 400 });\n  }\n  \n  await db.insert(feedback).values(parsed.data);\n  return Response.json({ success: true });\n}`,
    explanation: 'Create a Zod schema matching expected fields, call safeParse, and return a 400 Bad Request if validation constraints are violated.'
  }
];

// Recharts mock historical scan counts
const OVERVIEW_CHART_DATA = [
  { name: 'Jul 17', threats: 15 },
  { name: 'Jul 18', threats: 12 },
  { name: 'Jul 19', threats: 8 },
  { name: 'Jul 20', threats: 18 },
  { name: 'Jul 21', threats: 10 },
  { name: 'Jul 22', threats: 6 },
  { name: 'Jul 23', threats: 4 },
];

// Pie chart data - vulnerability breakdown by category
const PIE_CHART_DATA = [
  { name: 'Security', value: 3, color: '#ef4444' },
  { name: 'Auth', value: 2, color: '#f59e0b' },
  { name: 'Payments', value: 2, color: '#3b82f6' },
  { name: 'API', value: 4, color: '#8b5cf6' },
  { name: 'Database', value: 1, color: '#10b981' },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'scan' | 'heatmap' | 'estimator' | 'badges' | 'settings'>('overview');
  
  // Repo Scanning states
  const [repoUrl, setRepoUrl] = useState('https://github.com/marsley01/agent-preflight');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMsg, setScanStatusMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanReport, setScanReport] = useState<{
    score: number;
    threats: ThreatItem[];
    scannedFiles: number;
  } | null>({
    score: 8.2,
    threats: DEFAULT_THREATS,
    scannedFiles: 42
  });

  // Selected Threat for AI Fix Panel
  const [selectedThreat, setSelectedThreat] = useState<ThreatItem | null>(DEFAULT_THREATS[0]);

  // Estimator sliders
  const [codebaseSize, setCodebaseSize] = useState(75000); // lines of code
  const [scanFrequency, setScanFrequency] = useState(80); // scans per month
  const [estimatorModel, setEstimatorModel] = useState<'gemini-flash' | 'gemini-pro' | 'claude-sonnet' | 'gpt-4o'>('gemini-flash');

  // Badge Exporter states
  const [selectedBadgeStyle, setSelectedBadgeStyle] = useState<'neon' | 'flat' | 'dot'>('neon');
  const [copiedTab, setCopiedTab] = useState<'markdown' | 'html' | 'react' | null>(null);

  // Settings states
  const [excludePaths, setExcludePaths] = useState('node_modules, dist, build, .next, .vercel, supabase/migrations/*.sql');
  const [webhookUrl, setWebhookUrl] = useState('https://api.my-dashboard.com/webhooks/preflight');
  const [severityFilter, setSeverityFilter] = useState({ critical: true, warning: true, info: true });

  // Floating Command Palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Triggering command palette keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Autofocus command palette input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => commandInputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Command palette filter options
  const commandOptions = useMemo(() => {
    const defaultOptions = [
      { category: 'Navigate', label: 'Go to Overview Tab', action: () => { setActiveTab('overview'); setCommandPaletteOpen(false); } },
      { category: 'Navigate', label: 'Go to Code Scanner', action: () => { setActiveTab('scan'); setCommandPaletteOpen(false); } },
      { category: 'Navigate', label: 'Go to Folder Heatmap', action: () => { setActiveTab('heatmap'); setCommandPaletteOpen(false); } },
      { category: 'Navigate', label: 'Go to Cost Estimator', action: () => { setActiveTab('estimator'); setCommandPaletteOpen(false); } },
      { category: 'Navigate', label: 'Go to Badge Exporter', action: () => { setActiveTab('badges'); setCommandPaletteOpen(false); } },
      { category: 'Navigate', label: 'Go to System Settings', action: () => { setActiveTab('settings'); setCommandPaletteOpen(false); } },
      { category: 'Actions', label: 'Trigger Fresh Code Scan', action: () => { setActiveTab('scan'); handleTriggerScan(); setCommandPaletteOpen(false); } },
      { category: 'Actions', label: 'Reset Dashboard Data', action: () => { setScanReport(null); setSelectedThreat(null); setCommandPaletteOpen(false); } },
    ];

    if (!commandQuery) return defaultOptions;

    return defaultOptions.filter((opt) =>
      opt.label.toLowerCase().includes(commandQuery.toLowerCase())
    );
  }, [commandQuery]);

  // Run mock scanner action
  const handleTriggerScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);
    setScanReport(null);
    setSelectedThreat(null);

    const logMessages = [
      '🚀 Connecting to GitHub Repository API...',
      '📂 Cloning remote repository tree into secure client buffer...',
      '🔍 Scanning directory structure (detected: Next.js + Supabase + Stripe)...',
      '📄 Linting 42 active files for vulnerable symbols...',
      '⚠️ ALERT: Exposed supabase credentials located in src/lib/supabase.ts:12',
      '🚨 CRITICAL: Missing stripe signature in src/app/api/webhook/route.ts:18',
      '🔒 Testing authentication coverage on /api/user/settings/route.ts...',
      '📊 Computing global checklist scores...',
      '✅ Preflight scan completed successfully.'
    ];

    let logIdx = 0;
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        const nextProgress = prev + 12.5;
        if (nextProgress >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setScanReport({
            score: 7.2,
            threats: DEFAULT_THREATS,
            scannedFiles: 42
          });
          setSelectedThreat(DEFAULT_THREATS[0]);
          return 100;
        }
        
        // Add lines to log
        if (logIdx < logMessages.length) {
          setScanLogs((prevLogs) => [...prevLogs, logMessages[logIdx]]);
          setScanStatusMsg(logMessages[logIdx]);
          logIdx++;
        }
        return nextProgress;
      });
    }, 600);
  };

  // Cost calculator outputs
  const calculatedCostDetails = useMemo(() => {
    // Model rates per million tokens
    // Gemini Flash: $0.075 Input / $0.3 Output
    // Gemini Pro: $1.25 Input / $5.0 Output
    // Claude Sonnet: $3.0 Input / $15.0 Output
    // GPT-4o: $5.0 Input / $15.0 Output
    
    // Average tokens per line of code: ~30 tokens
    const tokensPerScan = codebaseSize * 30;
    const monthlyTokens = tokensPerScan * scanFrequency;

    let inputCostPerM = 0.075;
    let outputCostPerM = 0.3;
    let modelName = '';

    switch (estimatorModel) {
      case 'gemini-flash':
        inputCostPerM = 0.075;
        outputCostPerM = 0.3;
        modelName = 'Gemini 2.5 Flash';
        break;
      case 'gemini-pro':
        inputCostPerM = 1.25;
        outputCostPerM = 5.0;
        modelName = 'Gemini 1.5 Pro';
        break;
      case 'claude-sonnet':
        inputCostPerM = 3.0;
        outputCostPerM = 15.0;
        modelName = 'Claude 3.5 Sonnet';
        break;
      case 'gpt-4o':
        inputCostPerM = 5.0;
        outputCostPerM = 15.0;
        modelName = 'GPT-4o';
        break;
    }

    // Assume 90% input tokens, 10% output tokens
    const inputTokens = monthlyTokens * 0.9;
    const outputTokens = monthlyTokens * 0.1;
    const cost = ((inputTokens / 1000000) * inputCostPerM) + ((outputTokens / 1000000) * outputCostPerM);

    return {
      monthlyTokens: Math.round(monthlyTokens),
      monthlyCost: cost.toFixed(2),
      modelName,
      tokensPerScan: Math.round(tokensPerScan)
    };
  }, [codebaseSize, scanFrequency, estimatorModel]);

  // Badge URL generator
  const currentBadgeDetails = useMemo(() => {
    const scoreVal = scanReport ? Math.round(scanReport.score * 10) : 85;
    const color = scoreVal >= 80 ? '10b981' : scoreVal >= 60 ? 'f59e0b' : 'ef4444';
    const label = 'Preflight';

    let previewElement = null;
    let mdCode = '';
    let htmlCode = '';
    let reactCode = '';

    switch (selectedBadgeStyle) {
      case 'neon':
        previewElement = (
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0B0F19] border border-cyber-emerald/40 shadow-lg shadow-cyber-emerald/10">
            <Shield size={13} className="text-cyber-emerald" />
            <span className="text-[12px] font-semibold text-white/90">{label}</span>
            <span className="text-white/20">:</span>
            <span className="text-[12px] font-bold text-cyber-emerald">{scoreVal}% Secure</span>
          </div>
        );
        const neonUrl = `https://img.shields.io/badge/Preflight-${scoreVal}%25_Secure-${color}?style=for-the-badge&logo=github&logoColor=white&labelColor=0B0F19`;
        mdCode = `[![Preflight Score](${neonUrl})](https://github.com/marsley01/agent-preflight)`;
        htmlCode = `<a href="https://github.com/marsley01/agent-preflight">\n  <img src="${neonUrl}" alt="Preflight Score" />\n</a>`;
        reactCode = `import Image from 'next/image';\n\n<Link href="https://github.com/marsley01/agent-preflight">\n  <Image src="${neonUrl}" alt="Preflight Security Score" width={220} height={28} />\n</Link>`;
        break;
      
      case 'flat':
        previewElement = (
          <div className="inline-flex items-center bg-[#030712] rounded-md border border-white/[0.1] overflow-hidden font-mono text-[11px]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] border-r border-white/[0.06]">
              <Shield size={11} className="text-white/50" />
              <span className="font-semibold text-white/70">{label}</span>
            </div>
            <div className="px-3 py-1.5 bg-slate-900">
              <span className="font-bold text-cyber-emerald">{scoreVal}% Secure</span>
            </div>
          </div>
        );
        const flatUrl = `https://img.shields.io/badge/Preflight-${scoreVal}%25_Secure-${color}?style=flat-square&logo=shield&logoColor=white&labelColor=030712`;
        mdCode = `[![Preflight Score](${flatUrl})](https://github.com/marsley01/agent-preflight)`;
        htmlCode = `<a href="https://github.com/marsley01/agent-preflight">\n  <img src="${flatUrl}" alt="Preflight Score" />\n</a>`;
        reactCode = `<a href="https://github.com/marsley01/agent-preflight">\n  <img src="${flatUrl}" alt="Preflight Score" />\n</a>`;
        break;

      case 'dot':
        previewElement = (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 bg-cyber-emerald rounded-full animate-ping opacity-50" />
              <span className="relative w-2 h-2 bg-cyber-emerald rounded-full" />
            </span>
            <span className="text-[11px] font-medium text-white/60">{label}</span>
            <span className="text-[11px] font-semibold text-cyber-emerald">Active</span>
          </div>
        );
        const dotUrl = `https://img.shields.io/badge/Preflight-Active-${color}?style=social&logo=github&logoColor=10b981&label=`;
        mdCode = `[![Preflight Shield](${dotUrl})](https://github.com/marsley01/agent-preflight)`;
        htmlCode = `<a href="https://github.com/marsley01/agent-preflight">\n  <img src="${dotUrl}" alt="Preflight Active" />\n</a>`;
        reactCode = `<a href="https://github.com/marsley01/agent-preflight">\n  <img src="${dotUrl}" alt="Preflight Active" />\n</a>`;
        break;
    }

    return { previewElement, mdCode, htmlCode, reactCode };
  }, [selectedBadgeStyle, scanReport]);

  const copyToClipboard = (text: string, tabName: 'markdown' | 'html' | 'react') => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="flex h-screen bg-cyber-dark text-slate-200 font-sans selection:bg-cyber-blue selection:text-white overflow-hidden relative">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#060913]/90 flex flex-col flex-shrink-0 relative z-30">
        {/* Brand header */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyber-blue to-cyber-purple flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white font-display leading-none block">Preflight</span>
              <span className="text-[9px] text-cyber-blue font-bold tracking-widest uppercase mt-0.5 block">Console v0.1.0</span>
            </div>
          </Link>
        </div>

        {/* Navigation Triggers */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {[
            { id: 'overview', icon: <LayoutGrid className="w-5 h-5" />, label: 'Overview' },
            { id: 'scan', icon: <Terminal className="w-5 h-5" />, label: 'Code Scanner' },
            { id: 'heatmap', icon: <Activity className="w-5 h-5" />, label: 'Vulnerability Heatmap' },
            { id: 'estimator', icon: <Coins className="w-5 h-5" />, label: 'Cost Estimator' },
            { id: 'badges', icon: <Sliders className="w-5 h-5" />, label: 'Badge Exporter' },
            { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all text-sm font-semibold tracking-wide ${
                activeTab === item.id 
                  ? 'bg-gradient-to-r from-cyber-blue/15 to-cyber-purple/5 text-cyber-blue border-l-2 border-cyber-blue font-bold' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-l-2 border-transparent'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/5 bg-black/10 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
            <span>Agent Guard Engaged</span>
          </div>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-cyber-dark relative z-20 overflow-hidden">
        
        {/* Top Header Row */}
        <header className="h-20 border-b border-white/5 bg-cyber-dark/40 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 relative z-30 gap-4">
          
          {/* Quick Search trigger Command Palette */}
          <div className="flex-1 min-w-0 max-w-xl">
            <div 
              onClick={() => setCommandPaletteOpen(true)}
              className="relative cursor-pointer group"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
              <div className="w-full pl-11 pr-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-slate-400 flex items-center justify-between transition-all">
                <span className="truncate">Search dashboard settings, actions...</span>
                <kbd className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-mono border border-white/5 shrink-0 ml-2">Ctrl+K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notifications Indicator */}
            <button className="text-slate-400 hover:text-white transition-colors relative p-2 rounded-xl hover:bg-white/5">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-cyber-dark" />
            </button>

            {/* Profile Avatar / Git Link */}
            <a 
              href="https://github.com/marsley01/agent-preflight"
              target="_blank"
              rel="noreferrer"
              className="btn-apple btn-apple-ghost"
              style={{ padding: '6px 12px', gap: '6px' }}
            >
              <Github className="w-4.5 h-4.5" />
              <span className="text-xs font-medium">marsley01/agent-preflight</span>
            </a>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          
          <AnimatePresence mode="wait">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-7xl mx-auto space-y-8"
              >
                {/* Title Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-extrabold text-white font-display tracking-tight">Project Vibe Check</h1>
                    <p className="text-slate-400 mt-1">Real-time health check on your codebase.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('scan')}
                    className="btn-apple btn-apple-primary"
                  >
                    <Terminal className="w-4 h-4" />
                    Open Scanner Console
                  </button>
                </div>

                {/* Score & Telemetry Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Circular Score Gauge */}
                  <div className="p-6 rounded-2xl glass-panel flex flex-col items-center justify-center text-center lg:col-span-1 border-white/5">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Security Score</span>
                    
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      {/* Circular border svg */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="56" cy="56" r="48" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                        <circle 
                          cx="56" 
                          cy="56" 
                          r="48" 
                          stroke="#10b981" 
                          strokeWidth="8" 
                          fill="transparent" 
                          strokeDasharray={301.6} 
                          strokeDashoffset={301.6 - (301.6 * (scanReport?.score || 8.2)) / 10}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-white font-display">{(scanReport?.score || 8.2).toFixed(1)}</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">out of 10</span>
                      </div>
                    </div>
                    
                    <span className="text-xs font-semibold text-cyber-emerald mt-4 bg-cyber-emerald/10 px-3 py-1 rounded-full border border-cyber-emerald/20">
                      Checklist Healthy
                    </span>
                  </div>

                  {/* Standard Stat Cards */}
                  <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { 
                        label: 'Critical Fixes (Deploy Blockers)', 
                        value: scanReport ? scanReport.threats.filter(t => t.severity === 'critical').length : '0', 
                        detail: 'Must fix before shipping to production.',
                        icon: <AlertTriangle className="w-5 h-5" />, 
                        color: 'text-rose-400 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10'
                      },
                      { 
                        label: 'Warning Vibes (Review Recommended)', 
                        value: scanReport ? scanReport.threats.filter(t => t.severity === 'warning').length : '0', 
                        detail: 'Moderate risks worth addressing.',
                        icon: <Info className="w-5 h-5" />, 
                        color: 'text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10'
                      },
                      { 
                        label: 'Files Scanned', 
                        value: scanReport ? scanReport.scannedFiles : '0', 
                        detail: 'Total source files checked.',
                        icon: <CheckCircle2 className="w-5 h-5" />, 
                        color: 'text-cyber-emerald border-cyber-emerald/20 bg-cyber-emerald/5 hover:bg-cyber-emerald/10'
                      },
                    ].map((stat, i) => (
                      <div 
                        key={i}
                        className={`p-6 rounded-2xl glass-panel border transition-all duration-300 flex flex-col justify-between ${stat.color}`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                          <div className="p-2.5 rounded-xl bg-black/45 border border-white/5">
                            {stat.icon}
                          </div>
                        </div>
                        <div>
                          <div className="text-4xl font-extrabold text-white font-display mb-1.5">{stat.value}</div>
                          <p className="text-[11px] text-slate-400 leading-normal">{stat.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Graph Analytics Area - Two Charts Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Area Chart - Threat Trends */}
                  <div className="p-8 rounded-2xl glass-panel border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div>
                        <h3 className="font-extrabold text-xl text-white font-display tracking-wide">Threat Trends (7 Days)</h3>
                        <p className="text-slate-400 text-xs mt-0.5">Daily issues caught during pre-push checks.</p>
                      </div>
                      <div className="flex items-center gap-2 bg-cyber-emerald/10 border border-cyber-emerald/20 rounded-full px-3.5 py-1 text-xs text-cyber-emerald font-semibold">
                        <TrendingUp className="w-4 h-4" />
                        <span>7-Day confidence trending up</span>
                      </div>
                    </div>
                    
                    <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={OVERVIEW_CHART_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="cyberGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                          <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                          <YAxis stroke="rgba(255,255,255,0.2)" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0b0f19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}
                            labelStyle={{ color: '#64748b', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}
                            itemStyle={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}
                          />
                          <Area type="monotone" dataKey="threats" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#cyberGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Pie Chart - Vulnerability Breakdown */}
                  <div className="p-8 rounded-2xl glass-panel border-white/5">
                    <div className="mb-8">
                      <h3 className="font-extrabold text-xl text-white font-display tracking-wide">Vibe Breakdown by Category</h3>
                      <p className="text-slate-400 text-xs mt-0.5">Where the issues are coming from.</p>
                    </div>
                    
                    <div className="h-[350px] w-full flex flex-col items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={PIE_CHART_DATA}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            fill="#8884d8"
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                            stroke="transparent"
                          >
                            {PIE_CHART_DATA.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0b0f19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px' }}
                            formatter={(value, name) => [value, name]}
                            labelStyle={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}
                          />
                          <Legend
                            layout="vertical"
                            align="right"
                            verticalAlign="middle"
                            iconType="circle"
                            iconSize={10}
                            formatter={(value: string) => value}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CODE SCANNER TAB */}
            {activeTab === 'scan' && (
              <motion.div
                key="scan"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-7xl mx-auto space-y-8"
              >
{/* Header Inputs */}
                <div className="p-6 rounded-2xl glass-panel border-white/5">
                  <h2 className="text-xl font-bold text-white font-display mb-4">Run Code Scan</h2>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative min-w-0">
                      <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input 
                        type="text" 
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        disabled={isScanning}
                        placeholder="Paste a public GitHub repo URL..." 
                        className="w-full pl-12 pr-4 py-3 bg-[#050811] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-cyber-blue text-slate-200 disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={handleTriggerScan}
                      disabled={isScanning}
                      className="btn-apple btn-apple-primary shrink-0"
                      style={{ minWidth: '180px' }}
                    >
                      {isScanning ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Scanning...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4.5 h-4.5 text-white fill-white" />
                          <span>Scan Repository</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Progressive Loading Line */}
                  {isScanning && (
                    <div className="mt-6 space-y-2.5">
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-cyber-blue to-cyber-purple"
                          initial={{ width: 0 }}
                          animate={{ width: `${scanProgress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-cyber-blue animate-pulse">{scanStatusMsg}</span>
                        <span className="text-slate-400 font-bold">{Math.round(scanProgress)}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scan Console logs / Results Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Log Output & Threat List */}
                  <div className="lg:col-span-7 space-y-8">
                    
                    {/* Live Scanner Terminal Console */}
                    {isScanning && (
                      <div className="rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                        <div className="bg-[#050811] px-5 py-3 border-b border-white/5 flex items-center">
                          <Terminal className="w-4 h-4 text-cyber-blue mr-2.5" />
                          <span className="text-xs font-mono text-slate-400">Preflight Scan Logger Console</span>
                        </div>
                        <div className="p-5 bg-[#03060c] font-mono text-[12px] leading-relaxed text-slate-300 min-h-[220px] max-h-[300px] overflow-y-auto space-y-1.5">
                          {scanLogs.map((log, i) => (
                            <div key={i} className={
                              log.startsWith('⚠️') ? 'text-amber-400' :
                              log.startsWith('🚨') ? 'text-rose-400 font-bold' :
                              log.startsWith('✅') ? 'text-cyber-emerald font-bold' : 'text-slate-400'
                            }>
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Threat List Table */}
                    {scanReport && (
                      <div className="rounded-2xl border border-white/5 bg-[#060913]/90 overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-lg text-white font-display">Issues Found</h3>
                            <p className="text-xs text-slate-400">Click an issue to see the AI fix.</p>
                          </div>
                          <span className="text-xs font-semibold px-3 py-1 bg-white/5 border border-white/10 rounded-full text-slate-300">
                            Vibe Score: {scanReport.score}/10
                          </span>
                        </div>

                        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                          {scanReport.threats.map((threat) => (
                            <button
                              key={threat.id}
                              onClick={() => setSelectedThreat(threat)}
                              className={`w-full text-left p-5 flex items-start gap-4 transition-all ${
                                selectedThreat?.id === threat.id 
                                  ? 'bg-gradient-to-r from-cyber-blue/10 to-transparent' 
                                  : 'hover:bg-white/[0.02]'
                              }`}
                            >
                              <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                                threat.severity === 'critical' 
                                  ? 'bg-rose-500/10 text-rose-400' 
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <h4 className="text-sm font-bold text-white truncate">{threat.title}</h4>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    threat.severity === 'critical' 
                                      ? 'bg-rose-500/15 text-rose-400' 
                                      : 'bg-amber-500/15 text-amber-400'
                                  }`}>
                                    {threat.severity}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                  <span className="font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">{threat.file}:{threat.line}</span>
                                  <span className="text-slate-600">•</span>
                                  <span className="uppercase tracking-widest text-[9px] font-bold text-cyber-blue">{threat.category}</span>
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{threat.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: AI Code Fix Panel */}
                  <div className="lg:col-span-5">
                    <AnimatePresence mode="wait">
                      {selectedThreat ? (
                        <motion.div
                          key={selectedThreat.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="rounded-2xl border border-white/5 bg-[#060913]/90 overflow-hidden shadow-2xl flex flex-col sticky top-24"
                        >
                          <div className="p-6 border-b border-white/5 bg-gradient-to-r from-cyber-blue/10 to-cyber-purple/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-cyber-purple animate-pulse" />
                              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider font-display">AI Fix Preview</h3>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 bg-black/40 px-2.5 py-1 rounded-full border border-white/5">{selectedThreat.file}</span>
                          </div>

                          <div className="p-6 flex-1 overflow-y-auto space-y-6 max-h-[600px]">
                            {/* Explanatory notes */}
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">What's the issue?</h4>
                              <p className="text-xs text-slate-400 leading-relaxed">{selectedThreat.explanation}</p>
                            </div>

                            {/* Git Diff View */}
                            <div className="space-y-4 font-mono text-[11px]">
                              {/* Original vulnerable block */}
                              <div>
                                <div className="flex items-center justify-between bg-rose-950/20 text-rose-400 px-3.5 py-2 border border-rose-500/10 rounded-t-lg">
                                  <span>Problem Code</span>
                                  <span className="text-[9px] uppercase font-bold tracking-widest text-rose-500">Remove</span>
                                </div>
                                <pre className="p-4 bg-rose-950/5 border-x border-b border-rose-500/10 text-rose-200/90 overflow-x-auto rounded-b-lg whitespace-pre select-text">
                                  {selectedThreat.originalCode}
                                </pre>
                              </div>

                              {/* Proposed corrected block */}
                              <div>
                                <div className="flex items-center justify-between bg-emerald-950/20 text-emerald-400 px-3.5 py-2 border border-emerald-500/10 rounded-t-lg">
                                  <span>Fixed Code</span>
                                  <span className="text-[9px] uppercase font-bold tracking-widest text-emerald-500 font-display">Apply</span>
                                </div>
                                <pre className="p-4 bg-emerald-950/5 border-x border-b border-emerald-500/10 text-emerald-200/90 overflow-x-auto rounded-b-lg whitespace-pre select-text">
                                  {selectedThreat.fixedCode}
                                </pre>
                              </div>
                            </div>
                          </div>

                          {/* Quick copy controls */}
                          <div className="p-4 border-t border-white/5 bg-black/20 flex gap-3">
                            <button
                              onClick={() => copyToClipboard(selectedThreat.fixedCode, 'react' as any)}
                              className="btn-apple btn-apple-primary flex-1"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy Fix</span>
                            </button>
                            <button
                              onClick={() => {
                                const element = document.createElement("a");
                                const file = new Blob([selectedThreat.fixedCode], {type: 'text/plain'});
                                element.href = URL.createObjectURL(file);
                                element.download = selectedThreat.file.split('/').pop() || 'fix.txt';
                                document.body.appendChild(element);
                                element.click();
                                document.body.removeChild(element);
                              }}
                              className="btn-apple btn-apple-secondary"
                              title="Download patched file"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download</span>
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="h-[400px] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-8 text-slate-500">
                          <Shield className="w-12 h-12 text-slate-600 mb-4 animate-float" />
                          <h4 className="font-bold text-white mb-1">AI Debugger Ready</h4>
                          <p className="text-xs max-w-xs leading-relaxed">Select a vulnerability check from the list to preview AI patch modifications.</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* VULNERABILITY HEATMAP TAB */}
            {activeTab === 'heatmap' && (
              <motion.div
                key="heatmap"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div>
                  <h1 className="text-3xl font-extrabold text-white font-display tracking-tight">Vulnerability Heatmap</h1>
                  <p className="text-slate-400 mt-1">Interactive file tree representing threat concentration density.</p>
                </div>

                <div className="p-8 rounded-2xl glass-panel border-white/5 space-y-6">
                  {/* Heatmap Legend */}
                  <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-white/5 text-xs">
                    <span className="font-bold text-white uppercase tracking-wider">Density Code:</span>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 shadow-md shadow-rose-500/20" />
                      <span className="text-slate-300 font-medium">Critical Vulnerability (Fix Required)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shadow-md shadow-amber-500/20" />
                      <span className="text-slate-300 font-medium">Warning (Moderate Risk)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyber-emerald shadow-md shadow-cyber-emerald/20" />
                      <span className="text-slate-300 font-medium">Clean (Checks Passed)</span>
                    </div>
                  </div>

                  {/* Render Mock Interactive File Tree */}
                  <div className="font-mono text-sm space-y-4">
                    
                    {/* Root Folder */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 py-1">
                        <Folder className="w-5 h-5 text-cyber-blue shrink-0" />
                        <span className="font-bold text-white font-display">agent-preflight /</span>
                        <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-bold border border-rose-500/20">2 Critical Issues</span>
                      </div>

                      {/* Folder indent level 1 */}
                      <div className="pl-6 border-l border-white/10 space-y-3 ml-2.5">
                        
                        {/* src folder */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Folder className="w-4.5 h-4.5 text-cyber-blue/80" />
                            <span className="text-slate-200">src /</span>
                          </div>

                          {/* src level 2 */}
                          <div className="pl-6 border-l border-white/10 space-y-2 ml-2">
                            
                            {/* components folder */}
                            <div className="flex items-center justify-between py-1 hover:bg-white/[0.02] px-2 rounded">
                              <div className="flex items-center gap-2.5">
                                <Folder className="w-4 h-4 text-cyber-blue/60" />
                                <span className="text-slate-300">components /</span>
                              </div>
                              <span className="w-2.5 h-2.5 rounded-full bg-cyber-emerald shadow shadow-cyber-emerald/30" title="All Checks Passed" />
                            </div>

                            {/* lib folder */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2.5">
                                <Folder className="w-4 h-4 text-cyber-blue/60" />
                                <span className="text-slate-200">lib /</span>
                              </div>
                              {/* lib contents */}
                              <div className="pl-6 border-l border-white/10 space-y-1.5 ml-2">
                                <div className="flex items-center justify-between py-1.5 hover:bg-white/[0.02] px-2 rounded border border-transparent hover:border-rose-500/15">
                                  <div className="flex items-center gap-2">
                                    <File className="w-4 h-4 text-slate-500" />
                                    <span className="text-rose-400 font-semibold">supabase.ts</span>
                                    <span className="text-[10px] text-slate-500 font-mono">L12</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded font-mono font-bold">Hardcoded Key</span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow shadow-rose-500/40 animate-pulse" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* app / api webhooks */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2.5">
                                <Folder className="w-4 h-4 text-cyber-blue/60" />
                                <span className="text-slate-200">app / api / webhook /</span>
                              </div>
                              {/* webhook contents */}
                              <div className="pl-6 border-l border-white/10 space-y-1.5 ml-2">
                                <div className="flex items-center justify-between py-1.5 hover:bg-white/[0.02] px-2 rounded border border-transparent hover:border-rose-500/15">
                                  <div className="flex items-center gap-2">
                                    <File className="w-4 h-4 text-slate-500" />
                                    <span className="text-rose-400 font-semibold">route.ts</span>
                                    <span className="text-[10px] text-slate-500 font-mono">L18</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded font-mono font-bold">No Sig Check</span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow shadow-rose-500/40 animate-pulse" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* app / api feedback */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2.5">
                                <Folder className="w-4 h-4 text-cyber-blue/60" />
                                <span className="text-slate-200">app / api / feedback /</span>
                              </div>
                              {/* feedback contents */}
                              <div className="pl-6 border-l border-white/10 space-y-1.5 ml-2">
                                <div className="flex items-center justify-between py-1.5 hover:bg-white/[0.02] px-2 rounded border border-transparent hover:border-amber-500/15">
                                  <div className="flex items-center gap-2">
                                    <File className="w-4 h-4 text-slate-500" />
                                    <span className="text-amber-400 font-semibold">route.ts</span>
                                    <span className="text-[10px] text-slate-500 font-mono">L8</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded font-mono font-bold">Input Unvalidated</span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow shadow-amber-500/40" />
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* package.json file */}
                        <div className="flex items-center justify-between py-1.5 hover:bg-white/[0.02] px-2 rounded">
                          <div className="flex items-center gap-2.5">
                            <File className="w-4.5 h-4.5 text-slate-500" />
                            <span className="text-slate-300">package.json</span>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-cyber-emerald shadow shadow-cyber-emerald/30" />
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

            {/* COST ESTIMATOR TAB */}
            {activeTab === 'estimator' && (
              <motion.div
                key="estimator"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div>
                  <h1 className="text-3xl font-extrabold text-white font-display tracking-tight">AI Token Burn Estimator</h1>
                  <p className="text-slate-400 mt-1">Estimate token volumes and API costs for scanning your codebase.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Left Column: Sliders */}
                  <div className="md:col-span-7 p-8 rounded-2xl glass-panel border-white/5 space-y-8">
                    <h3 className="font-bold text-lg text-white font-display mb-4 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-cyber-blue" />
                      <span>Scale Configuration</span>
                    </h3>

                    {/* Codebase Size Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-slate-300">Codebase Size (Lines of Code)</span>
                        <span className="text-cyber-blue font-mono">{(codebaseSize / 1000).toFixed(0)}k lines</span>
                      </div>
                      <input 
                        type="range" 
                        min="5000" 
                        max="300000" 
                        step="5000"
                        value={codebaseSize}
                        onChange={(e) => setCodebaseSize(Number(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-blue"
                      />
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                        <span>5K lines</span>
                        <span>150K lines</span>
                        <span>300K lines</span>
                      </div>
                    </div>

                    {/* Scan Frequency Slider */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-slate-300">Scan Frequency (per month)</span>
                        <span className="text-cyber-blue font-mono">{scanFrequency} scans</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" 
                        max="500" 
                        step="5"
                        value={scanFrequency}
                        onChange={(e) => setScanFrequency(Number(e.target.value))}
                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyber-blue"
                      />
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                        <span>5 / month</span>
                        <span>250 / month</span>
                        <span>500 / month</span>
                      </div>
                    </div>

                    {/* AI Model Selector */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-slate-300">AI LLM Model Integration</label>
                      <select 
                        value={estimatorModel}
                        onChange={(e) => setEstimatorModel(e.target.value as any)}
                        className="w-full bg-[#050811] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyber-blue"
                      >
                        <option value="gemini-flash">Gemini 2.5 Flash (Recommended - Ultra Low Cost)</option>
                        <option value="gemini-pro">Gemini 1.5 Pro (Deep Intelligence)</option>
                        <option value="claude-sonnet">Claude 3.5 Sonnet (Advanced Coding)</option>
                        <option value="gpt-4o">GPT-4o (Standard Multimodal)</option>
                      </select>
                    </div>
                  </div>

                  {/* Right Column: Estimates Panel */}
                  <div className="md:col-span-5 rounded-2xl border border-white/5 bg-[#060913]/90 overflow-hidden shadow-2xl p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-white uppercase tracking-wider font-display mb-6 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-cyber-purple" />
                        <span>Monthly Cost Matrix</span>
                      </h3>
                      
                      <div className="space-y-6">
                        <div className="border-b border-white/5 pb-4">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Calculated API Model</span>
                          <span className="text-lg font-bold text-white font-display">{calculatedCostDetails.modelName}</span>
                        </div>

                        <div className="border-b border-white/5 pb-4">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Tokens burned per Scan</span>
                          <span className="text-lg font-bold text-white font-mono">{(calculatedCostDetails.tokensPerScan / 1000).toFixed(0)}K tokens</span>
                        </div>

                        <div className="border-b border-white/5 pb-4">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Monthly Cumulative Volume</span>
                          <span className="text-lg font-bold text-white font-mono">
                            {(calculatedCostDetails.monthlyTokens / 1000000).toFixed(2)}M tokens
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Estimated Monthly Cost</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-white font-display">${calculatedCostDetails.monthlyCost}</span>
                        <span className="text-xs font-bold text-slate-500">USD / mo</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                        *Estimates assume standard input cache hits. Actual cost may vary based on file similarity ratios.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* BADGES EXPORTER TAB */}
            {activeTab === 'badges' && (
              <motion.div
                key="badges"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div>
                  <h1 className="text-3xl font-extrabold text-white font-display tracking-tight">Security Badge Exporter</h1>
                  <p className="text-slate-400 mt-1">Export shields and active scanning indicators for your repository README.md.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Left Column: Style Config */}
                  <div className="md:col-span-5 p-8 rounded-2xl glass-panel border-white/5 space-y-6">
                    <h3 className="font-bold text-lg text-white font-display mb-4">Badge Visual Options</h3>

                    <div className="space-y-3">
                      {[
                        { id: 'neon', title: 'Cyber Neon', desc: 'Vibrant, bordered pill badge' },
                        { id: 'flat', title: 'Flat Shield', desc: 'Minimalist solid dual-tone block' },
                        { id: 'dot', title: 'Compact Dot', desc: 'Active ping status dot indicator' },
                      ].map((styleOpt) => (
                        <button
                          key={styleOpt.id}
                          onClick={() => setSelectedBadgeStyle(styleOpt.id as any)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            selectedBadgeStyle === styleOpt.id 
                              ? 'bg-cyber-blue/10 border-cyber-blue text-white' 
                              : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <h4 className="text-sm font-bold mb-1 text-white">{styleOpt.title}</h4>
                          <p className="text-xs text-slate-500 leading-normal">{styleOpt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Code Snippet Exporters */}
                  <div className="md:col-span-7 rounded-2xl border border-white/5 bg-[#060913]/90 overflow-hidden shadow-2xl p-8 space-y-8">
                    <div>
                      <h3 className="font-extrabold text-sm text-white uppercase tracking-wider font-display mb-4">Live Preview</h3>
                      <div className="p-6 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center min-h-[100px]">
                        {currentBadgeDetails.previewElement}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-extrabold text-sm text-white uppercase tracking-wider font-display">Export Code Snippets</h3>
                      
                      {/* Markdown Export */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                          <span>Markdown Code Block</span>
                          <button 
                            onClick={() => copyToClipboard(currentBadgeDetails.mdCode, 'markdown')}
                            className="text-cyber-blue hover:underline flex items-center gap-1.5"
                          >
                            {copiedTab === 'markdown' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedTab === 'markdown' ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-[#04060c] border border-white/5 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto select-all">
                          {currentBadgeDetails.mdCode}
                        </pre>
                      </div>

                      {/* HTML Export */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                          <span>HTML Link Code</span>
                          <button 
                            onClick={() => copyToClipboard(currentBadgeDetails.htmlCode, 'html')}
                            className="text-cyber-blue hover:underline flex items-center gap-1.5"
                          >
                            {copiedTab === 'html' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedTab === 'html' ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-[#04060c] border border-white/5 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto select-all whitespace-pre-wrap">
                          {currentBadgeDetails.htmlCode}
                        </pre>
                      </div>

                      {/* React/Next.js Export */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                          <span>React Component Implementation</span>
                          <button 
                            onClick={() => copyToClipboard(currentBadgeDetails.reactCode, 'react')}
                            className="text-cyber-blue hover:underline flex items-center gap-1.5"
                          >
                            {copiedTab === 'react' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedTab === 'react' ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-[#04060c] border border-white/5 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto select-all whitespace-pre-wrap">
                          {currentBadgeDetails.reactCode}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                <div>
                  <h1 className="text-3xl font-extrabold text-white font-display tracking-tight">Security Configurations</h1>
                  <p className="text-slate-400 mt-1">Control thresholds, exclusions, and notification channels.</p>
                </div>

                <div className="p-8 rounded-2xl glass-panel border-white/5 space-y-8">
                  {/* File Exclusions */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-white">Excluded Paths (Glob Patterns)</label>
                    <p className="text-[11px] text-slate-500 leading-normal mb-2">Paths matching these strings will skip parser checks to save API tokens.</p>
                    <textarea 
                      rows={3}
                      value={excludePaths}
                      onChange={(e) => setExcludePaths(e.target.value)}
                      className="w-full bg-[#050811] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyber-blue font-mono"
                    />
                  </div>

                  {/* Webhook notification URLs */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-white">Report Webhook Destination URL</label>
                    <p className="text-[11px] text-slate-500 leading-normal mb-2">Preflight will POST a full JSON report payload to this endpoint on check completion.</p>
                    <input 
                      type="text" 
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://api.my-domain.com/webhooks/preflight"
                      className="w-full bg-[#050811] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyber-blue font-mono"
                    />
                  </div>

                  {/* Severity weightings */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-white">Alert Threshold Triggers</label>
                    <p className="text-[11px] text-slate-500 leading-normal mb-4">Toggle levels of warning definitions included in final scanning scores.</p>
                    
                    <div className="space-y-2.5">
                      {[
                        { key: 'critical', title: 'Critical Breaches', desc: 'Includes exposed secrets, token leaks, and sandbox bypasses (deducts 1.5 points each)' },
                        { key: 'warning', title: 'Moderate Warnings', desc: 'Includes missing route protections, webhook authentication lacks (deducts 0.8 points each)' },
                        { key: 'info', title: 'Informational Notices', desc: 'Code optimization advice, version updates warnings (deducts 0.1 points each)' },
                      ].map((item) => (
                        <div key={item.key} className="flex items-start justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                          <div>
                            <h4 className="text-sm font-bold text-white">{item.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{item.desc}</p>
                          </div>
                          <input 
                            type="checkbox"
                            checked={(severityFilter as any)[item.key]}
                            onChange={(e) => setSeverityFilter({ ...severityFilter, [item.key]: e.target.checked })}
                            className="w-4 h-4 bg-white/10 rounded border-white/10 accent-cyber-blue mt-1 cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-6 border-t border-white/5 flex justify-end gap-4">
                    <button
                      onClick={() => {
                        setExcludePaths('node_modules, dist, build, .next, .vercel, supabase/migrations/*.sql');
                        setWebhookUrl('https://api.my-dashboard.com/webhooks/preflight');
                        setSeverityFilter({ critical: true, warning: true, info: true });
                      }}
                      className="btn-apple btn-apple-secondary"
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                    >
                      Restore Defaults
                    </button>
                    <button
                      onClick={() => alert('Configuration saved!')}
                      className="btn-apple btn-apple-primary"
                      style={{ padding: '8px 20px', fontSize: '12px' }}
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </main>

      {/* --- COMMAND PALETTE OVERLAY MODAL --- */}
      <AnimatePresence>
        {commandPaletteOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
            onClick={() => setCommandPaletteOpen(false)}
          >
            {/* Modal Dialog */}
            <motion.div 
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-xl bg-[#090d18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Bar */}
              <div className="relative border-b border-white/5 px-4 py-3 flex items-center">
                <Search className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
                <input 
                  ref={commandInputRef}
                  type="text" 
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  placeholder="Type a page, command, or action..."
                  className="w-full bg-transparent border-none text-white focus:outline-none text-sm font-medium py-1.5"
                />
                <button 
                  onClick={() => setCommandPaletteOpen(false)}
                  className="px-2 py-1 bg-white/5 text-[10px] text-slate-500 rounded border border-white/5 font-mono uppercase"
                >
                  ESC
                </button>
              </div>

              {/* Options List */}
              <div className="max-h-[350px] overflow-y-auto p-2.5">
                {commandOptions.length > 0 ? (
                  <div className="space-y-4">
                    {/* Group items by category */}
                    {Array.from(new Set(commandOptions.map(o => o.category))).map((cat) => (
                      <div key={cat} className="space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 py-1">
                          {cat}
                        </div>
                        {commandOptions.filter(o => o.category === cat).map((opt, i) => (
                          <button
                            key={i}
                            onClick={opt.action}
                            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 hover:text-white text-slate-300 font-semibold text-xs flex items-center justify-between transition-colors group"
                          >
                            <span>{opt.label}</span>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyber-blue transition-colors" />
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No matching commands found.
                  </div>
                )}
              </div>

              {/* Helper Footer */}
              <div className="bg-black/25 px-4 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Use keyboard up/down to navigate option list</span>
                <span>Select with ENTER</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
