import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Settings } from 'lucide-react';

import {
  ArtifactExplorer,
  IterationHistorySection,
  KeyArtifactsSection,
  ResumeIntentCard,
  RunEventTimeline,
} from '../components/run-console/RunConsoleEvidence';
import {
  CurrentEscalationCard,
  RunControlStateCard,
  RunActionControls,
  RunEscalationsList,
  SliceCard,
  SliceList,
  SpecAttachmentCard,
} from '../components/run-console/RunConsoleSections';
import { RunDetails } from '../components/RunDetails';
import { StatusBadge } from '../components/StatusBadge';
import { buildEscalationRoute } from '../lib/routes';
import { formatPausedOperation } from '../lib/runFormatters';
import { useRunConsole } from '../hooks/useRunConsole';

export function RunConsoleView({ authenticated }: { authenticated: boolean }) {
  const navigate = useNavigate();
  const consoleState = useRunConsole(authenticated);
  const run = consoleState.run;
  const [deliveryBranchName, setDeliveryBranchName] = useState('');
  const [deliveryRemoteName, setDeliveryRemoteName] = useState('origin');
  const [deliveryPushRequested, setDeliveryPushRequested] = useState(false);
  const [deliveryOverridesOpen, setDeliveryOverridesOpen] = useState(false);
  const currentSliceModel = {
    slice: consoleState.currentSlice,
    iteration: consoleState.currentIteration,
    escalation: consoleState.currentSliceEscalation,
    remainingSlices: consoleState.remainingSlices,
  };
  const actionModel = {
    loading: consoleState.actionLoading,
    autoRefreshEnabled: consoleState.autoRefreshEnabled,
    lastRefreshedAt: consoleState.lastRefreshedAt,
    canPlan: consoleState.canPlan,
    canExecuteNext: consoleState.canExecuteNext,
    canDeliver: consoleState.canDeliver,
    planActionLabel: consoleState.planActionLabel,
    executeActionLabel: consoleState.executeActionLabel,
    deliverActionLabel: consoleState.deliverActionLabel,
    planBlockedReason: consoleState.planBlockedReason,
    executeBlockedReason: consoleState.executeBlockedReason,
    deliverBlockedReason: consoleState.deliverBlockedReason,
  };
  const artifactModel = {
    selectedArtifactId: consoleState.selectedArtifactId,
    selectedArtifact: consoleState.selectedArtifact,
    keyArtifacts: consoleState.keyArtifacts,
    keyArtifactLoadingIds: consoleState.keyArtifactLoadingIds,
    keyArtifactErrors: consoleState.keyArtifactErrors,
    specAttachmentArtifact: consoleState.specAttachmentArtifact,
    resumeIntentArtifact: consoleState.resumeIntentArtifact,
    resumeIntentArtifactSummary: consoleState.resumeIntentArtifactSummary,
    resumeIntentLoading: consoleState.resumeIntentLoading,
    resumeIntentError: consoleState.resumeIntentError,
    iterationHistoryArtifact: consoleState.iterationHistoryArtifact,
    iterationHistoryArtifactSummary: consoleState.iterationHistoryArtifactSummary,
    iterationHistoryLoading: consoleState.iterationHistoryLoading,
    iterationHistoryError: consoleState.iterationHistoryError,
    artifactLoading: consoleState.artifactLoading,
    artifactError: consoleState.artifactError,
  };
  const runMeta = {
    loading: consoleState.loading,
    error: consoleState.error,
    report: consoleState.report,
    events: consoleState.events,
    escalations: consoleState.escalations,
    currentEscalation: consoleState.currentEscalation,
    activeIterationLabel: consoleState.activeIterationLabel,
    activeIterationDetail: consoleState.activeIterationDetail,
    pauseWindowOpened: consoleState.pauseWindowOpened,
    resumeCountdownLabel: consoleState.resumeCountdownLabel,
    controlState: consoleState.controlState,
  };

  useEffect(() => {
    if (!run) {
      return;
    }
    setDeliveryBranchName(run.target_branch ?? '');
    setDeliveryRemoteName(run.delivery_remote_name ?? 'origin');
    setDeliveryPushRequested(run.push_on_complete ?? false);
  }, [run?.delivery_remote_name, run?.push_on_complete, run?.run_id, run?.target_branch]);

  const openEscalationFromRun = useCallback(
    (target: string) => {
      const normalizedTarget = target.trim();
      if (!normalizedTarget) {
        return;
      }
      navigate(
        normalizedTarget.startsWith('/escalation/')
          ? normalizedTarget
          : buildEscalationRoute(normalizedTarget, run?.run_id ?? null),
      );
    },
    [navigate, run?.run_id],
  );

  if (runMeta.loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Loading run...
        </span>
      </div>
    );
  }

  if (runMeta.error || !run) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
          <Settings className="text-error w-6 h-6" />
        </div>
        <h3 className="font-headline text-xl font-bold text-error">Run Error</h3>
        <p className="text-on-surface-variant text-sm max-w-md text-center">
          {runMeta.error || 'The requested run could not be loaded.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <RunDetails
        run={run}
        report={runMeta.report}
        activeIterationLabel={runMeta.activeIterationLabel}
        activeIterationDetail={runMeta.activeIterationDetail}
      />
      <SpecAttachmentCard
        attachment={artifactModel.specAttachmentArtifact}
        onInspect={(artifactId) => consoleState.setSelectedArtifactId(artifactId)}
      />
      <CurrentEscalationCard
        escalation={runMeta.currentEscalation}
        runId={run.run_id}
        onOpenEscalation={openEscalationFromRun}
      />
      {runMeta.controlState && (
        <RunControlStateCard
          title={runMeta.controlState.title}
          description={runMeta.controlState.description}
          detail={runMeta.controlState.detail}
          tone={runMeta.controlState.tone}
          actionLabel={runMeta.controlState.actionLabel}
          onAction={
            runMeta.controlState.actionTarget
              ? () => openEscalationFromRun(runMeta.controlState.actionTarget)
              : null
          }
        />
      )}
      {run.status === 'RUN_PAUSED' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-tertiary/20 bg-tertiary/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-tertiary" />
              <div className="space-y-2">
                <div>
                  <h2 className="font-headline text-lg font-bold text-on-surface">
                    Paused for Rate Limit
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {run.paused_agent ? `${run.paused_agent} ` : 'An agent '}
                    was rate limited while running {formatPausedOperation(run.paused_operation)}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-on-surface-variant">
                  {run.resume_after && (
                    <span>Resume after {new Date(run.resume_after).toLocaleString()}</span>
                  )}
                  {runMeta.resumeCountdownLabel && (
                    <span>Resume in {runMeta.resumeCountdownLabel}</span>
                  )}
                  {run.paused_slice_id && <span>Slice {run.paused_slice_id}</span>}
                  {typeof run.paused_attempt_number === 'number' && (
                    <span>Attempt {run.paused_attempt_number + 1}</span>
                  )}
                  {run.paused_session_strategy && (
                    <span>Session {run.paused_session_strategy}</span>
                  )}
                </div>
                {run.pause_reason && <p className="text-sm text-on-surface">{run.pause_reason}</p>}
                {!runMeta.pauseWindowOpened && run.resume_after && (
                  <p className="text-xs text-on-surface-variant">
                    Resume actions stay disabled until the provider window reopens.
                  </p>
                )}
              </div>
            </div>
          </div>
          <ResumeIntentCard
            artifactSummary={artifactModel.resumeIntentArtifactSummary}
            artifact={artifactModel.resumeIntentArtifact}
            loading={artifactModel.resumeIntentLoading}
            error={artifactModel.resumeIntentError}
            onInspect={(artifactId) => consoleState.setSelectedArtifactId(artifactId)}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={actionModel.autoRefreshEnabled ? 'live refresh' : 'manual refresh'} />
          {actionModel.lastRefreshedAt && (
            <span className="text-xs text-on-surface-variant">
              Last refreshed{' '}
              {new Date(actionModel.lastRefreshedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          )}
        </div>
        <RunActionControls
          actionLoading={actionModel.loading}
          canPlan={actionModel.canPlan}
          canExecuteNext={actionModel.canExecuteNext}
          canDeliver={actionModel.canDeliver}
          planActionLabel={actionModel.planActionLabel}
          executeActionLabel={actionModel.executeActionLabel}
          deliverActionLabel={actionModel.deliverActionLabel}
          planBlockedReason={actionModel.planBlockedReason}
          executeBlockedReason={actionModel.executeBlockedReason}
          deliverBlockedReason={actionModel.deliverBlockedReason}
          deliveryBranchName={deliveryBranchName}
          deliveryRemoteName={deliveryRemoteName}
          deliveryPushRequested={deliveryPushRequested}
          deliveryOverridesOpen={deliveryOverridesOpen}
          onDeliveryBranchNameChange={setDeliveryBranchName}
          onDeliveryRemoteNameChange={setDeliveryRemoteName}
          onDeliveryPushRequestedChange={setDeliveryPushRequested}
          onToggleDeliveryOverrides={() =>
            setDeliveryOverridesOpen((current) => !current)
          }
          onPlan={() => void consoleState.runAction('plan')}
          onExecuteNext={() => void consoleState.runAction('execute_next')}
          onDeliver={() =>
            void consoleState.runAction('deliver', {
              branch_name: deliveryBranchName.trim() || undefined,
              remote_name: deliveryRemoteName.trim() || undefined,
              push: deliveryPushRequested,
            })
          }
        />
      </div>

      {runMeta.error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {runMeta.error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Slices</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Planned and executed work units for this run.
          </p>
        </div>
        {currentSliceModel.slice && (
          <div className="space-y-3">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface">Current Slice</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                The slice currently in progress, blocked, or next in line.
              </p>
            </div>
            <SliceCard
              slice={currentSliceModel.slice}
              pinned
              iteration={currentSliceModel.iteration}
              parentRunId={run.run_id}
              linkedEscalation={currentSliceModel.escalation}
              onOpenEscalation={openEscalationFromRun}
            />
          </div>
        )}
        <IterationHistorySection
          slice={currentSliceModel.slice}
          artifactSummary={artifactModel.iterationHistoryArtifactSummary}
          artifact={artifactModel.iterationHistoryArtifact}
          loading={artifactModel.iterationHistoryLoading}
          error={artifactModel.iterationHistoryError}
          onInspect={(artifactId) => consoleState.setSelectedArtifactId(artifactId)}
        />
        {currentSliceModel.remainingSlices.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface">All Slices</h3>
            </div>
            <SliceList slices={currentSliceModel.remainingSlices} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Linked Escalations</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Operator decisions raised during planning, execution, or policy enforcement.
          </p>
        </div>
        <RunEscalationsList
          escalations={runMeta.escalations}
          runId={run.run_id}
          onOpenEscalation={openEscalationFromRun}
        />
      </div>

      <KeyArtifactsSection
        artifacts={run.artifacts ?? []}
        loadedArtifacts={artifactModel.keyArtifacts}
        loadingIds={new Set(artifactModel.keyArtifactLoadingIds)}
        errors={artifactModel.keyArtifactErrors}
        onInspect={(artifactId) => consoleState.setSelectedArtifactId(artifactId)}
      />

      <div className="space-y-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Artifacts</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Stored plan, review, verification, and proof outputs. This is the current substitute
            for raw agent chat history.
          </p>
        </div>
        <ArtifactExplorer
          artifacts={run.artifacts ?? []}
          selectedArtifactId={artifactModel.selectedArtifactId}
          selectedArtifact={artifactModel.selectedArtifact}
          artifactLoading={artifactModel.artifactLoading}
          artifactError={artifactModel.artifactError}
          onOpenArtifact={(artifactId) => consoleState.setSelectedArtifactId(artifactId)}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Run Timeline</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Structured progress events from the harness. Raw agent chat history is not exposed yet.
          </p>
        </div>
        <RunEventTimeline events={runMeta.events} />
      </div>
    </div>
  );
}
