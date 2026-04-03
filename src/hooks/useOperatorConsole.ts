import { useCallback, useEffect, useState } from 'react';

import { ApiError, api, NetworkRequestError } from '../services/api';
import {
  DEFAULT_PUSH_STATUS,
  disablePushNotifications,
  enablePushNotifications,
  getNativePushInstallationId,
  readPushNotificationStatus,
  syncPushNotifications,
  type PushNotificationStatus,
} from '../services/pushNotifications';
import {
  clearAppPin,
  clearRuntimeConfig,
  isAppPinConfigured,
  loadRecentEscalationIds,
  loadRuntimeConfig,
  rememberRecentEscalationId,
  saveRuntimeConfig,
  saveAppPin,
  type HarnessRuntimeConfig,
  isRuntimeConfigComplete,
  verifyAppPin,
} from '../services/runtimeConfig';
import type {
  OperatorConnectionStatus,
  RepositoryPolicy,
  RepositoryOption,
  Run,
  RunCreateInput,
  RunDeliverySummary,
} from '../types';

const DEFAULT_CONNECTION_STATUS: OperatorConnectionStatus = {
  backend_state: 'unconfigured',
  backend_message: 'Set the backend URL for this device.',
  session_state: 'signed_out',
  session_message: 'Sign in to start and govern runs.',
  last_checked_at: null,
};

