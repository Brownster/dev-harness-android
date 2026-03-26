import { PushSubscriptionResponse } from '../types';
import { api } from './api';

export interface PushNotificationStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
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

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function readPushNotificationStatus(
  authenticated: boolean,
): Promise<Omit<PushNotificationStatus, 'error' | 'loading'>> {
  if (!isPushSupported()) {
    return {
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

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!authenticated) {
    return {
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
  let matchedSubscription: PushSubscriptionResponse | null = null;
  const subscriptions = await api.listPushSubscriptions();
  matchedSubscription =
    subscriptions.find((candidate) => candidate.endpoint === subscription?.endpoint) ?? null;

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    serverEnabled: config.enabled,
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

export async function enablePushNotifications(): Promise<void> {
  ensurePushSupported();

  const config = await api.getPushConfig();
  if (!config.enabled || !config.vapid_public_key) {
    throw new Error('The backend is not configured for push notifications.');
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

export async function disablePushNotifications(): Promise<void> {
  ensurePushSupported();

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  await api.unregisterPushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}

function ensurePushSupported(): void {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device/browser.');
  }
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
