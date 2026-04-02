import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  collectKeyArtifactIds,
  latestIterationForSlice,
  pickLatestArtifactByType,
} from '../components/run-console/RunConsoleEvidence';
import { formatPausedOperation } from '../lib/runFormatters';
import { api } from '../services/api';
import type {
  ArtifactContent,
  Escalation,
  Run,
  RunEvent,
  RunReportResponse,
  Slice,
} from '../types';

const AUTO_REFRESH_INTERVAL_MS = 5000;
const ACTIVE_RUN_STATUSES = new Set([
  'INTAKE',
  'BASELINE_RUNNING',
  'PLANNING',
  'PLAN_REVIEW',
  'PLAN_RECONCILIATION',
  'SLICING',
  'READY_FOR_SLICE',
  'SLICE_RUNNING',
  'RUN_PAUSED',
]);
const ACTIVE_SLICE_STATUSES = new Set(['RUNNING', 'ESCALATED', 'BLOCKED']);
const PAUSED_PLANNING_STATUSES = new Set([
  'PLANNING',
  'PLAN_REVIEW',
  'PLAN_RECONCILIATION',
  'SLICING',
]);

function hasPauseWindowOpened(run: Run | null) {
  if (!run?.resume_after) {
    return true;
  }
  return new Date(run.resume_after).getTime() <= Date.now();
}

