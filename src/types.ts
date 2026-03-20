/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RunStatus = 'running' | 'completed' | 'failed' | 'paused';
export type EscalationStatus = 'open' | 'resolved';
export type EscalationKind = 'plan_review' | 'execution_error' | 'configuration_needed';

export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Slice {
  id: string;
  runId: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  logs: string[];
}

export interface Escalation {
  id: string;
  runId: string;
  question: string;
  options: string[];
  kind: EscalationKind;
  status: EscalationStatus;
  createdAt: string;
}

export interface EscalationResponse {
  decision: string;
  comment: string;
  responder: string;
}
