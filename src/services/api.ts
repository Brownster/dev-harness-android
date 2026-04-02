import { Capacitor } from '@capacitor/core';

import {
  ArtifactContent,
  Escalation,
  EscalationResponseInput,
  OperatorCurrentSessionResponse,
  OperatorSessionResponse,
  NativePushDeviceResponse,
  NativePushTestResponse,
  PlanningResponse,
  PushConfigResponse,
  PushSubscriptionResponse,
  RepositoryPolicy,
  RepositoryOption,
  Run,
  RunCreateInput,
  RunDeliverySummary,
  RunEvent,
  RunReportResponse,
  Slice,
} from '../types';
import { loadRuntimeConfig } from './runtimeConfig';

export class ApiError extends Error {
  status: number;

  detail: string;

  constructor(resourceName: string, status: number, detail: string) {
    super(`${resourceName} request failed (${status}): ${detail}`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export class NetworkRequestError extends Error {
  constructor(resourceName: string, message: string) {
    super(`${resourceName} request failed: ${message}`);
    this.name = 'NetworkRequestError';
  }
}

function isNativeAndroidRuntime(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function isIpLikeHostname(hostname: string): boolean {
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':')
  );
}

function buildNetworkError(resourceName: string, baseUrl: string, error: unknown): Error {
  if (!(error instanceof TypeError)) {
    return error instanceof Error ? error : new Error(`${resourceName} request failed.`);
  }

  let hostname = '';
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    hostname = '';
  }

  const nativeHostnameHint =
    isNativeAndroidRuntime() && hostname && !isIpLikeHostname(hostname)
      ? ` Native Android may not resolve the hostname "${hostname}" reliably. Try the same backend URL with a direct IP address instead.`
      : '';

  return new NetworkRequestError(
    resourceName,
    `could not reach ${baseUrl}.${nativeHostnameHint}`,
  );
}

function getConfiguredBaseUrl(): string {
  const { apiBaseUrl } = loadRuntimeConfig();
  if (!apiBaseUrl) {
    throw new Error('Missing backend URL. Open Settings and configure this device.');
  }
  return apiBaseUrl;
}

function getAuthHeaders(): Record<string, string> {
  const { sessionToken } = loadRuntimeConfig();
  if (!sessionToken) {
    throw new Error('Missing operator session. Open Settings and sign in.');
  }
  return {
    Authorization: `Bearer ${sessionToken}`,
  };
}

async function parseResponse<T>(response: Response, resourceName: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(resourceName, response.status, detail || response.statusText);
  }
  return response.json() as Promise<T>;
}

