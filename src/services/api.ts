/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from 'crypto-js';
import { Run, Escalation, EscalationResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';
const SHARED_SECRET = import.meta.env.VITE_HARNESS_SHARED_SECRET || 'dev-secret';

/**
 * Signs the request body using HMAC SHA256.
 */
function generateSignature(body: string): string {
  const hash = CryptoJS.HmacSHA256(body, SHARED_SECRET);
  return `sha256=${CryptoJS.enc.Hex.stringify(hash)}`;
}

export const api = {
  async getRun(runId: string): Promise<Run> {
    const response = await fetch(`${API_BASE_URL}/api/v1/runs/${runId}`);
    if (!response.ok) throw new Error(`Failed to fetch run: ${response.statusText}`);
    return response.json();
  },

  async getEscalation(escalationId: string): Promise<Escalation> {
    const response = await fetch(`${API_BASE_URL}/api/v1/escalations/${escalationId}`);
    if (!response.ok) throw new Error(`Failed to fetch escalation: ${response.statusText}`);
    return response.json();
  },

  async respondToEscalation(escalationId: string, payload: EscalationResponse): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = generateSignature(body);

    const response = await fetch(`${API_BASE_URL}/api/v1/escalations/${escalationId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Harness-Signature': signature,
      },
      body,
    });

    if (!response.ok) throw new Error(`Failed to respond to escalation: ${response.statusText}`);
  },
};

// Mock data for development when backend is not available
export const mockApi = {
  async getRun(runId: string): Promise<Run> {
    await new Promise(r => setTimeout(r, 500));
    return {
      id: runId,
      name: "Refactor Auth Middleware",
      status: 'paused',
      description: "Implementing JWT with rotating keys for the internal API gateway.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async getEscalation(escalationId: string): Promise<Escalation> {
    await new Promise(r => setTimeout(r, 500));
    return {
      id: escalationId,
      runId: "run-123",
      question: "The JWKS endpoint is returning a 403 Forbidden. Should we retry with the fallback credentials or block the execution?",
      options: ["retry", "block", "manual_override"],
      kind: 'execution_error',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
  },

  async respondToEscalation(escalationId: string, payload: EscalationResponse): Promise<void> {
    await new Promise(r => setTimeout(r, 800));
    console.log(`[Mock API] Responded to ${escalationId}:`, payload);
  },
};
