import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  LayoutDashboard, 
  Activity, 
  Settings, 
  Bell, 
  Search,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Server
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const mockData = [
  { name: 'Mon', threats: 12 },
  { name: 'Tue', threats: 19 },
  { name: 'Wed', threats: 15 },
  { name: 'Thu', threats: 25 },
  { name: 'Fri', threats: 22 },
  { name: 'Sat', threats: 10 },
  { name: 'Sun', threats: 8 },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex h-screen bg-[#030712] text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/10 bg-[#060913] flex flex-col flex-shrink-0">
        <div className="h-20 flex items-center px-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white font-display">Preflight</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4">
          <nav className="space-y-1">
            {[
              { id: 'overview', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Overview' },
              { id: 'threats', icon: <AlertTriangle className="w-5 h-5" />, label: 'Active Threats' },
              { id: 'activity', icon: <Activity className="w-5 h-5" />, label: 'Activity Logs' },
              { id: 'infrastructure', icon: <Server className="w-5 h-5" />, label: 'Infrastructure' },
              { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  activeTab === item.id 
                    ? 'bg-blue-500/10 text-blue-400' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 border-b border-white/10 bg-[#030712] flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex-1 max-w-lg">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search logs, agents..." 
                className="w-full pl-12 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-colors text-slate-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-6 ml-4">
            <button className="text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-6 h-6" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-[#030712] rounded-full" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 border-2 border-white/10 cursor-pointer" />
          </div>
        </header>

        {/* Dashboard Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Page Title */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2 font-display">Security Posture</h1>
                <p className="text-slate-400 text-base">Overview of your infrastructure's health</p>
              </div>
              <button className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-sm font-medium transition-colors text-white">
                Generate Report
              </button>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Active Threats', value: '3', trend: '+12%', isPositive: false, icon: <AlertTriangle className="w-6 h-6" />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                { label: 'Total Scans (24h)', value: '14,231', trend: '+5.4%', isPositive: true, icon: <Activity className="w-6 h-6" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Protected Assets', value: '89', trend: '0%', isPositive: true, icon: <CheckCircle2 className="w-6 h-6" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{stat.label}</span>
                    <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                      {stat.icon}
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-bold text-white font-display">{stat.value}</span>
                    <span className={`text-sm font-medium mb-1.5 ${stat.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stat.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Chart Container */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-8 rounded-2xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-xl text-white font-display">Threat Detections (Last 7 Days)</h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Trending down</span>
                </div>
              </div>
              
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={13} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={13} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }}
                      itemStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="threats" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorThreats)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        </div>
      </main>

    </div>
  );
}
