import { useState } from 'react';
import {
  Activity,
  ArrowUpFromLine,
  Bug,
  Clock,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Globe2,
  Layers,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
  FolderGit2,
} from 'lucide-react';
import { Run, RunReportResponse } from '../types';
import { StatusBadge } from './StatusBadge';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function openExternalUrl(url: string) {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return;
  }
  const opened = window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  if (opened === null) {
    window.location.href = normalizedUrl;
  }
}

interface RunDetailsProps {
  run: Run;
  report: RunReportResponse | null;
  activeIterationLabel?: string | null;
  activeIterationDetail?: string | null;
}

function MetricPill({ icon: Icon, label, value, color }: { icon: any, label: string, value: string | number, color: 'primary' | 'secondary' | 'tertiary' }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
    tertiary: 'bg-tertiary/10 text-tertiary',
  };
  return (
    <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/5">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", colorMap[color])}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant">{label}:</span>
        <span className="font-headline font-bold text-xs">{value}</span>
      </div>
    </div>
  );
}

export function RunDetails({
  run,
  report,
  activeIterationLabel = null,
  activeIterationDetail = null,
}: RunDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-4 bg-surface-container p-4 rounded-xl border border-outline-variant/10">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center flex-shrink-0 mt-0.5">
            <Terminal className="text-primary w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline text-lg font-bold tracking-tight leading-none">
                {run.repo_name}
              </h2>
              <StatusBadge status={run.status} />
              {run.baseline_status && <StatusBadge status={run.baseline_status} />}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <GitBranch className="text-on-surface-variant w-3 h-3" />
                <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {run.base_branch}
                </span>
              </div>
              <span className="text-outline-variant text-[10px]">•</span>
              <span className="text-[10px] font-mono text-on-surface-variant">ID: {run.run_id}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Clock className="w-3 h-3" />
          <span className="font-label text-[9px] uppercase tracking-widest">
            {new Date(run.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/5">
        <MetricPill icon={Layers} label="Slices" value={`${report?.summary.pending_slices ?? '-'}/${report?.summary.total_slices ?? '-'}`} color="primary" />
        {activeIterationLabel && (
           <MetricPill icon={Activity} label="Iteration" value={activeIterationLabel} color="secondary" />
        )}
        <MetricPill icon={Layers} label="Total Iters" value={report?.summary.total_iterations ?? '-'} color="primary" />
        <MetricPill icon={AlertTriangle} label="Escalations" value={report?.summary.total_escalations ?? '-'} color="tertiary" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-outline-variant/5 bg-surface-container-low p-4">
          <div className="flex items-center gap-2">
            {run.intake_mode === 'remote' ? (
              <Globe2 className="h-4 w-4 text-primary" />
            ) : (
              <FolderGit2 className="h-4 w-4 text-primary" />
            )}
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Source
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <p className="text-sm text-on-surface">
              {run.intake_mode === 'remote'
                ? run.repo_url ?? `${run.repo_host ?? 'remote'} / ${run.repo_owner ?? '-'} / ${run.repo_slug ?? run.repo_name}`
                : run.repo_path}
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={run.intake_mode} />
              <StatusBadge status={run.clone_mode} />
              {run.repo_host && <StatusBadge status={run.repo_host} />}
              {run.repo_owner && <StatusBadge status={run.repo_owner} />}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/5 bg-surface-container-low p-4">
          <div className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-secondary" />
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Delivery
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {run.auto_deliver ? (
                <StatusBadge status="auto deliver" />
              ) : (
                <StatusBadge status="manual delivery" />
              )}
              {run.push_on_complete ? (
                <StatusBadge status="push enabled" />
              ) : (
                <StatusBadge status="local only" />
              )}
              {run.target_branch && <StatusBadge status={run.target_branch} />}
            </div>
            {report?.delivery ? (
              <div className="space-y-1 text-sm text-on-surface">
                <p className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-on-surface-variant" />
                  {report.delivery.branch_name}
                </p>
                <p className="flex items-center gap-2">
                  <GitCommitHorizontal className="h-4 w-4 text-on-surface-variant" />
                  <span className="font-mono text-xs">{report.delivery.commit_sha.slice(0, 12)}</span>
                </p>
                {report.delivery.remote_url_redacted && (
                  <p className="text-xs text-on-surface-variant break-all">
                    {report.delivery.remote_url_redacted}
                  </p>
                )}
                {report.delivery.push_error && (
                  <p className="text-xs text-error">{report.delivery.push_error}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">
                {run.auto_deliver
                  ? 'Delivery is configured but has not completed yet.'
                  : 'This run is not configured for automatic delivery.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {(run.issue_title || run.issue_body || run.feature_request_text) && (
        <div className="rounded-lg border border-outline-variant/5 bg-surface-container-low p-4">
          <div className="flex items-center gap-2">
            {run.feature_request_text ? (
              <Lightbulb className="h-4 w-4 text-tertiary" />
            ) : (
              <Bug className="h-4 w-4 text-tertiary" />
            )}
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Structured Request
            </span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {run.issue_title && <StatusBadge status="issue" />}
              {run.feature_request_text && <StatusBadge status="feature request" />}
            </div>
            {run.issue_title && (
              <p className="text-sm font-medium text-on-surface">{run.issue_title}</p>
            )}
            {run.issue_url && (
              <div className="space-y-2">
                <p className="text-xs break-all text-on-surface-variant">{run.issue_url}</p>
                <button
                  type="button"
                  onClick={() => openExternalUrl(run.issue_url ?? '')}
                  className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Issue
                </button>
              </div>
            )}
            {run.issue_body && (
              <p className="text-sm whitespace-pre-wrap text-on-surface-variant">{run.issue_body}</p>
            )}
            {run.feature_request_text && (
              <p className="text-sm whitespace-pre-wrap text-on-surface-variant">
                {run.feature_request_text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Spec */}
      <div>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left pt-2 pb-1 text-on-surface-variant hover:text-on-surface transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span className="font-label text-[10px] uppercase tracking-widest">Run Specification</span>
        </button>
        
        {isExpanded && (
          <div className="mt-2 bg-surface-container-low p-4 rounded-lg border border-outline-variant/5">
            <p className="text-on-surface-variant leading-relaxed text-sm whitespace-pre-wrap">
              {run.spec_text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
