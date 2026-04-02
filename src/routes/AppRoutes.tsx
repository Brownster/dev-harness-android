import { Suspense, lazy } from 'react';
import { Route, Routes, type Location } from 'react-router-dom';

import type { RepositoryOption, Run, RunCreateInput } from '../types';
import type { HarnessRuntimeConfig } from '../services/runtimeConfig';
import type { PushNotificationStatus } from '../services/pushNotifications';

const DashboardView = lazy(async () => import('../views/DashboardView').then((module) => ({
  default: module.DashboardView,
})));
const EscalationView = lazy(async () => import('../views/EscalationView').then((module) => ({
  default: module.EscalationView,
})));
const RunConsoleView = lazy(async () => import('../views/RunConsoleView').then((module) => ({
  default: module.RunConsoleView,
})));
const SettingsView = lazy(async () => import('../views/SettingsView').then((module) => ({
  default: module.SettingsView,
})));

function RouteFallback() {
  return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="flex items-center gap-3 rounded-3xl border border-outline-variant/20 bg-surface-container/80 px-5 py-4 text-on-surface shadow-sm">
        <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
        <span className="font-body text-sm">Loading view…</span>
      </div>
    </div>
  );
}

interface AppRoutesProps {
  location: Location;
  authenticated: boolean;
  dashboard: {
    config: HarnessRuntimeConfig;
    pushStatus: PushNotificationStatus;
    repositories: RepositoryOption[];
    repositoriesLoading: boolean;
    repositoriesError: string | null;
    runs: Run[];
    runsLoading: boolean;
    runsError: string | null;
    onOpenRun: (runId: string) => void;
    onRefresh: () => Promise<void>;
    onCreateRun: (payload: RunCreateInput) => Promise<void>;
  };
  escalation: {
    recentEscalationIds: string[];
    onEscalationSeen: (escalationId: string) => void;
    onOpenEscalation: (target: string) => void;
  };
  settings: {
    config: HarnessRuntimeConfig;
    pushStatus: PushNotificationStatus;
    onSaveApiBaseUrl: (apiBaseUrl: string) => void;
    onLogin: (username: string, password: string) => Promise<void>;
    onLogout: () => Promise<void>;
    onEnablePush: () => Promise<void>;
    onDisablePush: () => Promise<void>;
    onSendTestPush: () => Promise<void>;
  };
}

export function AppRoutes({
  location,
  authenticated,
  dashboard,
  escalation,
  settings,
}: AppRoutesProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes location={location}>
        <Route
          path="/"
          element={
            <DashboardView
              config={dashboard.config}
              authenticated={authenticated}
              pushStatus={dashboard.pushStatus}
              repositories={dashboard.repositories}
              repositoriesLoading={dashboard.repositoriesLoading}
              repositoriesError={dashboard.repositoriesError}
              runs={dashboard.runs}
              runsLoading={dashboard.runsLoading}
              runsError={dashboard.runsError}
              onOpenRun={dashboard.onOpenRun}
              onRefresh={dashboard.onRefresh}
              onCreateRun={dashboard.onCreateRun}
            />
          }
        />
        <Route
          path="/runs/:id"
          element={<RunConsoleView authenticated={authenticated} />}
        />
        <Route
          path="/escalation"
          element={
            <EscalationView
              authenticated={authenticated}
              recentEscalationIds={escalation.recentEscalationIds}
              onEscalationSeen={escalation.onEscalationSeen}
              onOpenEscalation={escalation.onOpenEscalation}
            />
          }
        />
        <Route
          path="/escalation/:id"
          element={
            <EscalationView
              authenticated={authenticated}
              recentEscalationIds={escalation.recentEscalationIds}
              onEscalationSeen={escalation.onEscalationSeen}
              onOpenEscalation={escalation.onOpenEscalation}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsView
              config={settings.config}
              authenticated={authenticated}
              pushStatus={settings.pushStatus}
              onSaveApiBaseUrl={settings.onSaveApiBaseUrl}
              onLogin={settings.onLogin}
              onLogout={settings.onLogout}
              onEnablePush={settings.onEnablePush}
              onDisablePush={settings.onDisablePush}
              onSendTestPush={settings.onSendTestPush}
            />
          }
        />
      </Routes>
    </Suspense>
  );
}
