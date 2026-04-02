import { AlertTriangle, CheckCircle2, FileText, MessageSquare, Play, Workflow } from 'lucide-react';

import { cn } from '../../lib/cn';
import { buildEscalationRoute } from '../../lib/routes';
import { formatPausedOperation } from '../../lib/runFormatters';
import { StatusBadge } from '../StatusBadge';
import type { ArtifactSummary, Escalation, Slice } from '../../types';

interface IterationDetailsLike {
  iterationNumber: number | null;
  maxIterations: number | null;
  generatorAgent: string | null;
  generatorOperation: string | null;
  verificationReasons: string[];
  rubricFloorFailures: string[];
}

export function CurrentEscalationCard({
  escalation,
  onOpenEscalation,
  runId = null,
}: {
  escalation: Escalation | null;
  onOpenEscalation: (target: string) => void;
  runId?: string | null;
}) {
  if (!escalation) {
    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-secondary/10 p-2">
            <CheckCircle2 className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Current Escalation</h2>
            <p className="text-sm text-on-surface-variant">
              No open escalation is blocking this run right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const open = escalation.status.toUpperCase() === 'OPEN';

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-full p-2', open ? 'bg-tertiary/10' : 'bg-primary/10')}>
              <AlertTriangle className={cn('h-5 w-5', open ? 'text-tertiary' : 'text-primary')} />
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Current Escalation</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge status={escalation.status} />
                <StatusBadge status={escalation.kind} />
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {escalation.escalation_id}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-on-surface">{escalation.question}</p>
          <p className="text-xs text-on-surface-variant">
            {open
              ? 'This run currently needs an operator decision.'
              : `Last escalation was resolved${escalation.resolved_by_username ? ` by ${escalation.resolved_by_username}` : ''}.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenEscalation(buildEscalationRoute(escalation.escalation_id, runId))}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
        >
          <MessageSquare className="h-4 w-4" />
          Open Escalation
        </button>
      </div>
    </div>
  );
}

export function SpecAttachmentCard({
  attachment,
  onInspect,
}: {
  attachment: ArtifactSummary | null;
  onInspect: (artifactId: number) => void;
}) {
  if (!attachment || attachment.artifact_id === null) {
    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold text-on-surface">Original Spec Attachment</h2>
            <p className="text-sm text-on-surface-variant">
              This run was started without a separate outline attachment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const characterCount = attachment.metadata.character_count;
  const lineCount = attachment.metadata.line_count;
  const attachmentName = attachment.metadata.attachment_name;

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Original Spec Attachment</h2>
              <p className="text-sm text-on-surface-variant">
                {typeof attachmentName === 'string' ? attachmentName : attachment.path}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof characterCount === 'number' && (
              <StatusBadge status={`${characterCount.toLocaleString()} chars`} />
            )}
            {typeof lineCount === 'number' && (
              <StatusBadge status={`${lineCount.toLocaleString()} lines`} />
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            This is the original detailed outline attached when the run was created.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onInspect(attachment.artifact_id)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
        >
          <FileText className="h-4 w-4" />
          Inspect Attachment
        </button>
      </div>
    </div>
  );
}

export function SliceList({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
        No slices have been generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {slices.map((slice) => (
        <div key={slice.slice_id}>
          <SliceCard slice={slice} />
        </div>
      ))}
    </div>
  );
}

export function SliceCard({
  slice,
  pinned = false,
  linkedEscalation = null,
  iteration = null,
  onOpenEscalation,
  parentRunId = null,
}: {
  slice: Slice;
  pinned?: boolean;
  linkedEscalation?: Escalation | null;
  iteration?: IterationDetailsLike | null;
  onOpenEscalation?: (target: string) => void;
  parentRunId?: string | null;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-4',
        pinned
          ? 'border-primary/30 bg-primary/5'
          : 'border-outline-variant/10 bg-surface-container-low',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-on-surface">{slice.title}</p>
            <StatusBadge status={slice.status} />
            {pinned && <StatusBadge status="current slice" />}
            {iteration?.iterationNumber && (
              <StatusBadge
                status={
                  iteration.maxIterations
                    ? `iteration ${iteration.iterationNumber}/${iteration.maxIterations}`
                    : `iteration ${iteration.iterationNumber}`
                }
              />
            )}
            {iteration?.generatorAgent && <StatusBadge status={iteration.generatorAgent} />}
          </div>
          <p className="text-sm text-on-surface-variant">{slice.purpose}</p>
          <p className="font-mono text-[11px] text-on-surface-variant">
            {slice.slice_id} · phase {slice.phase_id} · risk {slice.risk_level}
          </p>
          {iteration && (
            <div className="space-y-1">
              {iteration.generatorOperation && (
                <p className="text-xs text-on-surface-variant">
                  Current loop step: {formatPausedOperation(iteration.generatorOperation)}
                </p>
              )}
              {iteration.verificationReasons.length > 0 && (
                <p className="text-xs text-on-surface-variant">
                  Latest blockers: {iteration.verificationReasons.slice(0, 2).join(' · ')}
                </p>
              )}
              {iteration.rubricFloorFailures.length > 0 && (
                <p className="text-xs text-on-surface-variant">
                  Rubric misses: {iteration.rubricFloorFailures.slice(0, 2).join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>
        <span className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
          {new Date(slice.updated_at).toLocaleString()}
        </span>
      </div>
      {(slice.planned_files.length > 0 || slice.tests_required.length > 0) && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
              Planned Files
            </p>
            <div className="flex flex-wrap gap-2">
              {slice.planned_files.length === 0 ? (
                <span className="text-xs text-on-surface-variant">None declared</span>
              ) : (
                slice.planned_files.map((file) => (
                  <span
                    key={file}
                    className="rounded-full border border-outline-variant/10 bg-surface px-2 py-1 font-mono text-[11px] text-on-surface"
                  >
                    {file}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-on-surface-variant">
              Required Tests
            </p>
            <div className="flex flex-wrap gap-2">
              {slice.tests_required.length === 0 ? (
                <span className="text-xs text-on-surface-variant">None declared</span>
              ) : (
                slice.tests_required.map((testName) => (
                  <span
                    key={testName}
                    className="rounded-full border border-outline-variant/10 bg-surface px-2 py-1 font-mono text-[11px] text-on-surface"
                  >
                    {testName}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {linkedEscalation && onOpenEscalation && (
        <div className="mt-3 rounded-lg border border-tertiary/20 bg-tertiary/10 px-3 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={linkedEscalation.status} />
                <StatusBadge status={linkedEscalation.kind} />
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {linkedEscalation.escalation_id}
                </span>
              </div>
              <p className="text-sm text-on-surface">
                {linkedEscalation.question}
              </p>
              <p className="text-xs text-on-surface-variant">
                This escalation is currently blocking or affecting the pinned slice.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onOpenEscalation(buildEscalationRoute(linkedEscalation.escalation_id, parentRunId))
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
            >
              <MessageSquare className="h-4 w-4" />
              Open Blocker
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RunEscalationsList({
  escalations,
  onOpenEscalation,
  runId = null,
}: {
  escalations: Escalation[];
  onOpenEscalation: (target: string) => void;
  runId?: string | null;
}) {
  if (escalations.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
        No escalations linked to this run.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {escalations.map((escalation) => (
        <div
          key={escalation.escalation_id}
          className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={escalation.status} />
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {escalation.escalation_id}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {escalation.kind}
                </span>
              </div>
              <p className="text-sm text-on-surface">{escalation.question}</p>
              {escalation.slice_id && (
                <p className="font-mono text-[11px] text-on-surface-variant">
                  Slice {escalation.slice_id}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenEscalation(buildEscalationRoute(escalation.escalation_id, runId))}
              className="rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
            >
              Open
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RunActionControls({
  actionLoading,
  canPlan,
  canExecuteNext,
  planActionLabel,
  executeActionLabel,
  planBlockedReason,
  executeBlockedReason,
  onPlan,
  onExecuteNext,
}: {
  actionLoading: boolean;
  canPlan: boolean;
  canExecuteNext: boolean;
  planActionLabel: string;
  executeActionLabel: string;
  planBlockedReason: string | null;
  executeBlockedReason: string | null;
  onPlan: () => void;
  onExecuteNext: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <button
          type="button"
          disabled={actionLoading || !canPlan}
          onClick={onPlan}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Workflow className="w-4 h-4" />
          {planActionLabel}
        </button>
        <p
          className={cn(
            'text-xs',
            planBlockedReason ? 'text-on-surface-variant' : 'text-secondary',
          )}
        >
          {planBlockedReason ?? 'Ready to generate or resume planning for this run.'}
        </p>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          disabled={actionLoading || !canExecuteNext}
          onClick={onExecuteNext}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="w-4 h-4" />
          {executeActionLabel}
        </button>
        <p
          className={cn(
            'text-xs',
            executeBlockedReason ? 'text-on-surface-variant' : 'text-secondary',
          )}
        >
          {executeBlockedReason ?? 'Ready to execute the next available slice.'}
        </p>
      </div>
    </div>
  );
}