export function useRunConsole(authenticated: boolean) {
  const { id } = useParams<{ id: string }>();
  const refreshInFlightRef = useRef(false);
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<RunReportResponse | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [slices, setSlices] = useState<Slice[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactContent | null>(null);
  const [keyArtifacts, setKeyArtifacts] = useState<Record<number, ArtifactContent>>({});
  const [keyArtifactLoadingIds, setKeyArtifactLoadingIds] = useState<number[]>([]);
  const [keyArtifactErrors, setKeyArtifactErrors] = useState<Record<number, string>>({});
  const [resumeIntentArtifact, setResumeIntentArtifact] = useState<ArtifactContent | null>(null);
  const [resumeIntentLoading, setResumeIntentLoading] = useState(false);
  const [resumeIntentError, setResumeIntentError] = useState<string | null>(null);
  const [iterationHistoryArtifact, setIterationHistoryArtifact] = useState<ArtifactContent | null>(null);
  const [iterationHistoryLoading, setIterationHistoryLoading] = useState(false);
  const [iterationHistoryError, setIterationHistoryError] = useState<string | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [artifactError, setArtifactError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const currentEscalation =
    escalations.find((escalation) => escalation.status.toUpperCase() === 'OPEN') ??
    escalations[0] ??
    null;
  const hasOpenEscalation = currentEscalation?.status.toUpperCase() === 'OPEN';
  const specAttachmentArtifact =
    (run?.artifacts ?? []).find((artifact) => artifact.artifact_type === 'spec_attachment') ?? null;
  const resumeIntentArtifactSummary =
    run?.status !== 'RUN_PAUSED'
      ? null
      : run.paused_slice_id
        ? (run.artifacts ?? []).find(
            (artifact) =>
              artifact.artifact_type === 'slice_resume_intent' &&
              artifact.path.includes(`/slices/${run.paused_slice_id}/`),
          ) ?? null
        : (run.artifacts ?? []).find((artifact) => artifact.artifact_type === 'run_resume_intent') ??
          null;
  const currentSlice =
    slices.find((slice) => ACTIVE_SLICE_STATUSES.has(slice.status.toUpperCase())) ??
    slices.find((slice) => slice.status.toUpperCase() === 'PENDING') ??
    null;
  const currentSliceEscalation =
    currentSlice === null
      ? null
      : escalations.find(
          (escalation) =>
            escalation.slice_id === currentSlice.slice_id &&
            escalation.status.toUpperCase() === 'OPEN',
        ) ??
        escalations.find((escalation) => escalation.slice_id === currentSlice.slice_id) ??
        null;
  const currentIteration = latestIterationForSlice(events, currentSlice?.slice_id ?? null);
  const iterationHistoryArtifactSummary =
    currentSlice === null
      ? null
      : (run?.artifacts ?? []).find(
          (artifact) =>
            artifact.artifact_type === 'slice_iterations' &&
            artifact.path.includes(`/slices/${currentSlice.slice_id}/`),
        ) ?? pickLatestArtifactByType(run?.artifacts ?? [], 'slice_iterations');
  const remainingSlices =
    currentSlice === null ? slices : slices.filter((slice) => slice.slice_id !== currentSlice.slice_id);
  const activeIterationLabel = currentIteration?.iterationNumber
    ? currentIteration.maxIterations
      ? `${currentIteration.iterationNumber}/${currentIteration.maxIterations}`
      : `${currentIteration.iterationNumber}`
    : null;
  const activeIterationDetail = currentIteration
    ? [
        currentIteration.sliceId ? `Slice ${currentIteration.sliceId}` : null,
        currentIteration.generatorOperation
          ? formatPausedOperation(currentIteration.generatorOperation)
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' · ')
    : null;
  const autoRefreshEnabled = run ? ACTIVE_RUN_STATUSES.has(run.status) : false;
  const keyArtifactIds = run ? collectKeyArtifactIds(run.artifacts ?? []) : [];
  const pauseWindowOpened = hasPauseWindowOpened(run);
  const pausedForPlanning =
    run?.status === 'RUN_PAUSED' && PAUSED_PLANNING_STATUSES.has(run.paused_from_status ?? '');
  const pausedForExecution = run?.status === 'RUN_PAUSED' && run.paused_from_status === 'SLICE_RUNNING';
  const canPlan = run?.status === 'PLANNING' || (pausedForPlanning && pauseWindowOpened);
  const canExecuteNext = run?.status === 'READY_FOR_SLICE' || (pausedForExecution && pauseWindowOpened);
  const planActionLabel = pausedForPlanning ? 'Resume Planning' : 'Generate Plan';
  const executeActionLabel = pausedForExecution ? 'Resume Slice' : 'Execute Next Slice';
  const planBlockedReason = (() => {
    if (actionLoading) {
      return 'Another run action is already in progress.';
    }
    if (canPlan) {
      return null;
    }
    if (pausedForPlanning && run?.resume_after && !pauseWindowOpened) {
      return `Waiting for ${run.paused_agent ?? 'agent'} to reopen ${formatPausedOperation(run.paused_operation)} after ${new Date(run.resume_after).toLocaleString()}.`;
    }
    if (hasOpenEscalation) {
      return `Resolve escalation ${currentEscalation?.escalation_id} before planning continues.`;
    }
    if (run?.status === 'READY_FOR_SLICE') {
      return 'Planning is already complete for this run.';
    }
    if (run?.status === 'RUN_PAUSED') {
      return 'This run is paused outside the planning phase. Resume the paused execution step instead.';
    }
    return `Run must be in PLANNING to generate a plan. Current status: ${run?.status}.`;
  })();
  const executeBlockedReason = (() => {
    if (actionLoading) {
      return 'Another run action is already in progress.';
    }
    if (canExecuteNext) {
      return null;
    }
    if (pausedForExecution && run?.resume_after && !pauseWindowOpened) {
      return `Waiting for ${run.paused_agent ?? 'agent'} to reopen ${formatPausedOperation(run.paused_operation)} after ${new Date(run.resume_after).toLocaleString()}.`;
    }
    if (hasOpenEscalation) {
      return `Resolve escalation ${currentEscalation?.escalation_id} before executing the next slice.`;
    }
    if (run?.status === 'RUN_COMPLETE') {
      return 'This run is already complete.';
    }
    if (run?.status === 'RUN_PAUSED') {
      return 'This run is paused during planning. Resume planning first.';
    }
    if (
      run?.status === 'PLANNING' ||
      run?.status === 'PLAN_REVIEW' ||
      run?.status === 'PLAN_RECONCILIATION' ||
      run?.status === 'SLICING'
    ) {
      return 'Generate or resume the plan before executing slices.';
    }
    return `Run must be READY_FOR_SLICE to execute work. Current status: ${run?.status}.`;
  })();

  const loadRunConsole = useCallback(
    async (background = false) => {
      if (!id) {
        if (!background) {
          setError('Missing run ID.');
          setLoading(false);
        }
        return;
      }
      if (!authenticated) {
        if (!background) {
          setError('Configure the backend URL and sign in first.');
          setLoading(false);
        }
        return;
      }
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        const [runResponse, eventsResponse, slicesResponse, escalationsResponse] = await Promise.all([
          api.getRun(id),
          api.getRunEvents(id),
          api.listSlices(id),
          api.listRunEscalations(id),
        ]);
        setRun(runResponse);
        setEvents(eventsResponse);
        setSlices(slicesResponse);
        setEscalations(escalationsResponse);
        try {
          const reportResponse = await api.getRunReport(id);
          setReport(reportResponse);
        } catch {
          setReport(null);
        }
        setLastRefreshedAt(new Date().toISOString());
      } catch (loadError) {
        if (!background) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load run.');
        }
      } finally {
        if (!background) {
          setLoading(false);
        }
        refreshInFlightRef.current = false;
      }
    },
    [authenticated, id],
  );

  useEffect(() => {
    void loadRunConsole(false);
  }, [loadRunConsole]);

  useEffect(() => {
    setKeyArtifacts({});
    setKeyArtifactErrors({});
    setKeyArtifactLoadingIds([]);
  }, [id]);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void loadRunConsole(true);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [autoRefreshEnabled, loadRunConsole]);

  useEffect(() => {
    if (!run || selectedArtifactId !== null) {
      return;
    }
    const firstArtifactWithId =
      (run.artifacts ?? []).find((artifact) => artifact.artifact_type === 'spec_attachment') ??
      (run.artifacts ?? []).find((artifact) => artifact.artifact_id !== null);
    if (firstArtifactWithId?.artifact_id !== null) {
      setSelectedArtifactId(firstArtifactWithId.artifact_id);
    }
  }, [run, selectedArtifactId]);

  useEffect(() => {
    async function loadArtifact() {
      if (!id || selectedArtifactId === null) {
        setSelectedArtifact(null);
        setArtifactError(null);
        setArtifactLoading(false);
        return;
      }
      setArtifactLoading(true);
      setArtifactError(null);
      try {
        setSelectedArtifact(await api.getRunArtifact(id, selectedArtifactId));
      } catch (loadError) {
        setSelectedArtifact(null);
        setArtifactError(loadError instanceof Error ? loadError.message : 'Failed to load artifact.');
      } finally {
        setArtifactLoading(false);
      }
    }

    void loadArtifact();
  }, [id, selectedArtifactId]);

  useEffect(() => {
    async function loadKeyArtifacts() {
      if (!id || keyArtifactIds.length === 0) {
        setKeyArtifacts({});
        setKeyArtifactErrors({});
        setKeyArtifactLoadingIds([]);
        return;
      }

      const missingIds = keyArtifactIds.filter((artifactId) => keyArtifacts[artifactId] === undefined);
      if (missingIds.length === 0) {
        return;
      }

      setKeyArtifactLoadingIds((current) => Array.from(new Set([...current, ...missingIds])));

      const results = await Promise.all(
        missingIds.map(async (artifactId) => {
          try {
            const artifact =
              selectedArtifact && selectedArtifact.artifact_id === artifactId
                ? selectedArtifact
                : await api.getRunArtifact(id, artifactId);
            return { artifactId, artifact, error: null as string | null };
          } catch (loadError) {
            return {
              artifactId,
              artifact: null,
              error: loadError instanceof Error ? loadError.message : 'Failed to load artifact summary.',
            };
          }
        }),
      );

      setKeyArtifacts((current) => {
        const next = { ...current };
        for (const result of results) {
          if (result.artifact) {
            next[result.artifactId] = result.artifact;
          }
        }
        return next;
      });
      setKeyArtifactErrors((current) => {
        const next = { ...current };
        for (const result of results) {
          if (result.error) {
            next[result.artifactId] = result.error;
          } else {
            delete next[result.artifactId];
          }
        }
        return next;
      });
      setKeyArtifactLoadingIds((current) => current.filter((artifactId) => !missingIds.includes(artifactId)));
    }

    void loadKeyArtifacts();
  }, [id, keyArtifactIds, keyArtifacts, selectedArtifact]);

  useEffect(() => {
    async function loadResumeIntentArtifact() {
      if (!id || resumeIntentArtifactSummary?.artifact_id === null || !resumeIntentArtifactSummary) {
        setResumeIntentArtifact(null);
        setResumeIntentError(null);
        setResumeIntentLoading(false);
        return;
      }

      if (selectedArtifact && selectedArtifact.artifact_id === resumeIntentArtifactSummary.artifact_id) {
        setResumeIntentArtifact(selectedArtifact);
        setResumeIntentError(null);
        setResumeIntentLoading(false);
        return;
      }

      setResumeIntentLoading(true);
      setResumeIntentError(null);
      try {
        setResumeIntentArtifact(await api.getRunArtifact(id, resumeIntentArtifactSummary.artifact_id));
      } catch (loadError) {
        setResumeIntentArtifact(null);
        setResumeIntentError(loadError instanceof Error ? loadError.message : 'Failed to load resume contract.');
      } finally {
        setResumeIntentLoading(false);
      }
    }

    void loadResumeIntentArtifact();
  }, [id, resumeIntentArtifactSummary, selectedArtifact]);

  useEffect(() => {
    async function loadIterationHistoryArtifact() {
      if (!id || iterationHistoryArtifactSummary?.artifact_id === null || !iterationHistoryArtifactSummary) {
        setIterationHistoryArtifact(null);
        setIterationHistoryError(null);
        setIterationHistoryLoading(false);
        return;
      }

      if (selectedArtifact && selectedArtifact.artifact_id === iterationHistoryArtifactSummary.artifact_id) {
        setIterationHistoryArtifact(selectedArtifact);
        setIterationHistoryError(null);
        setIterationHistoryLoading(false);
        return;
      }

      setIterationHistoryLoading(true);
      setIterationHistoryError(null);
      try {
        setIterationHistoryArtifact(await api.getRunArtifact(id, iterationHistoryArtifactSummary.artifact_id));
      } catch (loadError) {
        setIterationHistoryArtifact(null);
        setIterationHistoryError(loadError instanceof Error ? loadError.message : 'Failed to load iteration history.');
      } finally {
        setIterationHistoryLoading(false);
      }
    }

    void loadIterationHistoryArtifact();
  }, [id, iterationHistoryArtifactSummary, selectedArtifact]);

  const runAction = useCallback(
    async (action: 'plan' | 'execute_next') => {
      if (!id) {
        return;
      }
      setActionLoading(true);
      setError(null);
      try {
        if (action === 'plan') {
          await api.planRun(id);
        } else {
          await api.executeNextSlice(id);
        }
        await loadRunConsole();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : 'Run action failed.');
      } finally {
        setActionLoading(false);
      }
    },
    [id, loadRunConsole],
  );

  return {
    id,
    run,
    report,
    events,
    slices,
    escalations,
    selectedArtifactId,
    setSelectedArtifactId,
    selectedArtifact,
    keyArtifacts,
    keyArtifactLoadingIds,
    keyArtifactErrors,
    resumeIntentArtifact,
    resumeIntentLoading,
    resumeIntentError,
    iterationHistoryArtifact,
    iterationHistoryLoading,
    iterationHistoryError,
    artifactLoading,
    artifactError,
    loading,
    actionLoading,
    error,
    lastRefreshedAt,
    currentEscalation,
    hasOpenEscalation,
    specAttachmentArtifact,
    resumeIntentArtifactSummary,
    currentSlice,
    currentSliceEscalation,
    currentIteration,
    iterationHistoryArtifactSummary,
    remainingSlices,
    activeIterationLabel,
    activeIterationDetail,
    autoRefreshEnabled,
    pauseWindowOpened,
    pausedForPlanning,
    pausedForExecution,
    canPlan,
    canExecuteNext,
    planActionLabel,
    executeActionLabel,
    planBlockedReason,
    executeBlockedReason,
    runAction,
  };
}
