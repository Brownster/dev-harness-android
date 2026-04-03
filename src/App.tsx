import { HashRouter as Router } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Terminal } from 'lucide-react';

import {
  AppHeader,
  BottomNav,
  DeepLinkSimulator,
  MobilePreviewToggle,
  PinUnlockScreen,
} from './components/AppShell';
import { cn } from './lib/cn';
import type { RunCreateInput } from './types';
import { useOperatorConsole } from './hooks/useOperatorConsole';
import { useAppShell } from './hooks/useAppShell';
import { AppRoutes } from './routes/AppRoutes';

function MainLayout() {
  const {
    runtimeConfig,
    connectionStatus,
    pinConfigured,
    appLocked,
    recentEscalationIds,
    pushStatus,
    repositories,
    repositoryPolicy,
    repositoriesLoading,
    repositoriesError,
    runs,
    runsLoading,
    runsError,
    runDeliverySummaries,
    authenticated,
    handleSaveApiBaseUrl,
    handleLogin,
    handleLogout,
    handleUnlockWithPin,
    handleSetPin,
    handleChangePin,
    handleRemovePin,
    handleLockNow,
    handleResetLocalAccess,
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
    repositoryPolicy,
    repositoriesLoading,
    repositoriesError,
    runs,
    runsLoading,
    runsError,
    runDeliverySummaries,
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
    connectionStatus,
    pinConfigured,
    pushStatus,
    onSaveApiBaseUrl: handleSaveApiBaseUrl,
    onLogin: handleLogin,
    onLogout: handleLogout,
    onSetPin: handleSetPin,
    onChangePin: handleChangePin,
    onRemovePin: handleRemovePin,
    onLockNow: handleLockNow,
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
        connectionStatus={connectionStatus}
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
          'flex-1 w-full px-4 sm:px-6 py-6 sm:py-8 pb-[calc(env(safe-area-inset-bottom)+9rem)] overflow-y-auto custom-scrollbar',
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

  if (pinConfigured && appLocked) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-outline-variant/15 bg-surface-container p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-surface-container-highest flex items-center justify-center">
              <Terminal className="text-primary w-5 h-5" />
            </div>
            <div>
              <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                Unlock Terminal
              </h1>
              <p className="text-sm text-on-surface-variant">
                Enter the local PIN for this device to reopen the stored operator session.
              </p>
            </div>
          </div>
          <PinUnlockScreen
            username={runtimeConfig.username}
            onUnlock={handleUnlockWithPin}
            onResetLocalAccess={handleResetLocalAccess}
          />
        </div>
      </div>
    );
  }

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
