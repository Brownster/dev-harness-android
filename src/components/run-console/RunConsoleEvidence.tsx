import { FileText, LoaderCircle, Terminal } from 'lucide-react';

import { cn } from '../../lib/cn';
import { formatPausedOperation } from '../../lib/runFormatters';
import { StatusBadge } from '../StatusBadge';
import type { ArtifactContent, ArtifactSummary, RunEvent, Slice } from '../../types';

function formatEventTypeLabel(eventType: string) {
  return eventType.replace(/_/g, ' ');
}

function eventName(event: RunEvent) {
  return event.envelope?.event ?? event.event_type;
}

function eventContext(event: RunEvent) {
  return event.envelope?.context ?? event.details;
}

function eventSliceId(event: RunEvent) {
  return event.envelope?.slice_id ?? readStringDetail(event.details, 'slice_id');
}

function eventAgent(event: RunEvent) {
  return event.envelope?.agent ?? null;
}

function readStringDetail(details: Record<string, unknown>, key: string): string | null {
  const value = details[key];
  return typeof value === 'string' ? value : null;
}

function readNumberDetail(details: Record<string, unknown>, key: string): number | null {
  const value = details[key];
  return typeof value === 'number' ? value : null;
}

function readStringArrayDetail(details: Record<string, unknown>, key: string): string[] {
  const value = details[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export interface IterationDetails {
  sliceId: string | null;
  iterationNumber: number | null;
  maxIterations: number | null;
  generatorOperation: string | null;
  generatorAgent: string | null;
  verificationReasons: string[];
  rubricFloorFailures: string[];
  eventType: string;
}

function parseIterationDetails(event: RunEvent): IterationDetails | null {
  const currentEventType = eventName(event);
  if (!currentEventType.startsWith('slice_iteration_')) {
    return null;
  }
  const details = eventContext(event);
  return {
    sliceId: eventSliceId(event),
    iterationNumber: readNumberDetail(details, 'iteration_number'),
    maxIterations: readNumberDetail(details, 'max_iterations'),
    generatorOperation: readStringDetail(details, 'generator_operation'),
    generatorAgent: readStringDetail(details, 'generator_agent'),
    verificationReasons: readStringArrayDetail(details, 'verification_reasons'),
    rubricFloorFailures: readStringArrayDetail(details, 'rubric_floor_failures'),
    eventType: currentEventType,
  };
}

export function latestIterationForSlice(
  events: RunEvent[],
  sliceId: string | null,
): IterationDetails | null {
  if (!sliceId) {
    return null;
  }
  const matching = [...events]
    .reverse()
    .map((event) => parseIterationDetails(event))
    .filter((details): details is IterationDetails => details !== null);
  return matching.find((details) => details.sliceId === sliceId) ?? null;
}

function eventCardClasses(eventType: string) {
  switch (eventType) {
    case 'run_paused':
    case 'slice_execution_escalated':
    case 'slice_iteration_failed':
    case 'slice_iteration_exhausted':
      return 'border-tertiary/20 bg-tertiary/10';
    case 'run_resumed':
    case 'slice_execution_completed':
    case 'planning_completed':
    case 'slice_iteration_evaluated':
      return 'border-secondary/20 bg-secondary/10';
    case 'slice_execution_started':
    case 'planning_started':
    case 'slice_iteration_started':
      return 'border-primary/20 bg-primary/10';
    default:
      return 'border-outline-variant/10 bg-surface-container-low';
  }
}

function eventBadges(event: RunEvent) {
  const details = eventContext(event);
  const badges: string[] = [];

  if (event.status) {
    badges.push(event.status);
  }

  const sliceId = eventSliceId(event);
  if (sliceId) {
    badges.push(`slice ${sliceId}`);
  }

  const pausedAgent = eventAgent(event) ?? readStringDetail(details, 'paused_agent');
  if (pausedAgent) {
    badges.push(pausedAgent);
  }

  const pausedOperation = readStringDetail(details, 'paused_operation');
  if (pausedOperation) {
    badges.push(formatPausedOperation(pausedOperation));
  }

  const iterationNumber = readNumberDetail(details, 'iteration_number');
  const maxIterations = readNumberDetail(details, 'max_iterations');
  if (typeof iterationNumber === 'number') {
    badges.push(maxIterations ? `iter ${iterationNumber}/${maxIterations}` : `iter ${iterationNumber}`);
  }

  const generatorAgent = readStringDetail(details, 'generator_agent');
  if (generatorAgent) {
    badges.push(generatorAgent);
  }

  const generatorOperation = readStringDetail(details, 'generator_operation');
  if (generatorOperation) {
    badges.push(formatPausedOperation(generatorOperation));
  }

  const resumeOperation = readStringDetail(details, 'resume_operation');
  if (resumeOperation) {
    badges.push(`resume ${formatPausedOperation(resumeOperation)}`);
  }

  const sessionStrategy = readStringDetail(details, 'paused_session_strategy');
  if (sessionStrategy) {
    badges.push(`session ${sessionStrategy}`);
  }

  return badges;
}

function eventSummaryLines(event: RunEvent) {
  const details = eventContext(event);
  const lines: string[] = [];

  const resumeAfter = readStringDetail(details, 'resume_after');
  if (resumeAfter) {
    lines.push(`Resume after ${new Date(resumeAfter).toLocaleString()}`);
  }

  const resumeTargetStatus = readStringDetail(details, 'resume_target_status');
  if (resumeTargetStatus) {
    lines.push(`Returned to ${resumeTargetStatus}`);
  }

  const pausedAttempt = readNumberDetail(details, 'paused_attempt_number');
  if (typeof pausedAttempt === 'number') {
    lines.push(`Paused on attempt ${pausedAttempt + 1}`);
  }

  const resumeAttempt = readNumberDetail(details, 'resume_attempt_number');
  if (typeof resumeAttempt === 'number') {
    lines.push(`Resumed on attempt ${resumeAttempt + 1}`);
  }

  const phaseCount = readNumberDetail(details, 'phase_count');
  if (typeof phaseCount === 'number') {
    lines.push(`${phaseCount} phase${phaseCount === 1 ? '' : 's'} in the initial plan`);
  }

  const amendmentCount = readNumberDetail(details, 'recommended_amendments');
  if (typeof amendmentCount === 'number') {
    lines.push(`${amendmentCount} recommended amendment${amendmentCount === 1 ? '' : 's'} from review`);
  }

  const sliceCount = readNumberDetail(details, 'slice_count');
  if (typeof sliceCount === 'number') {
    lines.push(`${sliceCount} slice${sliceCount === 1 ? '' : 's'} ready`);
  }

  const repairAttemptsUsed = readNumberDetail(details, 'repair_attempts_used');
  if (typeof repairAttemptsUsed === 'number') {
    lines.push(`${repairAttemptsUsed} repair attempt${repairAttemptsUsed === 1 ? '' : 's'} used`);
  }

  const iterationCount = readNumberDetail(details, 'iteration_count');
  if (typeof iterationCount === 'number') {
    lines.push(`${iterationCount} iteration${iterationCount === 1 ? '' : 's'} recorded`);
  }

  const changedFiles = readStringArrayDetail(details, 'changed_files');
  if (changedFiles.length > 0) {
    lines.push(`${changedFiles.length} changed file${changedFiles.length === 1 ? '' : 's'}`);
  }

  const verificationReasons = readStringArrayDetail(details, 'verification_reasons');
  if (verificationReasons.length > 0) {
    lines.push(`Verification blockers: ${verificationReasons.slice(0, 2).join(' · ')}`);
  }

  const rubricFloorFailures = readStringArrayDetail(details, 'rubric_floor_failures');
  if (rubricFloorFailures.length > 0) {
    lines.push(`Rubric blockers: ${rubricFloorFailures.slice(0, 2).join(' · ')}`);
  }

  const title = readStringDetail(details, 'title');
  if (title && eventName(event) === 'slice_execution_started') {
    lines.push(title);
  }

  return lines;
}

export function RunEventTimeline({ events }: { events: RunEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
        No run events recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const badges = eventBadges(event);
        const summaryLines = eventSummaryLines(event);

        return (
          <div
            key={event.event_id}
            className={cn('rounded-xl border px-4 py-4', eventCardClasses(eventName(event)))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={formatEventTypeLabel(eventName(event))} />
                  {badges.map((badge) => (
                    <span key={`${event.event_id}:${badge}`}>
                      <StatusBadge status={badge} />
                    </span>
                  ))}
                </div>
                <p className="font-medium text-on-surface">{event.summary}</p>
                {summaryLines.length > 0 && (
                  <div className="space-y-1">
                    {summaryLines.map((line) => (
                      <p key={`${event.event_id}:${line}`} className="text-sm text-on-surface-variant">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                {new Date(event.envelope?.timestamp ?? event.created_at).toLocaleString()}
              </span>
            </div>
            {Object.keys(eventContext(event)).length > 0 && (
              <details className="mt-3 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Raw Event Details
                </summary>
                <pre className="mt-3 overflow-x-auto text-xs text-on-surface-variant">
                  {JSON.stringify(eventContext(event), null, 2)}
                </pre>
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

function parseArtifactJsonValue(artifact: ArtifactContent): unknown | null {
  if (artifact.content_kind !== 'json' || !artifact.content) {
    return null;
  }

  try {
    return JSON.parse(artifact.content) as unknown;
  } catch {
    return null;
  }
}

function parseArtifactJson(artifact: ArtifactContent): Record<string, unknown> | null {
  const parsed = parseArtifactJsonValue(artifact);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function parseArtifactJsonArray(artifact: ArtifactContent): unknown[] | null {
  const parsed = parseArtifactJsonValue(artifact);
  if (!Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

export interface ResumeIntentDetails {
  agent: string | null;
  operation: string | null;
  workspacePath: string | null;
  sessionStrategy: string | null;
  sessionId: string | null;
  sliceId: string | null;
  attemptNumber: number | null;
  plannedFiles: string[];
  schemaRootType: string | null;
  schemaFieldNames: string[];
  contractNote: string | null;
}

export interface SliceIterationView {
  iterationNumber: number;
  generatorOperation: string | null;
  generatorAgent: string | null;
  implementationSummary: string | null;
  approved: boolean | null;
  evaluationSummary: string | null;
  verificationReasons: string[];
  rubricFloorFailures: string[];
  patchError: string | null;
  testsRun: string[];
  changedFiles: string[];
  observedProofTypes: string[];
}

function readSchemaFieldNames(schema: unknown): string[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return [];
  }

  const schemaRecord = schema as Record<string, unknown>;
  const properties = schemaRecord.properties;
  if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
    return Object.keys(properties as Record<string, unknown>);
  }

  if (schemaRecord.type === 'array') {
    const items = schemaRecord.items;
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      return readSchemaFieldNames(items);
    }
  }

  return [];
}

export function parseResumeIntentArtifact(artifact: ArtifactContent): ResumeIntentDetails | null {
  const parsed = parseArtifactJson(artifact);
  if (!parsed) {
    return null;
  }

  const plannedFiles =
    Array.isArray(parsed.planned_files) && parsed.planned_files.every((value) => typeof value === 'string')
      ? (parsed.planned_files as string[])
      : [];
  const schema =
    parsed.expected_output_schema &&
    typeof parsed.expected_output_schema === 'object' &&
    !Array.isArray(parsed.expected_output_schema)
      ? (parsed.expected_output_schema as Record<string, unknown>)
      : null;

  return {
    agent: typeof parsed.agent === 'string' ? parsed.agent : null,
    operation: typeof parsed.operation === 'string' ? parsed.operation : null,
    workspacePath: typeof parsed.workspace_path === 'string' ? parsed.workspace_path : null,
    sessionStrategy: typeof parsed.session_strategy === 'string' ? parsed.session_strategy : null,
    sessionId: typeof parsed.session_id === 'string' ? parsed.session_id : null,
    sliceId: typeof parsed.slice_id === 'string' ? parsed.slice_id : null,
    attemptNumber: typeof parsed.attempt_number === 'number' ? parsed.attempt_number : null,
    plannedFiles,
    schemaRootType: typeof schema?.type === 'string' ? schema.type : null,
    schemaFieldNames: readSchemaFieldNames(schema).slice(0, 8),
    contractNote: typeof parsed.resume_contract_note === 'string' ? parsed.resume_contract_note : null,
  };
}

export function parseSliceIterationsArtifact(artifact: ArtifactContent): SliceIterationView[] | null {
  const parsed = parseArtifactJsonArray(artifact);
  if (!parsed) {
    return null;
  }

  const iterations = parsed
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }
      const record = item as Record<string, unknown>;
      const iterationNumber = typeof record.iteration_number === 'number' ? record.iteration_number : null;
      if (iterationNumber === null) {
        return null;
      }
      return {
        iterationNumber,
        generatorOperation: typeof record.generator_operation === 'string' ? record.generator_operation : null,
        generatorAgent: typeof record.generator_agent === 'string' ? record.generator_agent : null,
        implementationSummary: typeof record.implementation_summary === 'string' ? record.implementation_summary : null,
        approved: typeof record.approved === 'boolean' ? record.approved : null,
        evaluationSummary: typeof record.evaluation_summary === 'string' ? record.evaluation_summary : null,
        verificationReasons: Array.isArray(record.verification_reasons)
          ? record.verification_reasons.filter((value): value is string => typeof value === 'string')
          : [],
        rubricFloorFailures: Array.isArray(record.rubric_floor_failures)
          ? record.rubric_floor_failures.filter((value): value is string => typeof value === 'string')
          : [],
        patchError: typeof record.patch_error === 'string' ? record.patch_error : null,
        testsRun: Array.isArray(record.tests_run)
          ? record.tests_run.filter((value): value is string => typeof value === 'string')
          : [],
        changedFiles: Array.isArray(record.changed_files)
          ? record.changed_files.filter((value): value is string => typeof value === 'string')
          : [],
        observedProofTypes: Array.isArray(record.observed_proof_types)
          ? record.observed_proof_types.filter((value): value is string => typeof value === 'string')
          : [],
      } satisfies SliceIterationView;
    })
    .filter((item): item is SliceIterationView => item !== null)
    .sort((left, right) => left.iterationNumber - right.iterationNumber);

  return iterations;
}

function formatArtifactValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }
  if (typeof value === 'object') {
    const count = Object.keys(value as Record<string, unknown>).length;
    return `${count} field${count === 1 ? '' : 's'}`;
  }
  return String(value);
}

function ArtifactSummaryGrid({
  title,
  values,
}: {
  title: string;
  values: Array<{ label: string; value: string }>;
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {values.map((item) => (
          <div
            key={`${title}:${item.label}`}
            className="rounded-lg border border-outline-variant/10 bg-surface px-3 py-3"
          >
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              {item.label}
            </p>
            <p className="mt-1 text-sm text-on-surface break-words">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtifactSemanticSummary({ artifact }: { artifact: ArtifactContent }) {
  if (artifact.artifact_type === 'spec_attachment') {
    return (
      <ArtifactSummaryGrid
        title="Spec Attachment"
        values={[
          {
            label: 'Attachment name',
            value:
              typeof artifact.metadata.attachment_name === 'string'
                ? artifact.metadata.attachment_name
                : artifact.path,
          },
          { label: 'Characters', value: formatArtifactValue(artifact.metadata.character_count) },
          { label: 'Lines', value: formatArtifactValue(artifact.metadata.line_count) },
        ]}
      />
    );
  }

  if (artifact.artifact_type === 'run_resume_intent' || artifact.artifact_type === 'slice_resume_intent') {
    const resumeIntent = parseResumeIntentArtifact(artifact);
    if (resumeIntent) {
      return (
        <ArtifactSummaryGrid
          title="Resume Context"
          values={[
            { label: 'Agent', value: formatArtifactValue(resumeIntent.agent) },
            {
              label: 'Operation',
              value: resumeIntent.operation ? formatPausedOperation(resumeIntent.operation) : '-',
            },
            { label: 'Session strategy', value: formatArtifactValue(resumeIntent.sessionStrategy) },
            { label: 'Schema root', value: formatArtifactValue(resumeIntent.schemaRootType) },
            {
              label: 'Schema fields',
              value: resumeIntent.schemaFieldNames.length === 0 ? '-' : resumeIntent.schemaFieldNames.join(', '),
            },
            { label: 'Workspace', value: formatArtifactValue(resumeIntent.workspacePath) },
          ]}
        />
      );
    }
  }

  if (artifact.artifact_type === 'final_report') {
    const parsed = parseArtifactJson(artifact);
    if (!parsed) {
      return null;
    }
    const summary = parsed.summary;
    if (summary && typeof summary === 'object' && !Array.isArray(summary)) {
      return (
        <ArtifactSummaryGrid
          title="Report Summary"
          values={Object.entries(summary as Record<string, unknown>).map(([label, value]) => ({
            label: label.replace(/_/g, ' '),
            value: formatArtifactValue(value),
          }))}
        />
      );
    }
  }

  if (artifact.artifact_type === 'baseline_policy_verdict') {
    const parsed = parseArtifactJson(artifact);
    if (!parsed) {
      return null;
    }
    return (
      <ArtifactSummaryGrid
        title="Policy Verdict"
        values={[
          { label: 'Verdict', value: formatArtifactValue(parsed.verdict) },
          { label: 'Clean worktree', value: formatArtifactValue(parsed.clean_worktree) },
          { label: 'Tests', value: formatArtifactValue(parsed.tests_status) },
          { label: 'Lint', value: formatArtifactValue(parsed.lint_status) },
          { label: 'Typecheck', value: formatArtifactValue(parsed.typecheck_status) },
        ]}
      />
    );
  }

  if (artifact.artifact_type === 'proof_results') {
    const proofResults = parseArtifactJsonArray(artifact);
    if (!proofResults) {
      return null;
    }
    const passedCount = proofResults.filter((item) => {
      return item && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>).status === 'passed';
    }).length;
    return (
      <ArtifactSummaryGrid
        title="Proof Summary"
        values={[
          { label: 'Proof runs', value: `${proofResults.length} result${proofResults.length === 1 ? '' : 's'}` },
          { label: 'Passed', value: `${passedCount} passed` },
        ]}
      />
    );
  }

  if (artifact.artifact_type === 'slice_iteration_summary') {
    const parsed = parseArtifactJson(artifact);
    if (!parsed) {
      return null;
    }
    return (
      <ArtifactSummaryGrid
        title="Iteration Summary"
        values={[
          { label: 'Iteration count', value: formatArtifactValue(parsed.iteration_count) },
          { label: 'Approved', value: formatArtifactValue(parsed.approved) },
          { label: 'Final generator step', value: formatArtifactValue(parsed.final_generator_operation) },
          { label: 'Rubric floor misses', value: formatArtifactValue(parsed.rubric_floor_failure_count) },
          { label: 'Patch failures', value: formatArtifactValue(parsed.patch_failure_count) },
        ]}
      />
    );
  }

  if (artifact.artifact_type === 'slice_iterations') {
    const iterations = parseSliceIterationsArtifact(artifact);
    if (!iterations || iterations.length === 0) {
      return null;
    }
    const latest = iterations[iterations.length - 1];
    return (
      <ArtifactSummaryGrid
        title="Iteration History"
        values={[
          { label: 'Iterations', value: `${iterations.length}` },
          {
            label: 'Latest step',
            value: latest.generatorOperation ? formatPausedOperation(latest.generatorOperation) : '-',
          },
          {
            label: 'Latest verdict',
            value: latest.approved === null ? '-' : latest.approved ? 'approved' : 'rejected',
          },
          { label: 'Rubric blockers', value: `${latest.rubricFloorFailures.length}` },
        ]}
      />
    );
  }

  if (artifact.artifact_type === 'baseline') {
    const parsed = parseArtifactJson(artifact);
    if (!parsed) {
      return null;
    }
    return (
      <ArtifactSummaryGrid
        title="Baseline Summary"
        values={[
          { label: 'Branch', value: formatArtifactValue(parsed.current_branch) },
          { label: 'Head sha', value: formatArtifactValue(parsed.head_sha) },
          { label: 'Worktree clean', value: formatArtifactValue(parsed.worktree_clean) },
        ]}
      />
    );
  }

  const parsed = parseArtifactJson(artifact);
  if (!parsed) {
    return null;
  }
  return (
    <ArtifactSummaryGrid
      title="Artifact Summary"
      values={Object.entries(parsed)
        .slice(0, 6)
        .map(([label, value]) => ({
          label: label.replace(/_/g, ' '),
          value: formatArtifactValue(value),
        }))}
    />
  );
}

export function pickLatestArtifactByType(
  artifacts: ArtifactSummary[],
  artifactType: string,
): ArtifactSummary | null {
  const matching = artifacts.filter((artifact) => artifact.artifact_type === artifactType);
  if (matching.length === 0) {
    return null;
  }
  return [...matching].sort((left, right) => {
    const leftId = left.artifact_id ?? -1;
    const rightId = right.artifact_id ?? -1;
    if (leftId !== rightId) {
      return rightId - leftId;
    }
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTime - leftTime;
  })[0];
}

function summarizeTextArtifact(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

function KeyArtifactCard({
  title,
  subtitle,
  artifactSummary,
  artifact,
  loading,
  error,
  onInspect,
}: {
  title: string;
  subtitle: string;
  artifactSummary: ArtifactSummary | null;
  artifact: ArtifactContent | null;
  loading: boolean;
  error: string | null;
  onInspect: (artifactId: number) => void;
}) {
  if (!artifactSummary || artifactSummary.artifact_id === null) {
    return null;
  }

  const textPreview =
    artifact && artifact.content_kind === 'text' && artifact.content && summarizeTextArtifact(artifact.content);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-on-surface">{title}</p>
            <StatusBadge status={artifactSummary.artifact_type} />
          </div>
          <p className="text-sm text-on-surface-variant">{subtitle}</p>
          <p className="font-mono text-[11px] break-all text-on-surface-variant">{artifactSummary.path}</p>
        </div>
        <button
          type="button"
          onClick={() => onInspect(artifactSummary.artifact_id!)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
        >
          <FileText className="h-4 w-4" />
          Open
        </button>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading summary...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-error/20 bg-error/10 px-3 py-3 text-sm text-error">
            {error}
          </div>
        ) : artifact ? (
          <div className="space-y-3">
            <ArtifactSemanticSummary artifact={artifact} />
            {textPreview && <p className="text-sm text-on-surface-variant line-clamp-3">{textPreview}</p>}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Artifact summary not loaded yet.</p>
        )}
      </div>
    </div>
  );
}

export function KeyArtifactsSection({
  artifacts,
  loadedArtifacts,
  loadingIds,
  errors,
  onInspect,
}: {
  artifacts: ArtifactSummary[];
  loadedArtifacts: Record<number, ArtifactContent>;
  loadingIds: Set<number>;
  errors: Record<number, string>;
  onInspect: (artifactId: number) => void;
}) {
  const keyArtifactConfigs = [
    {
      title: 'Final Plan',
      subtitle: 'Latest reconciled plan that drives slice execution.',
      summary: pickLatestArtifactByType(artifacts, 'development_plan_final'),
    },
    {
      title: 'Plan Review',
      subtitle: 'Codex review of the draft development plan.',
      summary: pickLatestArtifactByType(artifacts, 'development_plan_review'),
    },
    {
      title: 'Latest Verification',
      subtitle: 'Most recent slice verification verdict and policy reasons.',
      summary: pickLatestArtifactByType(artifacts, 'slice_verification'),
    },
    {
      title: 'Latest Proof Results',
      subtitle: 'Latest collected proof runs, including browser evidence when present.',
      summary: pickLatestArtifactByType(artifacts, 'slice_proof_results'),
    },
    {
      title: 'Latest Iteration Summary',
      subtitle: 'Current generator/evaluator loop summary for the most recent slice attempt.',
      summary: pickLatestArtifactByType(artifacts, 'slice_iteration_summary'),
    },
  ].filter((entry) => entry.summary && entry.summary.artifact_id !== null);

  if (keyArtifactConfigs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-headline text-xl font-bold">Key Artifacts</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Fast access to the planning and execution artifacts operators inspect most often.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {keyArtifactConfigs.map((entry) => {
          const artifactId = entry.summary?.artifact_id;
          return (
            <div key={`${entry.title}:${artifactId}`}>
              <KeyArtifactCard
                title={entry.title}
                subtitle={entry.subtitle}
                artifactSummary={entry.summary}
                artifact={artifactId ? loadedArtifacts[artifactId] ?? null : null}
                loading={artifactId ? loadingIds.has(artifactId) : false}
                error={artifactId ? errors[artifactId] ?? null : null}
                onInspect={onInspect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function collectKeyArtifactIds(artifacts: ArtifactSummary[]): number[] {
  return [
    pickLatestArtifactByType(artifacts, 'development_plan_final'),
    pickLatestArtifactByType(artifacts, 'development_plan_review'),
    pickLatestArtifactByType(artifacts, 'slice_verification'),
    pickLatestArtifactByType(artifacts, 'slice_proof_results'),
    pickLatestArtifactByType(artifacts, 'slice_iteration_summary'),
  ]
    .map((artifact) => artifact?.artifact_id ?? null)
    .filter((artifactId): artifactId is number => artifactId !== null);
}

export function ResumeIntentCard({
  artifactSummary,
  artifact,
  loading,
  error,
  onInspect,
}: {
  artifactSummary: ArtifactSummary | null;
  artifact: ArtifactContent | null;
  loading: boolean;
  error: string | null;
  onInspect: (artifactId: number) => void;
}) {
  if (!artifactSummary || artifactSummary.artifact_id === null) {
    return null;
  }

  const resumeIntent = artifact ? parseResumeIntentArtifact(artifact) : null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Resume Context</h2>
              <p className="text-sm text-on-surface-variant">
                Stored contract for the paused agent step. This is what the harness will rely on when the provider window reopens.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading resume contract...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : resumeIntent ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {resumeIntent.agent && <StatusBadge status={resumeIntent.agent} />}
                {resumeIntent.operation && <StatusBadge status={formatPausedOperation(resumeIntent.operation)} />}
                {resumeIntent.sessionStrategy && <StatusBadge status={`session ${resumeIntent.sessionStrategy}`} />}
                {resumeIntent.schemaRootType && <StatusBadge status={`schema ${resumeIntent.schemaRootType}`} />}
                {resumeIntent.sliceId && <StatusBadge status={`slice ${resumeIntent.sliceId}`} />}
                {typeof resumeIntent.attemptNumber === 'number' && (
                  <StatusBadge status={`attempt ${resumeIntent.attemptNumber + 1}`} />
                )}
              </div>
              {resumeIntent.workspacePath && (
                <p className="font-mono text-[11px] break-all text-on-surface-variant">
                  {resumeIntent.workspacePath}
                </p>
              )}
              {resumeIntent.schemaFieldNames.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Expected Schema Fields
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resumeIntent.schemaFieldNames.map((fieldName) => (
                      <span
                        key={fieldName}
                        className="rounded-full border border-outline-variant/10 bg-surface px-2 py-1 font-mono text-[11px] text-on-surface"
                      >
                        {fieldName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {resumeIntent.plannedFiles.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Planned Files
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resumeIntent.plannedFiles.slice(0, 6).map((filePath) => (
                      <span
                        key={filePath}
                        className="rounded-full border border-outline-variant/10 bg-surface px-2 py-1 font-mono text-[11px] text-on-surface"
                      >
                        {filePath}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {resumeIntent.contractNote && (
                <p className="text-xs text-on-surface-variant">{resumeIntent.contractNote}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              Resume intent exists for this run, but its JSON summary could not be parsed on-device.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onInspect(artifactSummary.artifact_id)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
        >
          <Terminal className="h-4 w-4" />
          Inspect Contract
        </button>
      </div>
    </div>
  );
}

export function IterationHistorySection({
  slice,
  artifactSummary,
  artifact,
  loading,
  error,
  onInspect,
}: {
  slice: Slice | null;
  artifactSummary: ArtifactSummary | null;
  artifact: ArtifactContent | null;
  loading: boolean;
  error: string | null;
  onInspect: (artifactId: number) => void;
}) {
  if (!slice) {
    return null;
  }

  const iterations = artifact ? parseSliceIterationsArtifact(artifact) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Iteration History</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Generator and evaluator passes for the current slice, with the latest blockers and fixes.
          </p>
        </div>
        {artifactSummary?.artifact_id !== null && artifactSummary && (
          <button
            type="button"
            onClick={() => onInspect(artifactSummary.artifact_id!)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
          >
            <FileText className="h-4 w-4" />
            Open Artifact
          </button>
        )}
      </div>
      {loading ? (
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading iteration history...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      ) : !iterations || iterations.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
          No iteration history has been captured for this slice yet.
        </div>
      ) : (
        <div className="space-y-3">
          {[...iterations].reverse().map((iteration) => (
            <div
              key={`${slice.slice_id}:${iteration.iterationNumber}`}
              className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`iteration ${iteration.iterationNumber}`} />
                    {iteration.generatorAgent && <StatusBadge status={iteration.generatorAgent} />}
                    {iteration.generatorOperation && (
                      <StatusBadge status={formatPausedOperation(iteration.generatorOperation)} />
                    )}
                    {iteration.approved !== null && (
                      <StatusBadge status={iteration.approved ? 'approved' : 'rejected'} />
                    )}
                  </div>
                  {iteration.implementationSummary && (
                    <p className="text-sm text-on-surface">{iteration.implementationSummary}</p>
                  )}
                  {iteration.evaluationSummary && (
                    <p className="text-sm text-on-surface-variant">{iteration.evaluationSummary}</p>
                  )}
                </div>
              </div>

              {(iteration.changedFiles.length > 0 || iteration.testsRun.length > 0) && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Changed Files
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {iteration.changedFiles.slice(0, 6).map((filePath) => (
                        <span
                          key={`${iteration.iterationNumber}:${filePath}`}
                          className="rounded-full border border-outline-variant/10 bg-surface px-2 py-1 font-mono text-[11px] text-on-surface"
                        >
                          {filePath}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Tests Run
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {iteration.testsRun.slice(0, 4).map((testName) => (
                        <span
                          key={`${iteration.iterationNumber}:${testName}`}
                          className="rounded-full border border-outline-variant/10 bg-surface px-2 py-1 font-mono text-[11px] text-on-surface"
                        >
                          {testName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {iteration.verificationReasons.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Verification Blockers
                  </p>
                  {iteration.verificationReasons.slice(0, 4).map((reason) => (
                    <p key={`${iteration.iterationNumber}:verification:${reason}`} className="text-sm text-on-surface-variant">
                      {reason}
                    </p>
                  ))}
                </div>
              )}

              {iteration.rubricFloorFailures.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    Rubric Misses
                  </p>
                  {iteration.rubricFloorFailures.slice(0, 4).map((reason) => (
                    <p key={`${iteration.iterationNumber}:rubric:${reason}`} className="text-sm text-on-surface-variant">
                      {reason}
                    </p>
                  ))}
                </div>
              )}

              {iteration.patchError && (
                <div className="mt-3 rounded-lg border border-error/20 bg-error/10 px-3 py-3 text-sm text-error">
                  {iteration.patchError}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArtifactExplorer({
  artifacts,
  selectedArtifactId,
  selectedArtifact,
  artifactLoading,
  artifactError,
  onOpenArtifact,
}: {
  artifacts: ArtifactSummary[];
  selectedArtifactId: number | null;
  selectedArtifact: ArtifactContent | null;
  artifactLoading: boolean;
  artifactError: string | null;
  onOpenArtifact: (artifactId: number) => void;
}) {
  if (artifacts.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
        No stored artifacts for this run yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        {artifacts.map((artifact) => {
          const isSelected = artifact.artifact_id !== null && artifact.artifact_id === selectedArtifactId;
          return (
            <button
              key={`${artifact.path}:${artifact.artifact_id ?? 'pending'}`}
              type="button"
              disabled={artifact.artifact_id === null}
              onClick={() => {
                if (artifact.artifact_id !== null) {
                  onOpenArtifact(artifact.artifact_id);
                }
              }}
              className={cn(
                'w-full rounded-xl border px-4 py-4 text-left',
                isSelected ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/10 bg-surface-container-low',
                artifact.artifact_id === null && 'cursor-not-allowed opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={artifact.artifact_type} className="max-w-full" />
                  </div>
                  <p className="font-mono text-[11px] text-on-surface break-all">{artifact.path}</p>
                </div>
                <FileText className="mt-0.5 h-4 w-4 text-on-surface-variant" />
              </div>
            </button>
          );
        })}
      </div>
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-4">
        {artifactLoading ? (
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading artifact content...
          </div>
        ) : artifactError ? (
          <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {artifactError}
          </div>
        ) : !selectedArtifact ? (
          <p className="text-sm text-on-surface-variant">
            Select an artifact to inspect stored plan, review, verification, or proof output.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedArtifact.artifact_type} />
                <StatusBadge status={selectedArtifact.content_kind} />
              </div>
              <p className="font-mono text-[11px] break-all text-on-surface">{selectedArtifact.path}</p>
            </div>
            {selectedArtifact.content_kind === 'binary' ? (
              <p className="text-sm text-on-surface-variant">
                Binary artifact. Inspect it from the backend run directory if needed.
              </p>
            ) : selectedArtifact.content_kind === 'missing' ? (
              <p className="text-sm text-on-surface-variant">
                The artifact record exists, but the file is missing from disk.
              </p>
            ) : (
              <div className="space-y-3">
                <ArtifactSemanticSummary artifact={selectedArtifact} />
                <pre className="max-h-[32rem] overflow-auto rounded-lg bg-surface px-3 py-3 text-xs text-on-surface-variant">
                  {selectedArtifact.content}
                </pre>
              </div>
            )}
            {selectedArtifact.truncated && (
              <p className="text-xs text-on-surface-variant">Content truncated for device display.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
