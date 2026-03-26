import {
  ArtifactContent,
  Escalation,
  EscalationResponseInput,
  OperatorCurrentSessionResponse,
  OperatorSessionResponse,
  PlanningResponse,
  PushConfigResponse,
  PushSubscriptionResponse,
  Run,
  RunCreateInput,
  RunEvent,
  RunReportResponse,
  Slice,
} from '../types';
import { loadRuntimeConfig } from './runtimeConfig';

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
    throw new Error(
      `${resourceName} request failed (${response.status}): ${detail || response.statusText}`,
    );
  }
  return response.json() as Promise<T>;
}

export const api = {
  async createOperatorSession(
    apiBaseUrl: string,
    username: string,
    password: string,
  ): Promise<OperatorSessionResponse> {
    const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/v1/operator/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    return parseResponse<OperatorSessionResponse>(response, 'Operator session');
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
      throw new Error(
        `Operator sign-out failed (${response.status}): ${detail || response.statusText}`,
      );
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
      throw new Error(
        `Push unsubscribe failed (${response.status}): ${detail || response.statusText}`,
      );
    }
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
