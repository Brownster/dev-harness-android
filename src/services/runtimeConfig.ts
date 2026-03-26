export interface HarnessRuntimeConfig {
  apiBaseUrl: string;
  sessionToken: string;
  username: string;
}

const CONFIG_STORAGE_KEY = 'harness.runtime-config';
const RECENT_ESCALATIONS_KEY = 'harness.recent-escalations';
const DEFAULT_API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getDefaultRuntimeConfig(): HarnessRuntimeConfig {
  return {
    apiBaseUrl: normalizeApiBaseUrl(DEFAULT_API_BASE_URL),
    sessionToken: '',
    username: '',
  };
}

export function loadRuntimeConfig(): HarnessRuntimeConfig {
  if (!isBrowserRuntime()) {
    return getDefaultRuntimeConfig();
  }

  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) {
      return getDefaultRuntimeConfig();
    }
    const parsed = JSON.parse(raw) as Partial<HarnessRuntimeConfig>;
    return {
      apiBaseUrl: normalizeApiBaseUrl(parsed.apiBaseUrl || DEFAULT_API_BASE_URL),
      sessionToken: (parsed.sessionToken || '').trim(),
      username: (parsed.username || '').trim(),
    };
  } catch {
    return getDefaultRuntimeConfig();
  }
}

export function saveRuntimeConfig(config: HarnessRuntimeConfig): HarnessRuntimeConfig {
  const normalized: HarnessRuntimeConfig = {
    apiBaseUrl: normalizeApiBaseUrl(config.apiBaseUrl),
    sessionToken: config.sessionToken.trim(),
    username: config.username.trim(),
  };

  if (isBrowserRuntime()) {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}

export function clearRuntimeConfig(): void {
  if (!isBrowserRuntime()) {
    return;
  }
  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
}

export function isRuntimeConfigComplete(config: HarnessRuntimeConfig): boolean {
  return Boolean(config.apiBaseUrl && config.sessionToken);
}

export function loadRecentEscalationIds(): string[] {
  if (!isBrowserRuntime()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_ESCALATIONS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

export function rememberRecentEscalationId(escalationId: string): string[] {
  const normalizedId = escalationId.trim();
  if (!normalizedId) {
    return loadRecentEscalationIds();
  }

  const next = [normalizedId, ...loadRecentEscalationIds().filter((id) => id !== normalizedId)].slice(
    0,
    8,
  );

  if (isBrowserRuntime()) {
    window.localStorage.setItem(RECENT_ESCALATIONS_KEY, JSON.stringify(next));
  }

  return next;
}
