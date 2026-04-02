import { HashRouter as Router } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Terminal } from 'lucide-react';

import {
  AppHeader,
  BottomNav,
  DeepLinkSimulator,
  MobilePreviewToggle,
} from './components/AppShell';
import { cn } from './lib/cn';
import type { RunCreateInput } from './types';
import { useOperatorConsole } from './hooks/useOperatorConsole';
import { useAppShell } from './hooks/useAppShell';
import { AppRoutes } from './routes/AppRoutes';

function MainLayout() {
  const {
    runtimeConfig,
    recentEscalationIds,
    pushStatus,
    repositories,
    repositoriesLoading,
    repositoriesError,
    runs,
    runsLoading,
    runsError,
    authenticated,
    handleSaveApiBaseUrl,
    handleLogin,
    handleLogout,
    handleEnablePush,
    handleDisablePush,
    handleSendTestPush,
    handleEscalationSeen,
    handleRefresh,
    handleCreateRun,
  } = useOperatorConsole();
  const {
    location,
    navigate,
    showDeepLinkSim,
    isMobilePreview,
    handleHome,
    handleOpenEscalation,
    handleOpenRun,
    handleBottomNav,
    handleTriggerDeepLink,
    toggleDeepLinkSim,
    toggleMobilePreview,
  } = useAppShell({ onEscalationSeen: handleEscalationSeen });

  const handleCreateRunAndOpen = async (payload: RunCreateInput) => {
    const created = await handleCreateRun(payload);
    navigate(`/runs/${created.run_id}`);
  };

  const dashboardRoute = {
    repositories,
    repositoriesLoading,
    repositoriesError,
    runs,
    runsLoading,
    runsError,
    onOpenRun: handleOpenRun,
    onRefresh: handleRefresh,
    onCreateRun: handleCreateRunAndOpen,
  };

  const escalationRoute = {
    recentEscalationIds,
    onEscalationSeen: handleEscalationSeen,
    onOpenEscalation: handleOpenEscalation,
  };

  const settingsRoute = {
    config: runtimeConfig,
    pushStatus,
    onSaveApiBaseUrl: handleSaveApiBaseUrl,
    onLogin: handleLogin,
    onLogout: handleLogout,
    onEnablePush: handleEnablePush,
    onDisablePush: handleDisablePush,
    onSendTestPush: handleSendTestPush,
  };

  const content = (
    <div
      className={cn(
        'min-h-screen flex flex-col bg-surface transition-all duration-500',
        isMobilePreview
          ? 'max-w-[390px] mx-auto h-[844px] my-8 rounded-[3rem] border-[8px] border-surface-container-highest shadow-2xl overflow-hidden relative'
          : 'w-full',
      )}
    >
      <AppHeader
        authenticated={authenticated}
        username={runtimeConfig.username}
        apiBaseUrl={runtimeConfig.apiBaseUrl}
        registeredDevices={pushStatus.registeredDevices}
        runCount={runs.length}
        isMobilePreview={isMobilePreview}
        showDeepLinkSim={showDeepLinkSim}
        onHome={handleHome}
        onToggleDeepLinkSim={toggleDeepLinkSim}
      />

      <DeepLinkSimulator
        open={showDeepLinkSim}
        onTrigger={handleTriggerDeepLink}
      />

      <main
        className={cn(
          'flex-1 w-full px-4 sm:px-6 py-6 sm:py-8 pb-32 overflow-y-auto custom-scrollbar',
          !isMobilePreview && 'max-w-7xl mx-auto',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <AppRoutes
              location={location}
              authenticated={authenticated}
              dashboard={dashboardRoute}
              escalation={escalationRoute}
              settings={settingsRoute}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav
        isMobilePreview={isMobilePreview}
        pathname={location.pathname}
        onNavigate={handleBottomNav}
      />

      {isMobilePreview && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-surface-container-highest rounded-b-2xl z-50" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col items-center">
      <MobilePreviewToggle
        isMobilePreview={isMobilePreview}
        onToggle={toggleMobilePreview}
      />
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
