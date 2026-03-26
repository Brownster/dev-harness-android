import { useState } from 'react';
import { Activity, Clock, GitBranch, Terminal, Layers, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Run, RunReportResponse } from '../types';
import { StatusBadge } from './StatusBadge';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
