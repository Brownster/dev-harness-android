import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Settings } from 'lucide-react';

import {
  EscalationDetailPanel,
  EscalationErrorPanel,
  EscalationHubPanel,
} from '../components/escalation/EscalationPanels';
import { api } from '../services/api';
import type { Escalation, EscalationResponseInput, Run, RunReportResponse } from '../types';

interface EscalationViewProps {
  authenticated: boolean;
  recentEscalationIds: string[];
  onEscalationSeen: (id: string) => void;
  onOpenEscalation: (target: string) => void;
}

export function EscalationView({
  authenticated,
  recentEscalationIds,
  onEscalationSeen,
  onOpenEscalation,
}: EscalationViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [manualEscalationId, setManualEscalationId] = useState('');
  const [escalation, setEscalation] = useState<Escalation | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<RunReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedFromRunId = searchParams.get('fromRun');

  useEffect(() => {
    async function fetchData() {
      if (!id) {
        setEscalation(null);
        setRun(null);
        setReport(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (!authenticated) {
        setError('Configure the backend URL and sign in first.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const esc = await api.getEscalation(id);
        setEscalation(esc);
        onEscalationSeen(esc.escalation_id);

        const runResponse = await api.getRun(esc.run_id);
        setRun(runResponse);

        try {
          const reportResponse = await api.getRunReport(esc.run_id);
          setReport(reportResponse);
        } catch (reportError) {
          console.warn('Could not fetch run report, proceeding without it', reportError);
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load escalation.');
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [authenticated, id, onEscalationSeen]);

  const handleRespond = async (payload: EscalationResponseInput) => {
    if (!id) {
      return;
    }
    await api.respondToEscalation(id, payload);
  };

  const relatedRunId = requestedFromRunId?.trim() || escalation?.run_id || run?.run_id || null;
  const relatedRunActionLabel =
    relatedRunId && requestedFromRunId?.trim() === relatedRunId
      ? 'Return to Run'
      : 'Open Related Run';

  if (!id) {
    return (
      <EscalationHubPanel
        authenticated={authenticated}
        manualEscalationId={manualEscalationId}
        recentEscalationIds={recentEscalationIds}
        onManualEscalationIdChange={setManualEscalationId}
        onOpenEscalation={onOpenEscalation}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Loading escalation...
        </span>
      </div>
    );
  }

  if (error || !escalation || !run) {
    return (
      <EscalationErrorPanel
        error={error || 'The requested escalation could not be found or is no longer active.'}
      />
    );
  }

  return (
    <EscalationDetailPanel
      escalation={escalation}
      run={run}
      report={report}
      relatedRunId={relatedRunId}
      relatedRunActionLabel={relatedRunActionLabel}
      onOpenRelatedRun={() => {
        if (relatedRunId) {
          navigate(`/runs/${relatedRunId}`);
        }
      }}
      onRespond={handleRespond}
    />
  );
}
