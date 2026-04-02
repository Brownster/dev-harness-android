import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

import { NativePushDeviceResponse, PushSubscriptionResponse } from '../types';
import { api } from './api';

type PushPermission = NotificationPermission | 'prompt' | 'unsupported';
type PushChannel = 'web' | 'native-android' | 'unsupported';

const NATIVE_PUSH_INSTALLATION_ID_KEY = 'harness.native-push-installation-id';

let nativeListenersInitialized = false;
let nativeNotificationActionHandler: ((route: string) => void) | null = null;

export interface PushNotificationStatus {
  channel: PushChannel;
  channelLabel: string;
  supported: boolean;
  permission: PushPermission;
  subscribed: boolean;
  serverEnabled: boolean;
  registeredDevices: number;
  currentSubscriptionId: string | null;
  lastNotifiedAt: string | null;
  lastDeliveryAttemptAt: string | null;
  lastDeliveryStatus: string | null;
  lastDeliveryStatusCode: number | null;
  deliveryFailures: number;
  cooldownUntil: string | null;
  lastError: string | null;
  error: string | null;
  loading: boolean;
}

export const DEFAULT_PUSH_STATUS: PushNotificationStatus = {
  channel: 'unsupported',
  channelLabel: 'Unsupported',
  supported: false,
  permission: 'unsupported',
  subscribed: false,
  serverEnabled: false,
  registeredDevices: 0,
  currentSubscriptionId: null,
  lastNotifiedAt: null,
  lastDeliveryAttemptAt: null,
  lastDeliveryStatus: null,
  lastDeliveryStatusCode: null,
  deliveryFailures: 0,
  cooldownUntil: null,
  lastError: null,
  error: null,
  loading: false,
};

export function isNativeAndroidPushSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function isPushSupported(): boolean {
  return isNativeAndroidPushSupported() || isWebPushSupported();
}

export function getNativePushInstallationId(): string | null {
  if (!isNativeAndroidPushSupported()) {
    return null;
  }
  return getOrCreateNativePushInstallationId();
}

export async function initializePushNotifications(
  onNotificationRoute: (route: string) => void,
): Promise<void> {
  nativeNotificationActionHandler = onNotificationRoute;
  if (!isNativeAndroidPushSupported() || nativeListenersInitialized) {
    return;
  }

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const route = resolveNativeNotificationRoute(action.notification.data);
    if (route && nativeNotificationActionHandler) {
      nativeNotificationActionHandler(route);
    }
  });

  nativeListenersInitialized = true;
}

export async function readPushNotificationStatus(
  authenticated: boolean,
): Promise<Omit<PushNotificationStatus, 'error' | 'loading'>> {
  if (isNativeAndroidPushSupported()) {
    return readNativePushNotificationStatus(authenticated);
  }
  if (isWebPushSupported()) {
    return readWebPushNotificationStatus(authenticated);
  }
  return {
    channel: 'unsupported',
    channelLabel: 'Unsupported',
    supported: false,
    permission: 'unsupported',
    subscribed: false,
    serverEnabled: false,
    registeredDevices: 0,
    currentSubscriptionId: null,
    lastNotifiedAt: null,
    lastDeliveryAttemptAt: null,
    lastDeliveryStatus: null,
    lastDeliveryStatusCode: null,
    deliveryFailures: 0,
    cooldownUntil: null,
    lastError: null,
  };
}

export async function enablePushNotifications(): Promise<void> {
  if (isNativeAndroidPushSupported()) {
    await enableNativePushNotifications();
    return;
  }
  await enableWebPushNotifications();
}

export async function syncPushNotifications(authenticated: boolean): Promise<void> {
  if (!authenticated) {
    return;
  }
  if (isNativeAndroidPushSupported()) {
    await syncNativePushNotifications();
  }
}

export async function disablePushNotifications(): Promise<void> {
  if (isNativeAndroidPushSupported()) {
    await disableNativePushNotifications();
    return;
  }
  await disableWebPushNotifications();
}