export function useOperatorConsole() {
  const [runtimeConfig, setRuntimeConfig] = useState<HarnessRuntimeConfig>(loadRuntimeConfig());
  const [recentEscalationIds, setRecentEscalationIds] = useState<string[]>(loadRecentEscalationIds());
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>(DEFAULT_PUSH_STATUS);
  const [connectionStatus, setConnectionStatus] =
    useState<OperatorConnectionStatus>(DEFAULT_CONNECTION_STATUS);
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [repositoryPolicy, setRepositoryPolicy] = useState<RepositoryPolicy | null>(null);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runDeliverySummaries, setRunDeliverySummaries] = useState<Record<string, RunDeliverySummary | null>>({});
  const [pinConfigured, setPinConfigured] = useState<boolean>(isAppPinConfigured());
  const [appLocked, setAppLocked] = useState<boolean>(isAppPinConfigured());

  const authenticated = isRuntimeConfigComplete(runtimeConfig);

  const markConnectionChecked = useCallback(
    (next: Omit<OperatorConnectionStatus, 'last_checked_at'>) => {
      setConnectionStatus({
        ...next,
        last_checked_at: new Date().toISOString(),
      });
    },
    [],
  );

  const refreshRuns = useCallback(async () => {
    if (!isRuntimeConfigComplete(loadRuntimeConfig())) {
      setRuns([]);
      setRunsError(null);
      setRunsLoading(false);
      return;
    }

    setRunsLoading(true);
    setRunsError(null);
    try {
      setRuns(await api.listRuns());
    } catch (runError) {
      setRunsError(runError instanceof Error ? runError.message : 'Failed to load runs.');
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const refreshRepositories = useCallback(async () => {
    if (!isRuntimeConfigComplete(loadRuntimeConfig())) {
      setRepositories([]);
      setRepositoryPolicy(null);
      setRepositoriesError(null);
      setRepositoriesLoading(false);
      return;
    }

    setRepositoriesLoading(true);
    setRepositoriesError(null);
    try {
      const [nextRepositories, nextRepositoryPolicy] = await Promise.all([
        api.listAvailableRepositories(),
        api.getRepositoryPolicy(),
      ]);
      setRepositories(nextRepositories);
      setRepositoryPolicy(nextRepositoryPolicy);
    } catch (repoError) {
      setRepositories([]);
      setRepositoryPolicy(null);
      setRepositoriesError(
        repoError instanceof Error ? repoError.message : 'Failed to load repositories.',
      );
    } finally {
      setRepositoriesLoading(false);
    }
  }, []);

  const syncCurrentOperator = useCallback(async () => {
    const currentConfig = loadRuntimeConfig();
    setRuntimeConfig(currentConfig);
    setRecentEscalationIds(loadRecentEscalationIds());

    if (!currentConfig.apiBaseUrl) {
      markConnectionChecked(DEFAULT_CONNECTION_STATUS);
      return;
    }

    try {
      await api.checkBackendReady(currentConfig.apiBaseUrl);
      if (!currentConfig.sessionToken) {
        markConnectionChecked({
          backend_state: 'reachable',
          backend_message: `Backend reachable at ${currentConfig.apiBaseUrl}.`,
          session_state: 'signed_out',
          session_message: 'Sign in to this backend to continue.',
        });
        return;
      }

      const current = await api.getCurrentOperatorSession();
      const nextConfig = saveRuntimeConfig({
        ...currentConfig,
        username: current.operator.username,
      });
      setRuntimeConfig(nextConfig);
      markConnectionChecked({
        backend_state: 'reachable',
        backend_message: `Backend reachable at ${currentConfig.apiBaseUrl}.`,
        session_state: 'active',
        session_message: `Signed in as ${current.operator.username}.`,
      });
    } catch (error) {
      if (error instanceof NetworkRequestError) {
        markConnectionChecked({
          backend_state: 'unreachable',
          backend_message: error.message,
          session_state: currentConfig.sessionToken ? 'unknown' : 'signed_out',
          session_message: currentConfig.sessionToken
            ? 'Saved session cannot be verified while the backend is unreachable.'
            : 'Backend is unreachable, so sign-in is unavailable.',
        });
        return;
      }

      const nextConfig = saveRuntimeConfig({
        apiBaseUrl: currentConfig.apiBaseUrl,
        sessionToken: '',
        username: '',
      });
      setRuntimeConfig(nextConfig);
      markConnectionChecked({
        backend_state: 'reachable',
        backend_message: `Backend reachable at ${currentConfig.apiBaseUrl}.`,
        session_state:
          error instanceof ApiError && error.status === 401 ? 'expired' : 'signed_out',
        session_message:
          error instanceof ApiError && error.status === 401
            ? 'Saved operator session expired. Sign in again.'
            : 'Operator session is not active on this device.',
      });
    }
  }, [markConnectionChecked]);

  useEffect(() => {
    void syncCurrentOperator();
  }, [syncCurrentOperator]);

  const refreshPushStatus = useCallback(async () => {
    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      const next = await readPushNotificationStatus(isRuntimeConfigComplete(loadRuntimeConfig()));
      setPushStatus({
        ...next,
        loading: false,
        error: null,
      });
    } catch (pushError) {
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error:
          pushError instanceof Error ? pushError.message : 'Failed to sync push notifications.',
      }));
    }
  }, []);

  useEffect(() => {
    void refreshPushStatus();
  }, [runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshPushStatus]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    void (async () => {
      try {
        await syncPushNotifications(true);
        await refreshPushStatus();
      } catch (pushError) {
        setPushStatus((current) => ({
          ...current,
          error:
            pushError instanceof Error
              ? pushError.message
              : 'Native push registration could not be synchronized.',
        }));
      }
    })();
  }, [authenticated, runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshPushStatus]);

  useEffect(() => {
    void refreshRuns();
  }, [runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshRuns]);

  useEffect(() => {
    if (!authenticated) {
      setRunDeliverySummaries((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    const completedRuns = runs.filter((run) => run.status === 'RUN_COMPLETE');
    if (completedRuns.length === 0) {
      setRunDeliverySummaries((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    const missingRunIds = completedRuns
      .map((run) => run.run_id)
      .filter((runId) => !(runId in runDeliverySummaries));

    if (missingRunIds.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const results = await Promise.all(
        missingRunIds.map(async (runId) => {
          try {
            const report = await api.getRunReport(runId);
            return { runId, delivery: report.delivery };
          } catch {
            return { runId, delivery: null };
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setRunDeliverySummaries((current) => {
        const next = { ...current };
        let changed = false;
        for (const result of results) {
          if (next[result.runId] !== result.delivery) {
            next[result.runId] = result.delivery;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, runDeliverySummaries, runs]);

  useEffect(() => {
    void refreshRepositories();
  }, [runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshRepositories]);

  const handleSaveApiBaseUrl = useCallback((apiBaseUrl: string) => {
    const nextConfig = saveRuntimeConfig({
      apiBaseUrl,
      sessionToken: '',
      username: '',
    });
    setRuntimeConfig(nextConfig);
    setRepositories([]);
    setRepositoryPolicy(null);
    setRepositoriesError(null);
    setRuns([]);
    setRunsError(null);
    setRunDeliverySummaries({});
    setPushStatus(DEFAULT_PUSH_STATUS);
    setConnectionStatus({
      ...DEFAULT_CONNECTION_STATUS,
      backend_state: nextConfig.apiBaseUrl ? 'unconfigured' : DEFAULT_CONNECTION_STATUS.backend_state,
      backend_message: nextConfig.apiBaseUrl
        ? 'Backend changed. Sign in again for this device.'
        : DEFAULT_CONNECTION_STATUS.backend_message,
      session_message: nextConfig.apiBaseUrl
        ? 'Saved operator session was cleared after backend change.'
        : DEFAULT_CONNECTION_STATUS.session_message,
    });
  }, []);

  const handleLogin = useCallback(
    async (username: string, password: string) => {
      const currentConfig = loadRuntimeConfig();
      if (!currentConfig.apiBaseUrl) {
        throw new Error('Missing backend URL. Save the backend URL first.');
      }

      const session = await api.createOperatorSession(currentConfig.apiBaseUrl, username, password);
      const nextConfig = saveRuntimeConfig({
        apiBaseUrl: currentConfig.apiBaseUrl,
        sessionToken: session.session_token,
        username: session.operator.username,
      });
      setRuntimeConfig(nextConfig);
      markConnectionChecked({
        backend_state: 'reachable',
        backend_message: `Backend reachable at ${currentConfig.apiBaseUrl}.`,
        session_state: 'active',
        session_message: `Signed in as ${session.operator.username}.`,
      });
      try {
        await syncPushNotifications(true);
        await refreshPushStatus();
      } catch (pushError) {
        setPushStatus((current) => ({
          ...current,
          error:
            pushError instanceof Error
              ? pushError.message
              : 'Native push registration could not be synchronized after sign-in.',
        }));
      }
    },
    [refreshPushStatus],
  );

  const handleLogout = useCallback(async () => {
    const currentConfig = loadRuntimeConfig();
    let pushErrorMessage: string | null = null;
    let revokeErrorMessage: string | null = null;

    if (pushStatus.subscribed) {
      try {
        await disablePushNotifications();
      } catch (error) {
        pushErrorMessage =
          error instanceof Error ? error.message : 'Push delivery could not be disabled.';
      }
    }

    if (currentConfig.sessionToken) {
      try {
        await api.revokeCurrentOperatorSession();
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          revokeErrorMessage =
            error instanceof Error ? error.message : 'Operator session could not be revoked.';
        }
      }
    }

    const nextConfig = saveRuntimeConfig({
      apiBaseUrl: currentConfig.apiBaseUrl,
      sessionToken: '',
      username: '',
    });
    setRuntimeConfig(nextConfig);
    setRepositories([]);
    setRepositoryPolicy(null);
    setRepositoriesError(null);
    setRuns([]);
    setRunsError(null);
    setRunDeliverySummaries({});
    setPushStatus({
      ...DEFAULT_PUSH_STATUS,
      error: pushErrorMessage,
    });
    markConnectionChecked({
      backend_state: currentConfig.apiBaseUrl ? 'reachable' : 'unconfigured',
      backend_message: currentConfig.apiBaseUrl
        ? `Backend reachable at ${currentConfig.apiBaseUrl}.`
        : 'Set the backend URL for this device.',
      session_state: 'signed_out',
      session_message:
        revokeErrorMessage || pushErrorMessage
          ? 'Signed out locally on this device. Some remote cleanup steps failed.'
          : 'Signed out on this device.',
    });
  }, [pushStatus.subscribed]);

  const handleEnablePush = useCallback(async () => {
    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      await enablePushNotifications();
      await refreshPushStatus();
    } catch (pushError) {
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error:
          pushError instanceof Error ? pushError.message : 'Failed to enable push delivery.',
      }));
    }
  }, [refreshPushStatus]);

  const handleDisablePush = useCallback(async () => {
    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      await disablePushNotifications();
      await refreshPushStatus();
    } catch (pushError) {
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error:
          pushError instanceof Error ? pushError.message : 'Failed to disable push delivery.',
      }));
    }
  }, [refreshPushStatus]);

  const handleSendTestPush = useCallback(async () => {
    const installationId = getNativePushInstallationId();
    if (!installationId) {
      throw new Error('Native Android push is not available on this device.');
    }

    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      await api.sendNativePushTest(installationId);
      await refreshPushStatus();
    } catch (pushError) {
      const message =
        pushError instanceof Error ? pushError.message : 'Failed to send native test push.';
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error: message,
      }));
      throw new Error(message);
    }
  }, [refreshPushStatus]);

  const handleEscalationSeen = useCallback((escalationId: string) => {
    setRecentEscalationIds(rememberRecentEscalationId(escalationId));
  }, []);

  const handleRefresh = useCallback(async () => {
    await syncCurrentOperator();
    await refreshRepositories();
    await refreshRuns();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, [refreshRepositories, refreshRuns, syncCurrentOperator]);

  const handleCreateRun = useCallback(
    async (payload: RunCreateInput) => {
      const created = await api.createRun(payload);
      await refreshRuns();
      return created;
    },
    [refreshRuns],
  );

  const handleUnlockWithPin = useCallback(async (pin: string) => {
    const valid = await verifyAppPin(pin);
    if (!valid) {
      throw new Error('Incorrect PIN.');
    }
    setAppLocked(false);
  }, []);

  const handleSetPin = useCallback(async (pin: string) => {
    await saveAppPin(pin);
    setPinConfigured(true);
    setAppLocked(false);
  }, []);

  const handleChangePin = useCallback(async (currentPin: string, nextPin: string) => {
    const valid = await verifyAppPin(currentPin);
    if (!valid) {
      throw new Error('Current PIN is incorrect.');
    }
    await saveAppPin(nextPin);
    setPinConfigured(true);
    setAppLocked(false);
  }, []);

  const handleRemovePin = useCallback(async (currentPin: string) => {
    const valid = await verifyAppPin(currentPin);
    if (!valid) {
      throw new Error('Current PIN is incorrect.');
    }
    clearAppPin();
    setPinConfigured(false);
    setAppLocked(false);
  }, []);

  const handleLockNow = useCallback(() => {
    if (!isAppPinConfigured()) {
      return;
    }
    setAppLocked(true);
  }, []);

  const handleResetLocalAccess = useCallback(() => {
    clearAppPin();
    clearRuntimeConfig();
    setPinConfigured(false);
    setAppLocked(false);
    setRuntimeConfig(loadRuntimeConfig());
    setRepositories([]);
    setRepositoryPolicy(null);
    setRuns([]);
    setRunDeliverySummaries({});
    setRecentEscalationIds(loadRecentEscalationIds());
    setPushStatus(DEFAULT_PUSH_STATUS);
    setConnectionStatus(DEFAULT_CONNECTION_STATUS);
  }, []);

  return {
    runtimeConfig,
    connectionStatus,
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
    pinConfigured,
    appLocked,
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
    handleUnlockWithPin,
    handleSetPin,
    handleChangePin,
    handleRemovePin,
    handleLockNow,
    handleResetLocalAccess,
  };
}
