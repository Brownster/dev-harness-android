import { ConnectionSettings } from '../components/ConnectionSettings';
import { OperatorAuthCard } from '../components/OperatorAuthCard';
import { PushNotificationsCard } from '../components/PushNotificationsCard';
import { type PushNotificationStatus } from '../services/pushNotifications';
import { type HarnessRuntimeConfig } from '../services/runtimeConfig';

export interface SettingsViewProps {
  config: HarnessRuntimeConfig;
  authenticated: boolean;
  pushStatus: PushNotificationStatus;
  onSaveApiBaseUrl: (apiBaseUrl: string) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onEnablePush: () => Promise<void>;
  onDisablePush: () => Promise<void>;
  onSendTestPush: () => Promise<void>;
}

export function SettingsView({
  config,
  authenticated,
  pushStatus,
  onSaveApiBaseUrl,
  onLogin,
  onLogout,
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

      <ConnectionSettings initialApiBaseUrl={config.apiBaseUrl} onSave={onSaveApiBaseUrl} />
      <OperatorAuthCard
        authenticated={authenticated}
        username={config.username}
        onLogin={onLogin}
        onLogout={onLogout}
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
