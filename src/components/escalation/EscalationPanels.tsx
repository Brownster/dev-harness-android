import { motion } from 'motion/react';
import { MoveLeft, Settings } from 'lucide-react';

import { DecisionCard } from '../DecisionCard';
import { RunDetails } from '../RunDetails';
import { cn } from '../../lib/cn';
import type { Escalation, EscalationResponseInput, Run, RunReportResponse } from '../../types';

interface EscalationHubPanelProps {
  authenticated: boolean;
  manualEscalationId: string;
  recentEscalationIds: string[];
  onManualEscalationIdChange: (value: string) => void;
  onOpenEscalation: (target: string) => void;
}

export function EscalationHubPanel({
  authenticated,
  manualEscalationId,
  recentEscalationIds,
  onManualEscalationIdChange,
  onOpenEscalation,
}: EscalationHubPanelProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface mb-2">
          Escalations
        </h1>
        <p className="text-on-surface-variant text-sm">
          Open an escalation from a notification or jump back into one this device has already seen.
        </p>
      </header>

      <div className="bg-surface-container rounded-xl border border-outline-variant/10 p-6 space-y-4">
        <div>
          <h2 className="font-headline text-xl font-bold">Open Escalation</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Paste an escalation ID from a notification or open one of the recent IDs below.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={manualEscalationId}
            onChange={(event) => onManualEscalationIdChange(event.target.value)}
            placeholder="esc_123"
            className="flex-1 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
          <button
            onClick={() => onOpenEscalation(manualEscalationId)}
            disabled={!authenticated || !manualEscalationId.trim()}
            className={cn(
              'rounded-lg px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all',
              authenticated && manualEscalationId.trim()
                ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary active:scale-95'
                : 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed',
            )}
          >
            Open
          </button>
        </div>

        <div className="space-y-2">
          <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
            Recent
          </span>
          {recentEscalationIds.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              No escalation has been opened on this device yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recentEscalationIds.map((escalationId) => (
                <button
                  key={escalationId}
                  onClick={() => onOpenEscalation(escalationId)}
                  className="rounded-full border border-outline-variant/10 bg-surface-container-low px-3 py-2 font-mono text-xs text-on-surface"
                >
                  {escalationId}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface EscalationErrorPanelProps {
  error: string;
}

export function EscalationErrorPanel({ error }: EscalationErrorPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
        <Settings className="text-error w-6 h-6" />
      </div>
      <h3 className="font-headline text-xl font-bold text-error">Session Error</h3>
      <p className="text-on-surface-variant text-sm max-w-md text-center">
        {error}
      </p>
    </div>
  );
}

interface RelatedRunCardProps {
  relatedRunId: string;
  actionLabel: string;
  onOpenRun: () => void;
}

export function RelatedRunCard({
  relatedRunId,
  actionLabel,
  onOpenRun,
}: RelatedRunCardProps) {
  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <MoveLeft className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold text-on-surface">Related Run</h2>
              <p className="text-sm text-on-surface-variant">
                Move from this escalation straight back into the run console.
              </p>
            </div>
          </div>
          <p className="font-mono text-[11px] text-on-surface-variant">{relatedRunId}</p>
        </div>
        <button
          type="button"
          onClick={onOpenRun}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
        >
          <MoveLeft className="h-4 w-4" />
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

interface EscalationDetailPanelProps {
  escalation: Escalation;
  run: Run;
  report: RunReportResponse | null;
  relatedRunId: string | null;
  relatedRunActionLabel: string;
  onOpenRelatedRun: () => void;
  onRespond: (payload: EscalationResponseInput) => Promise<void>;
}

export function EscalationDetailPanel({
  escalation,
  run,
  report,
  relatedRunId,
  relatedRunActionLabel,
  onOpenRelatedRun,
  onRespond,
}: EscalationDetailPanelProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
      {relatedRunId && (
        <RelatedRunCard
          relatedRunId={relatedRunId}
          actionLabel={relatedRunActionLabel}
          onOpenRun={onOpenRelatedRun}
        />
      )}
      <RunDetails run={run} report={report} />
      <div className="max-w-2xl">
        <DecisionCard
          escalation={escalation}
          onRespond={onRespond}
          successActions={
            relatedRunId ? (
              <button
                type="button"
                onClick={onOpenRelatedRun}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
              >
                <MoveLeft className="h-4 w-4" />
                {relatedRunActionLabel}
              </button>
            ) : null
          }
        />
      </div>
    </motion.div>
  );
}
