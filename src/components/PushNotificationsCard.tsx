import { useState } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';

import { type PushNotificationStatus } from '../services/pushNotifications';

interface PushNotificationsCardProps {
  authenticated: boolean;
  status: PushNotificationStatus;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  onSendTestPush: () => Promise<void>;
}

export function PushNotificationsCard({
  authenticated,
  status,
  onEnable,
  onDisable,
  onSendTestPush,
}: PushNotificationsCardProps) {
  const [testFeedback, setTestFeedback] = useState<string | null>(null);
  const isNativeAndroid = status.channel === 'native-android';
  const canReRegister = status.lastDeliveryStatus === 'disabled';
  const enableLabel = canReRegister ? 'Re-register Notifications' : 'Enable Notifications';
  const statusLabel =
    status.lastDeliveryStatus === 'cooldown'
      ? 'Cooling down after delivery failures'
      : status.lastDeliveryStatus === 'disabled'
        ? 'Subscription disabled by delivery policy'
        : status.lastDeliveryStatus === 'delivered'
          ? 'Last delivery succeeded'
          : status.subscribed
            ? 'Enabled on this device'
            : 'Not enabled';
  const statusText = !status.supported
    ? `This ${isNativeAndroid ? 'Android shell' : 'browser'} does not support push notifications.`
    : !authenticated
      ? 'Sign in first, then enable notifications on this device.'
      : !status.serverEnabled
        ? `The backend is not configured for ${isNativeAndroid ? 'native Android' : 'browser'} push delivery yet.`
        : status.subscribed
          ? 'Push delivery is enabled for this device.'
          : status.permission === 'denied'
            ? 'Notifications are blocked for this app.'
            : 'Push delivery is available but not enabled on this device.';
  const canSendTestPush =
    isNativeAndroid &&
    authenticated &&
    status.supported &&
    status.serverEnabled &&
    status.subscribed &&
    !status.loading;

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant/5">
        <h2 className="font-headline text-lg font-bold">Push Notifications</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Receive escalation alerts through {status.channelLabel.toLowerCase()} and jump into the
          matching review screen.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface">
          <Smartphone className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">{statusLabel}</p>
            <p className="text-on-surface-variant">{statusText}</p>
            {status.supported && (
              <p className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                Permission: {status.permission}
              </p>
            )}
            {authenticated && (
              <p className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                Registered devices: {status.registeredDevices}
              </p>
            )}
          </div>
        </div>

        {authenticated && status.subscribed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                Last Delivery
              </p>
              <p className="mt-1 font-medium text-on-surface">
                {status.lastNotifiedAt
                  ? new Date(status.lastNotifiedAt).toLocaleString()
                  : 'No successful delivery yet'}
              </p>
            </div>
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                Delivery Health
              </p>
              <p className="mt-1 font-medium text-on-surface">
                {status.lastDeliveryStatus
                  ? `${status.lastDeliveryStatus}${status.lastDeliveryStatusCode ? ` (${status.lastDeliveryStatusCode})` : ''}`
                  : 'No delivery attempt yet'}
              </p>
              {status.cooldownUntil && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Cooling down until {new Date(status.cooldownUntil).toLocaleString()}
                </p>
              )}
              {status.deliveryFailures > 0 && (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Consecutive failures: {status.deliveryFailures}
                </p>
              )}
            </div>
          </div>
        )}

        {(status.error || status.lastError) && (
          <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {status.error || status.lastError}
          </div>
        )}

        {testFeedback && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {testFeedback}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => void onEnable()}
            disabled={
              status.loading ||
              !authenticated ||
              !status.supported ||
              !status.serverEnabled ||
              (status.subscribed && !canReRegister)
            }
            className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Bell className="w-4 h-4" />
            {enableLabel}
          </button>

          <button
            type="button"
            onClick={() => void onDisable()}
            disabled={status.loading || !authenticated || !status.supported || !status.subscribed}
            className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BellOff className="w-4 h-4" />
            Disable Notifications
          </button>

          {isNativeAndroid && (
            <button
              type="button"
              onClick={() => {
                setTestFeedback(null);
                void (async () => {
                  try {
                    await onSendTestPush();
                    setTestFeedback('Test notification sent. Check this device notification tray.');
                  } catch (error) {
                    setTestFeedback(
                      error instanceof Error ? error.message : 'Failed to send test notification.',
                    );
                  }
                })();
              }}
              disabled={!canSendTestPush}
              className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Smartphone className="w-4 h-4" />
              Send Test Notification
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
