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
    <div className="flex h-screen bg-[#030712] text-slate-200 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#060913]/80 backdrop-blur-xl flex flex-col relative z-20">
        <div className="h-20 flex items-center px-6 border-b border-white/5">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Preflight</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {[
            { id: 'overview', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Overview' },
            { id: 'threats', icon: <AlertTriangle className="w-5 h-5" />, label: 'Threats' },
            { id: 'activity', icon: <Activity className="w-5 h-5" />, label: 'Activity Logs' },
            { id: 'infrastructure', icon: <Server className="w-5 h-5" />, label: 'Infrastructure' },
            { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                activeTab === item.id 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-white/5">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-300">Agents Active</span>
            </div>
            <p className="text-xs text-slate-500 relative z-10">Monitoring 4 clusters</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Background ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 bg-[#030712]/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search logs, threats, or agents..." 
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-[#030712]" />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 border-2 border-white/10" />
          </div>
        </header>

        {/* Dashboard Area */}
        <div className="flex-1 overflow-y-auto p-8 z-10">
          <div className="max-w-6xl mx-auto space-y-8">
            
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">Security Posture</h2>
                <p className="text-slate-400 text-sm">Overview of your infrastructure's health</p>
              </div>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                Generate Report
              </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Active Threats', value: '3', trend: '+12%', color: 'text-rose-400', icon: <AlertTriangle className="w-5 h-5" /> },
                { label: 'Total Scans (24h)', value: '14,231', trend: '+5.4%', color: 'text-blue-400', icon: <Activity className="w-5 h-5" /> },
                { label: 'Protected Assets', value: '89', trend: '0%', color: 'text-emerald-400', icon: <CheckCircle2 className="w-5 h-5" /> },
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-400 text-sm font-medium">{stat.label}</span>
                    <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                      {stat.icon}
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-white">{stat.value}</span>
                    <span className={`text-xs font-medium mb-1 ${
                      stat.trend.startsWith('+') && stat.trend !== '+0%' && i === 0 ? 'text-rose-400' :
                      stat.trend.startsWith('+') && stat.trend !== '+0%' ? 'text-emerald-400' : 
                      'text-slate-500'
                    }`}>
                      {stat.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Chart Area */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/5"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-lg text-white">Threat Detections (Last 7 Days)</h3>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Trending down</span>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Area type="monotone" dataKey="threats" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorThreats)" />
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
