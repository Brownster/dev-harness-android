/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RunStatus = 'running' | 'completed' | 'failed' | 'paused';
export type EscalationStatus = 'open' | 'resolved';
export type EscalationKind = 'plan_review' | 'execution_error' | 'configuration_needed';

export interface Run {
  run_id: string;
  repo_path: string;
  repo_name: string;
  base_branch: string;
  workspace_path: string;
  head_sha_at_start: string | null;
  status: RunStatus | string;
  baseline_status: string | null;
  concurrency_slot: number | null;
  paused_from_status?: string | null;
  paused_operation?: string | null;
  paused_agent?: string | null;
  paused_slice_id?: string | null;
  paused_attempt_number?: number | null;
  paused_session_strategy?: string | null;
  paused_session_id?: string | null;
  resume_after?: string | null;
  pause_reason?: string | null;
  spec_text: string;
  policy_pack: string;
  created_at: string;
  updated_at: string;
  artifacts?: ArtifactSummary[];
}

export interface ArtifactSummary {
  artifact_id: number | null;
  artifact_type: string;
  path: string;
  checksum: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
}

export interface ArtifactContent {
  artifact_id: number;
  run_id: string;
  artifact_type: string;
  path: string;
  checksum: string;
  metadata: Record<string, unknown>;
  created_at: string;
  content_kind: 'json' | 'text' | 'binary' | 'missing';
  content: string | null;
  truncated: boolean;
  size_bytes: number | null;
}

export interface Slice {
  slice_id: string;
  run_id: string;
  phase_id: string;
  title: string;
  purpose: string;
  planned_files: string[];
  acceptance_criteria: string[];
  tests_required: string[];
  proof_requirements: string[];
  risk_level: string;
  observability_requirements: string[];
  expected_commit_message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RunEvent {
  event_id: string;
  run_id: string;
  event_type: string;
  status: string | null;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface RunCreateInput {
  repo_path: string;
  base_branch: string;
  spec_text: string;
  spec_attachment_name?: string;
  spec_attachment_content?: string;
  policy_pack: string;
}

export interface PlanningResponse {
  run_id: string;
  status: string;
  slices: Slice[];
}

export interface Escalation {
  escalation_id: string;
  run_id: string;
  slice_id: string | null;
  question: string;
  options: string[];
  kind: EscalationKind | string;
  context: Record<string, unknown>;
  status: EscalationStatus | string;
  resolved_by_operator_id?: string | null;
  resolved_by_username?: string | null;
  response?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface EscalationResponseInput {
  decision: string;
  comment: string;
}

export interface RunReportSummary {
  total_slices: number;
  approved_slices: number;
  rejected_slices: number;
  pending_slices: number;
  total_iterations: number;
  max_slice_iterations: number;
  multi_iteration_slices: number;
  iteration_exhausted_slices: number;
  total_escalations: number;
  resolved_escalations: number;
  artifact_count: number;
}

export interface RunReportResponse {
  run_id: string;
  status: string;
  summary: RunReportSummary;
  markdown: string;
  artifact_paths: string[];
}

export interface OperatorSessionActor {
  operator_id: string;
  username: string;
}

export interface OperatorSessionResponse {
  session_token: string;
  expires_at: string;
  operator: OperatorSessionActor;
}

export interface OperatorCurrentSessionResponse {
  auth_type: string;
  operator: OperatorSessionActor;
  expires_at: string | null;
}

export interface PushConfigResponse {
  enabled: boolean;
  vapid_public_key: string | null;
}

export interface PushSubscriptionResponse {
  subscription_id: string;
  endpoint: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_notified_at: string | null;
  last_delivery_attempt_at: string | null;
  last_delivery_status: string | null;
  last_delivery_status_code: number | null;
  delivery_failures: number;
  cooldown_until: string | null;
  last_notified_escalation_id: string | null;
  last_error: string | null;
}
