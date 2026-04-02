import { AppPinCard } from '../components/AppPinCard';
import { ConnectionSettings } from '../components/ConnectionSettings';
import { OperatorAuthCard } from '../components/OperatorAuthCard';
import { PushNotificationsCard } from '../components/PushNotificationsCard';
import { type PushNotificationStatus } from '../services/pushNotifications';
import { type HarnessRuntimeConfig } from '../services/runtimeConfig';
import type { OperatorConnectionStatus } from '../types';

export interface SettingsViewProps {
  config: HarnessRuntimeConfig;
  connectionStatus: OperatorConnectionStatus;
  authenticated: boolean;
  pinConfigured: boolean;
  pushStatus: PushNotificationStatus;
  onSaveApiBaseUrl: (apiBaseUrl: string) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onSetPin: (pin: string) => Promise<void>;
  onChangePin: (currentPin: string, nextPin: string) => Promise<void>;
  onRemovePin: (currentPin: string) => Promise<void>;
  onLockNow: () => void;
  onEnablePush: () => Promise<void>;
  onDisablePush: () => Promise<void>;
  onSendTestPush: () => Promise<void>;
}

export function SettingsView({
  config,
  connectionStatus,
  authenticated,
  pinConfigured,
  pushStatus,
  onSaveApiBaseUrl,
  onLogin,
  onLogout,
  onSetPin,
  onChangePin,
  onRemovePin,
  onLockNow,
  onEnablePush,
  onDisablePush,
  onSendTestPush,
}: SettingsViewProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface mb-2">
          Settings
        </h1>
        <p className="text-on-surface-variant text-sm">
          Configure the backend URL for this device, then sign in as an operator.
        </p>
      </header>

      <ConnectionSettings
        initialApiBaseUrl={config.apiBaseUrl}
        connectionStatus={connectionStatus}
        onSave={onSaveApiBaseUrl}
      />
      <OperatorAuthCard
        authenticated={authenticated}
        username={config.username}
        connectionStatus={connectionStatus}
        onLogin={onLogin}
        onLogout={onLogout}
      />
      <AppPinCard
        pinConfigured={pinConfigured}
        onSetPin={onSetPin}
        onChangePin={onChangePin}
        onRemovePin={onRemovePin}
        onLockNow={onLockNow}
      />
      <PushNotificationsCard
        authenticated={authenticated}
        status={pushStatus}
        onEnable={onEnablePush}
        onDisable={onDisablePush}
        onSendTestPush={onSendTestPush}
      />
    </div>
  );
}