async function readNativePushNotificationStatus(
  authenticated: boolean,
): Promise<Omit<PushNotificationStatus, 'error' | 'loading'>> {
  const permissionState = await PushNotifications.checkPermissions();
  const permission = normalizeNativePermission(permissionState.receive);
  if (!authenticated) {
    return {
      channel: 'native-android',
      channelLabel: 'Android Native Push',
      supported: true,
      permission,
      subscribed: false,
      serverEnabled: false,
      registeredDevices: 0,
      currentSubscriptionId: null,
      lastNotifiedAt: null,
      lastDeliveryAttemptAt: null,
      lastDeliveryStatus: null,
      lastDeliveryStatusCode: null,
      deliveryFailures: 0,
      cooldownUntil: null,
      lastError: null,
    };
  }

  const config = await api.getPushConfig();
  const devices = await api.listNativePushDevices();
  const installationId = getOrCreateNativePushInstallationId();
  const matchedDevice =
    devices.find((candidate) => candidate.installation_id === installationId) ?? null;

  return {
    channel: 'native-android',
    channelLabel: 'Android Native Push',
    supported: true,
    permission,
    subscribed: Boolean(matchedDevice?.enabled),
    serverEnabled: config.native_android_enabled,
    registeredDevices: devices.length,
    currentSubscriptionId: matchedDevice?.device_id ?? null,
    lastNotifiedAt: matchedDevice?.last_notified_at ?? null,
    lastDeliveryAttemptAt: matchedDevice?.last_delivery_attempt_at ?? null,
    lastDeliveryStatus: matchedDevice?.last_delivery_status ?? null,
    lastDeliveryStatusCode: matchedDevice?.last_delivery_status_code ?? null,
    deliveryFailures: matchedDevice?.delivery_failures ?? 0,
    cooldownUntil: matchedDevice?.cooldown_until ?? null,
    lastError: matchedDevice?.last_error ?? null,
  };
}

async function readWebPushNotificationStatus(
  authenticated: boolean,
): Promise<Omit<PushNotificationStatus, 'error' | 'loading'>> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!authenticated) {
    return {
      channel: 'web',
      channelLabel: 'Browser Web Push',
      supported: true,
      permission: Notification.permission,
      subscribed: Boolean(subscription),
      serverEnabled: false,
      registeredDevices: 0,
      currentSubscriptionId: null,
      lastNotifiedAt: null,
      lastDeliveryAttemptAt: null,
      lastDeliveryStatus: null,
      lastDeliveryStatusCode: null,
      deliveryFailures: 0,
      cooldownUntil: null,
      lastError: null,
    };
  }

  const config = await api.getPushConfig();
  const subscriptions = await api.listPushSubscriptions();
  const matchedSubscription =
    subscriptions.find((candidate) => candidate.endpoint === subscription?.endpoint) ?? null;

  return {
    channel: 'web',
    channelLabel: 'Browser Web Push',
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    serverEnabled: config.web_enabled,
    registeredDevices: subscriptions.length,
    currentSubscriptionId: matchedSubscription?.subscription_id ?? null,
    lastNotifiedAt: matchedSubscription?.last_notified_at ?? null,
    lastDeliveryAttemptAt: matchedSubscription?.last_delivery_attempt_at ?? null,
    lastDeliveryStatus: matchedSubscription?.last_delivery_status ?? null,
    lastDeliveryStatusCode: matchedSubscription?.last_delivery_status_code ?? null,
    deliveryFailures: matchedSubscription?.delivery_failures ?? 0,
    cooldownUntil: matchedSubscription?.cooldown_until ?? null,
    lastError: matchedSubscription?.last_error ?? null,
  };
}

async function enableNativePushNotifications(): Promise<void> {
  const config = await api.getPushConfig();
  if (!config.native_android_enabled) {
    throw new Error('The backend is not configured for native Android push notifications.');
  }

  const permissions = await PushNotifications.checkPermissions();
  const nextPermission =
    permissions.receive === 'prompt'
      ? await PushNotifications.requestPermissions()
      : permissions;
  if (nextPermission.receive !== 'granted') {
    throw new Error('Notification permission was not granted on this device.');
  }

  const token = await registerNativePushToken();
  await api.registerNativePushDevice({
    installation_id: getOrCreateNativePushInstallationId(),
    registration_token: token,
    platform: 'android-fcm',
    device_label: 'Android app',
    app_version: 'android-shell',
  });
}

