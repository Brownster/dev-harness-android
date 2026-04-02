import { useCallback, useEffect, useState } from 'react';

import { api } from '../services/api';
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
  loadRecentEscalationIds,
  loadRuntimeConfig,
  rememberRecentEscalationId,
  saveRuntimeConfig,
  type HarnessRuntimeConfig,
  isRuntimeConfigComplete,
} from '../services/runtimeConfig';
import type { RepositoryOption, Run, RunCreateInput } from '../types';

export function useOperatorConsole() {
  const [runtimeConfig, setRuntimeConfig] = useState<HarnessRuntimeConfig>(loadRuntimeConfig());
  const [recentEscalationIds, setRecentEscalationIds] = useState<string[]>(loadRecentEscalationIds());
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>(DEFAULT_PUSH_STATUS);
  const [repositories, setRepositories] = useState<RepositoryOption[]>([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const authenticated = isRuntimeConfigComplete(runtimeConfig);

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
      setRepositoriesError(null);
      setRepositoriesLoading(false);
      return;
    }

    setRepositoriesLoading(true);
    setRepositoriesError(null);
    try {
      setRepositories(await api.listAvailableRepositories());
    } catch (repoError) {
      setRepositories([]);
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

    if (!isRuntimeConfigComplete(currentConfig)) {
      return;
    }

    try {
      const current = await api.getCurrentOperatorSession();
      setRuntimeConfig(
        saveRuntimeConfig({
          ...currentConfig,
          username: current.operator.username,
        }),
      );
    } catch {
      const nextConfig = saveRuntimeConfig({
        apiBaseUrl: currentConfig.apiBaseUrl,
        sessionToken: '',
        username: '',
      });
      setRuntimeConfig(nextConfig);
    }
  }, []);

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
    void refreshRepositories();
  }, [runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshRepositories]);

  const handleSaveApiBaseUrl = useCallback((apiBaseUrl: string) => {
    const nextConfig = saveRuntimeConfig({
      ...loadRuntimeConfig(),
      apiBaseUrl,
    });
    setRuntimeConfig(nextConfig);
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
    if (pushStatus.subscribed) {
      await disablePushNotifications();
    }
    if (currentConfig.sessionToken) {
      await api.revokeCurrentOperatorSession();
    }
    const nextConfig = saveRuntimeConfig({
      apiBaseUrl: currentConfig.apiBaseUrl,
      sessionToken: '',
      username: '',
    });
    setRuntimeConfig(nextConfig);
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

  return {
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
  };
}