export const api = {
  async checkBackendReady(apiBaseUrl: string): Promise<void> {
    const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    try {
      const response = await fetch(`${normalizedBaseUrl}/health/ready`);
      if (!response.ok) {
        const detail = await response.text();
        throw new ApiError('Backend health', response.status, detail || response.statusText);
      }
    } catch (error) {
      throw buildNetworkError('Backend health', normalizedBaseUrl, error);
    }
  },

  async createOperatorSession(
    apiBaseUrl: string,
    username: string,
    password: string,
  ): Promise<OperatorSessionResponse> {
    const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/, '');
    try {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/operator/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      return parseResponse<OperatorSessionResponse>(response, 'Operator session');
    } catch (error) {
      throw buildNetworkError('Operator session', normalizedBaseUrl, error);
    }
  },

  async getCurrentOperatorSession(): Promise<OperatorCurrentSessionResponse> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/session`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<OperatorCurrentSessionResponse>(response, 'Current session');
  },

  async revokeCurrentOperatorSession(): Promise<void> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/session`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new ApiError('Operator sign-out', response.status, detail || response.statusText);
    }
  },

  async getPushConfig(): Promise<PushConfigResponse> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/push/config`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<PushConfigResponse>(response, 'Push config');
  },

  async registerPushSubscription(payload: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }): Promise<PushSubscriptionResponse> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/push/subscriptions`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return parseResponse<PushSubscriptionResponse>(response, 'Push subscription');
  },

  async listPushSubscriptions(): Promise<PushSubscriptionResponse[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/push/subscriptions`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<PushSubscriptionResponse[]>(response, 'Push subscriptions');
  },

  async unregisterPushSubscription(endpoint: string): Promise<void> {
    const response = await fetch(
      `${getConfiguredBaseUrl()}/api/v1/operator/push/subscriptions/remove`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new ApiError('Push unsubscribe', response.status, detail || response.statusText);
    }
  },

  async registerNativePushDevice(payload: {
    installation_id: string;
    registration_token: string;
    platform: string;
    device_label?: string;
    app_version?: string;
  }): Promise<NativePushDeviceResponse> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/push/native/devices`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return parseResponse<NativePushDeviceResponse>(response, 'Native push device');
  },

  async listNativePushDevices(): Promise<NativePushDeviceResponse[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/operator/push/native/devices`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<NativePushDeviceResponse[]>(response, 'Native push devices');
  },

  async unregisterNativePushDevice(installationId: string): Promise<void> {
    const response = await fetch(
      `${getConfiguredBaseUrl()}/api/v1/operator/push/native/devices/remove`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ installation_id: installationId }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new ApiError(
        'Native push unsubscribe',
        response.status,
        detail || response.statusText,
      );
    }
  },

  async sendNativePushTest(installationId: string): Promise<NativePushTestResponse> {
    const response = await fetch(
      `${getConfiguredBaseUrl()}/api/v1/operator/push/native/devices/test`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ installation_id: installationId }),
      },
    );
    return parseResponse<NativePushTestResponse>(response, 'Native push test');
  },

  async getRun(runId: string): Promise<Run> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<Run>(response, 'Run');
  },

  async listRuns(): Promise<Run[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<Run[]>(response, 'Runs');
  },

  async createRun(payload: RunCreateInput): Promise<Run> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return parseResponse<Run>(response, 'Create run');
  },

  async listAvailableRepositories(): Promise<RepositoryOption[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/repositories`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<RepositoryOption[]>(response, 'Available repositories');
  },

  async getRepositoryPolicy(): Promise<RepositoryPolicy> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/repositories/policy`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<RepositoryPolicy>(response, 'Repository policy');
  },

  async getRunEvents(runId: string): Promise<RunEvent[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/events`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<RunEvent[]>(response, 'Run events');
  },

  async getEscalation(escalationId: string): Promise<Escalation> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/escalations/${escalationId}`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<Escalation>(response, 'Escalation');
  },

  async getRunReport(runId: string): Promise<RunReportResponse> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/report`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<RunReportResponse>(response, 'Run report');
  },

  async planRun(runId: string): Promise<PlanningResponse> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/plan`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: false }),
    });
    return parseResponse<PlanningResponse>(response, 'Plan run');
  },

  async listSlices(runId: string): Promise<Slice[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/slices`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<Slice[]>(response, 'Run slices');
  },

  async listRunEscalations(runId: string): Promise<Escalation[]> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/escalations`, {
      headers: getAuthHeaders(),
    });
    return parseResponse<Escalation[]>(response, 'Run escalations');
  },

  async getRunArtifact(runId: string, artifactId: number): Promise<ArtifactContent> {
    const response = await fetch(
      `${getConfiguredBaseUrl()}/api/v1/runs/${runId}/artifacts/${artifactId}`,
      {
        headers: getAuthHeaders(),
      },
    );
    return parseResponse<ArtifactContent>(response, 'Run artifact');
  },

  async executeNextSlice(runId: string): Promise<{
    run_id: string;
    slice_id: string;
    run_status: string;
    slice_status: string;
  }> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/execute-next`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return parseResponse<{
      run_id: string;
      slice_id: string;
      run_status: string;
      slice_status: string;
    }>(response, 'Execute next slice');
  },

  async deliverRun(runId: string, payload?: {
    branch_name?: string;
    commit_message?: string;
    push?: boolean;
    remote_name?: string;
  }): Promise<RunDeliverySummary> {
    const response = await fetch(`${getConfiguredBaseUrl()}/api/v1/runs/${runId}/deliver`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload ?? {}),
    });
    return parseResponse<RunDeliverySummary>(response, 'Run delivery');
  },

  async respondToEscalation(
    escalationId: string,
    payload: EscalationResponseInput,
  ): Promise<void> {
    const response = await fetch(
      `${getConfiguredBaseUrl()}/api/v1/escalations/${escalationId}/respond`,
      {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Escalation response failed (${response.status}): ${detail || response.statusText}`,
      );
    }
  },
};