async function syncNativePushNotifications(): Promise<void> {
  const config = await api.getPushConfig();
  if (!config.native_android_enabled) {
    return;
  }

  const permissions = await PushNotifications.checkPermissions();
  if (permissions.receive !== 'granted') {
    return;
  }

  const installationId = getOrCreateNativePushInstallationId();
  const devices = await api.listNativePushDevices();
  const matchedDevice = devices.find((candidate) => candidate.installation_id === installationId) ?? null;
  if (matchedDevice?.enabled && !matchedDevice.last_error) {
    return;
  }

  const token = await registerNativePushToken();
  await api.registerNativePushDevice({
    installation_id: installationId,
    registration_token: token,
    platform: 'android-fcm',
    device_label: 'Android app',
    app_version: 'android-shell',
  });
}

async function disableNativePushNotifications(): Promise<void> {
  await api.unregisterNativePushDevice(getOrCreateNativePushInstallationId());
  await PushNotifications.unregister();
}

async function enableWebPushNotifications(): Promise<void> {
  ensureWebPushSupported();

  const config = await api.getPushConfig();
  if (!config.web_enabled || !config.vapid_public_key) {
    throw new Error('The backend is not configured for browser push notifications.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted on this device.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
    });
  }

  await api.registerPushSubscription(subscriptionToPayload(subscription));
}

async function disableWebPushNotifications(): Promise<void> {
  ensureWebPushSupported();

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  await api.unregisterPushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

function ensureWebPushSupported(): void {
  if (!isWebPushSupported()) {
    throw new Error('Push notifications are not supported on this device/browser.');
  }
}

function normalizeNativePermission(value: string): PushPermission {
  if (value === 'granted' || value === 'denied' || value === 'prompt') {
    return value;
  }
  return 'unsupported';
}

function getOrCreateNativePushInstallationId(): string {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'native-installation';
  }
  const existing = window.localStorage.getItem(NATIVE_PUSH_INSTALLATION_ID_KEY);
  if (existing?.trim()) {
    return existing.trim();
  }
  const created = `np-${createLocalInstallationSuffix()}`;
  window.localStorage.setItem(NATIVE_PUSH_INSTALLATION_ID_KEY, created);
  return created;
}

async function registerNativePushToken(): Promise<string> {
  await PushNotifications.removeAllListeners();
  nativeListenersInitialized = false;
  if (nativeNotificationActionHandler) {
    await initializePushNotifications(nativeNotificationActionHandler);
  }

  return new Promise<string>(async (resolve, reject) => {
    let resolved = false;
    const registrationHandle = await PushNotifications.addListener('registration', (token) => {
      if (resolved) {
        return;
      }
      resolved = true;
      void registrationHandle.remove();
      void registrationErrorHandle.remove();
      resolve(token.value);
    });
    const registrationErrorHandle = await PushNotifications.addListener(
      'registrationError',
      (error) => {
      if (resolved) {
        return;
      }
      resolved = true;
      void registrationHandle.remove();
      void registrationErrorHandle.remove();
      reject(new Error(normalizeNativeRegistrationError(error.error)));
    },
  );
  await PushNotifications.register();
  });
}

function createLocalInstallationSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNativeRegistrationError(message: string): string {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();
  if (
    lower.includes('default firebaseapp is not initialized') ||
    lower.includes('firebaseapp with name [default]') ||
    lower.includes('google_app_id') ||
    lower.includes('firebase')
  ) {
    return 'Native push is not configured in this APK. Add android/app/google-services.json, rebuild the app, and try again.';
  }
  return normalized || 'Native push registration failed.';
}

function subscriptionToPayload(subscription: PushSubscription): {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
} {
  const data = subscription.toJSON();
  if (!data.endpoint || !data.keys?.p256dh || !data.keys.auth) {
    throw new Error('Browser push subscription is missing required keys.');
  }

  return {
    endpoint: data.endpoint,
    keys: {
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
    },
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

function resolveNativeNotificationRoute(data: Record<string, unknown> | undefined): string | null {
  if (!data) {
    return null;
  }
  const explicitRoute = typeof data.route === 'string' ? data.route.trim() : '';
  if (explicitRoute) {
    return explicitRoute;
  }
  const escalationId = typeof data.escalation_id === 'string' ? data.escalation_id.trim() : '';
  if (escalationId) {
    return `/escalation/${escalationId}`;
  }
  return null;
}
