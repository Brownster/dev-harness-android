import { FormEvent, useEffect, useState } from 'react';
import { Link as LinkIcon, Save } from 'lucide-react';

import { StatusBadge } from './StatusBadge';
import type { OperatorConnectionStatus } from '../types';

interface ConnectionSettingsProps {
  initialApiBaseUrl: string;
  connectionStatus: OperatorConnectionStatus;
  onSave: (apiBaseUrl: string) => void;
}

export function ConnectionSettings({
  initialApiBaseUrl,
  connectionStatus,
  onSave,
}: ConnectionSettingsProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState(initialApiBaseUrl);

  useEffect(() => {
    setApiBaseUrl(initialApiBaseUrl);
  }, [initialApiBaseUrl]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(apiBaseUrl);
  };

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant/5">
        <h2 className="font-headline text-lg font-bold">Backend Connection</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Set the harness API base URL for this device.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-on-surface">Connection Status</p>
            <p className="text-sm text-on-surface-variant">{connectionStatus.backend_message}</p>
          </div>
          <StatusBadge
            status={
              connectionStatus.backend_state === 'reachable'
                ? 'connected'
                : connectionStatus.backend_state === 'unreachable'
                  ? 'failed'
                  : 'configuration required'
            }
          />
        </div>

        <label className="block space-y-2">
          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Backend URL
          </span>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="url"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="https://harness.example.com"
              className="w-full rounded-lg border border-outline-variant/10 bg-surface-container-low py-3 pl-10 pr-4 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
              autoComplete="url"
            />
          </div>
        </label>

        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95"
        >
          <Save className="w-4 h-4" />
          Save Backend URL
        </button>
      </form>
    </div>
  );
}
