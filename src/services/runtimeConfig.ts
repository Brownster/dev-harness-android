export interface HarnessRuntimeConfig {
  apiBaseUrl: string;
  sessionToken: string;
  username: string;
}

export interface AppPinConfig {
  pinSalt: string;
  pinHash: string;
}

const CONFIG_STORAGE_KEY = 'harness.runtime-config';
const RECENT_ESCALATIONS_KEY = 'harness.recent-escalations';
const APP_PIN_STORAGE_KEY = 'harness.app-pin';
const DEFAULT_API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return window.btoa(binary);
}

function assertPinFormat(pin: string): string {
  const normalizedPin = pin.trim();
  if (!/^\d{4,8}$/.test(normalizedPin)) {
    throw new Error('PIN must be 4 to 8 digits.');
  }
  return normalizedPin;
}

function getCrypto(): Crypto {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Secure PIN storage is not available in this browser.');
  }
  return window.crypto;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const crypto = getCrypto();
  const payload = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return bytesToBase64(new Uint8Array(digest));
}

function randomSalt(): string {
  const crypto = getCrypto();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
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

export function loadAppPinConfig(): AppPinConfig | null {
  if (!isBrowserRuntime()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(APP_PIN_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AppPinConfig>;
    if (!parsed.pinSalt || !parsed.pinHash) {
      return null;
    }
    return {
      pinSalt: parsed.pinSalt,
      pinHash: parsed.pinHash,
    };
  } catch {
    return null;
  }
}

export function isAppPinConfigured(): boolean {
  return loadAppPinConfig() !== null;
}

export async function saveAppPin(pin: string): Promise<void> {
  const normalizedPin = assertPinFormat(pin);
  const pinSalt = randomSalt();
  const pinHash = await hashPin(normalizedPin, pinSalt);
  if (isBrowserRuntime()) {
    window.localStorage.setItem(APP_PIN_STORAGE_KEY, JSON.stringify({ pinSalt, pinHash }));
  }
}

export async function verifyAppPin(pin: string): Promise<boolean> {
  const config = loadAppPinConfig();
  if (!config) {
    return false;
  }
  const normalizedPin = assertPinFormat(pin);
  const computedHash = await hashPin(normalizedPin, config.pinSalt);
  return computedHash === config.pinHash;
}

export function clearAppPin(): void {
  if (!isBrowserRuntime()) {
    return;
  }
  window.localStorage.removeItem(APP_PIN_STORAGE_KEY);
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
