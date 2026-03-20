/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  LayoutDashboard, 
  Settings, 
  MessageSquare, 
  Bell, 
  Search, 
  Plus,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Run, Escalation, EscalationResponse } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { api, mockApi } from './services/api';
import { RunDetails } from './components/RunDetails';
import { DecisionCard } from './components/DecisionCard';
import { StatusBadge } from './components/StatusBadge';
import { PullToRefresh, triggerHaptic } from './components/NativeInteractions';

// Use mock API for development
const harnessApi = mockApi;

function EscalationView() {
  const { id } = useParams<{ id: string }>();
  const [escalation, setEscalation] = useState<Escalation | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      setLoading(true);
      try {
        const esc = await harnessApi.getEscalation(id);
        setEscalation(esc);
        const r = await harnessApi.getRun(esc.runId);
        setRun(r);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load escalation');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const handleRespond = async (payload: EscalationResponse) => {
    if (!id) return;
    await harnessApi.respondToEscalation(id, payload);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Initializing Secure Session...</span>
      </div>
    );
  }

  if (error || !escalation || !run) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
          <Settings className="text-error w-6 h-6" />
        </div>
        <h3 className="font-headline text-xl font-bold text-error">Session Error</h3>
        <p className="text-on-surface-variant text-sm max-w-xs text-center">
          {error || 'The requested escalation could not be found or is no longer active.'}
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <RunDetails run={run} />
      <div className="max-w-2xl">
        <DecisionCard escalation={escalation} onRespond={handleRespond} />
      </div>
    </motion.div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API fetch delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };
  
  return (
    <div className="space-y-8 sm:space-y-10">
      <PullToRefresh onRefresh={handleRefresh} />
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight text-on-surface mb-2">Dashboard</h1>
          <p className="text-on-surface-variant font-label uppercase tracking-[0.05em] text-[10px] sm:text-xs">Environment: Production // Cluster: North-01</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
            <input 
              className="w-full sm:w-64 bg-surface-container-low border-none focus:ring-1 focus:ring-primary/30 text-on-surface font-label text-xs tracking-wider uppercase pl-10 pr-4 py-3 transition-all" 
              placeholder="SEARCH RUNS..." 
              type="text"
            />
          </div>
          <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-3 rounded-xl sm:rounded font-label text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <Plus className="w-4 h-4" />
            New Run
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-1">
        <div 
          onClick={() => navigate('/escalation/esc-456')}
          className="bg-surface-container group hover:bg-surface-container-high transition-colors p-5 sm:p-6 flex flex-col justify-between min-h-[200px] sm:min-h-[220px] relative overflow-hidden cursor-pointer rounded-xl sm:rounded-none"
        >
          <div className="absolute top-0 left-0 w-[2px] h-full bg-tertiary"></div>
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="font-label text-[10px] tracking-[0.1em] text-secondary font-bold uppercase">Active Journey</span>
              <span className="font-label text-[10px] text-on-surface-variant font-mono">ID: PX-902</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">Neural_Nexus_v2</h3>
            <p className="text-on-surface-variant text-sm line-clamp-2 leading-relaxed mb-6">Implementing decentralized vector indexing for real-time edge processing.</p>
          </div>
          <div className="flex items-center justify-between mt-auto pt-4">
            <div className="flex gap-2">
              <StatusBadge status="PAUSED" />
              <div className="px-2 py-1 bg-surface-container-highest rounded-sm flex items-center">
                <Bell className="text-[10px] text-tertiary w-3 h-3" />
              </div>
            </div>
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Updated 2m ago</span>
          </div>
        </div>

        {/* Other mock runs */}
        <div className="bg-surface-container group hover:bg-surface-container-high transition-colors p-6 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="font-label text-[10px] tracking-[0.1em] text-on-surface-variant uppercase">Archive / Stable</span>
              <span className="font-label text-[10px] text-on-surface-variant font-mono">ID: AX-112</span>
            </div>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">Core_Engine_Beta</h3>
            <p className="text-on-surface-variant text-sm line-clamp-2 leading-relaxed mb-6">Legacy kernel development for low-latency audio serialization.</p>
          </div>
          <div className="flex items-center justify-between mt-auto pt-4">
            <StatusBadge status="COMPLETED" />
            <span className="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">Updated Oct 24</span>
          </div>
        </div>

        <div className="bg-surface-container-low border border-dashed border-outline-variant/30 group hover:border-primary/50 transition-all p-6 flex flex-col items-center justify-center min-h-[220px] cursor-pointer">
          <Plus className="w-8 h-8 text-outline-variant group-hover:text-primary transition-colors mb-2" />
          <span className="font-label text-[10px] text-outline-variant font-bold uppercase tracking-widest group-hover:text-on-surface transition-colors">Provision New Cluster</span>
        </div>
      </div>

      {/* System Log Snippet */}
      <div className="mt-12 bg-surface-container-low p-4 rounded-sm border-l-2 border-secondary">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          <span className="font-label text-[10px] text-secondary font-bold uppercase tracking-widest">System Status: Nominal</span>
        </div>
        <p className="font-mono text-[10px] text-on-surface-variant leading-relaxed">
          [LOG] Fetching project metadata from node-04... SUCCESS<br/>
          [LOG] Indexing 5 projects in 12ms... READY
        </p>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => {
        triggerHaptic('light');
        navigate(to);
      }}
      className={cn(
        "flex flex-col items-center justify-center p-2 transition-all active:scale-90 flex-1",
        active ? "text-primary" : "text-on-surface-variant hover:text-primary"
      )}
    >
      <div className={cn(
        "px-4 py-1 rounded-full transition-all mb-1",
        active ? "bg-primary/10" : "bg-transparent"
      )}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-label uppercase tracking-[0.05em] text-[10px] font-medium">{label}</span>
    </button>
  );
}

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDeepLinkSim, setShowDeepLinkSim] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  const content = (
    <div className={cn(
      "min-h-screen flex flex-col bg-surface transition-all duration-500",
      isMobilePreview ? "max-w-[390px] mx-auto h-[844px] my-8 rounded-[3rem] border-[8px] border-surface-container-highest shadow-2xl overflow-hidden relative" : "w-full"
    )}>
      {/* TopAppBar */}
      <header className={cn(
        "bg-surface/80 backdrop-blur-md flex justify-between items-center px-6 py-4 w-full sticky top-0 z-40 border-b border-outline-variant/5",
        isMobilePreview && "pt-10"
      )}>
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center overflow-hidden">
            <Terminal className="text-primary w-5 h-5" />
          </div>
          <span className="font-headline tracking-tight font-bold text-xl tracking-tighter text-primary">Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowDeepLinkSim(!showDeepLinkSim)}
            className="text-on-surface-variant hover:bg-surface-container-high transition-colors p-2 rounded active:scale-95"
            title="Simulate Deep Link"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/20">
            <img 
              src="https://picsum.photos/seed/dev/100/100" 
              alt="User" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      {/* Deep Link Simulator Overlay */}
      <AnimatePresence>
        {showDeepLinkSim && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-surface-container-high p-4 rounded-xl border border-primary/20 shadow-2xl max-w-xs"
          >
            <h4 className="font-headline font-bold text-sm mb-2">Deep Link Simulator</h4>
            <p className="text-[10px] text-on-surface-variant mb-4 font-label uppercase tracking-widest">Simulate harness://escalation/esc-123</p>
            <button 
              onClick={() => {
                navigate('/escalation/esc-123');
                setShowDeepLinkSim(false);
              }}
              className="w-full bg-primary text-on-primary py-2 rounded font-label text-[10px] font-bold uppercase tracking-widest"
            >
              Trigger Notification
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn(
        "flex-1 w-full px-4 sm:px-6 py-6 sm:py-8 pb-32 overflow-y-auto custom-scrollbar",
        !isMobilePreview && "max-w-7xl mx-auto"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/escalation/:id" element={<EscalationView />} />
              <Route path="/projects" element={<div className="text-center py-20 text-on-surface-variant">Projects View (Coming Soon)</div>} />
              <Route path="/settings" element={<div className="text-center py-20 text-on-surface-variant">Settings View (Coming Soon)</div>} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* BottomNavBar */}
      <nav className={cn(
        "fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pt-2 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/10 pb-8 sm:pb-4",
        isMobilePreview && "absolute rounded-b-[2.5rem]"
      )}>
        <NavItem to="/" icon={LayoutDashboard} label="Home" active={location.pathname === '/'} />
        <NavItem to="/escalation/esc-456" icon={MessageSquare} label="Tasks" active={location.pathname.startsWith('/escalation')} />
        <NavItem to="/projects" icon={Terminal} label="Builds" active={location.pathname === '/projects'} />
        <NavItem to="/settings" icon={Settings} label="Config" active={location.pathname === '/settings'} />
      </nav>

      {/* Mobile Notch Simulation */}
      {isMobilePreview && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-surface-container-highest rounded-b-2xl z-50" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col items-center">
      {/* Preview Toggle (Desktop Only) */}
      <div className="hidden lg:flex fixed top-4 left-4 z-[60] gap-2">
        <button 
          onClick={() => setIsMobilePreview(!isMobilePreview)}
          className="bg-surface-container-highest text-on-surface px-4 py-2 rounded-full font-label text-[10px] font-bold uppercase tracking-widest border border-outline-variant/20 hover:bg-surface-bright transition-all"
        >
          {isMobilePreview ? 'Exit Mobile Preview' : 'Enter Mobile Preview'}
        </button>
      </div>
      {content}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MainLayout />
    </Router>
  );
}
