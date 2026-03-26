import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  Link as LinkIcon,
  MoveLeft,
  type LucideIcon,
  MessageSquare,
  Play,
  Plus,
  Settings,
  Terminal,
  Upload,
  Workflow,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { ConnectionSettings } from './components/ConnectionSettings';
import { DecisionCard } from './components/DecisionCard';
import { OperatorAuthCard } from './components/OperatorAuthCard';
import { PushNotificationsCard } from './components/PushNotificationsCard';
import { PullToRefresh, triggerHaptic } from './components/NativeInteractions';
import { RunDetails } from './components/RunDetails';
import { StatusBadge } from './components/StatusBadge';
import { api } from './services/api';
import {
  DEFAULT_PUSH_STATUS,
  disablePushNotifications,
  enablePushNotifications,
  readPushNotificationStatus,
  type PushNotificationStatus,
} from './services/pushNotifications';
import {
  clearRuntimeConfig,
  getDefaultRuntimeConfig,
  type HarnessRuntimeConfig,
  isRuntimeConfigComplete,
  loadRecentEscalationIds,
  loadRuntimeConfig,
  rememberRecentEscalationId,
  saveRuntimeConfig,
} from './services/runtimeConfig';
import {
  type ArtifactContent,
  type ArtifactSummary,
  type Escalation,
  type EscalationResponseInput,
  type Run,
  type RunCreateInput,
  type RunEvent,
  type RunReportResponse,
  type Slice,
} from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SPEC_SOFT_WARNING_CHARS = 20000;
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

function formatPausedOperation(operation: string | null | undefined) {
  switch (operation) {
    case 'create_plan':
      return 'Create Plan';
    case 'review_plan':
      return 'Review Plan';
    case 'reconcile_plan':
      return 'Reconcile Plan';
    case 'generate_slices':
      return 'Generate Slices';
    case 'implement_slice':
      return 'Implement Slice';
    case 'review_slice':
      return 'Review Slice';
    case 'fix_slice':
      return 'Repair Slice';
    default:
      return operation ?? 'Unknown Step';
  }
}

function buildEscalationRoute(escalationId: string, fromRunId?: string | null) {
  const normalizedId = escalationId.trim();
  if (!normalizedId) {
    return '';
  }
  if (!fromRunId?.trim()) {
    return `/escalation/${normalizedId}`;
  }
  return `/escalation/${normalizedId}?fromRun=${encodeURIComponent(fromRunId.trim())}`;
}

interface DashboardProps {
  config: HarnessRuntimeConfig;
  authenticated: boolean;
  pushStatus: PushNotificationStatus;
  runs: Run[];
  runsLoading: boolean;
  runsError: string | null;
  recentEscalationIds: string[];
  onOpenEscalation: (target: string) => void;
  onOpenRun: (id: string) => void;
  onRefresh: () => Promise<void>;
  onCreateRun: (payload: RunCreateInput) => Promise<void>;
  onSaveApiBaseUrl: (apiBaseUrl: string) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

function Dashboard({
  config,
  authenticated,
  pushStatus,
  runs,
  runsLoading,
  runsError,
  recentEscalationIds,
  onOpenEscalation,
  onOpenRun,
  onRefresh,
  onCreateRun,
  onSaveApiBaseUrl,
  onLogin,
  onLogout,
}: DashboardProps) {
  const [manualEscalationId, setManualEscalationId] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [specText, setSpecText] = useState('');
  const [specAttachmentName, setSpecAttachmentName] = useState('');
  const [specAttachmentContent, setSpecAttachmentContent] = useState('');
  const [specImportMode, setSpecImportMode] = useState<'replace' | 'append' | 'attach'>('replace');
  const [creatingRun, setCreatingRun] = useState(false);
  const [createRunError, setCreateRunError] = useState<string | null>(null);
  const [specImportError, setSpecImportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'runs' | 'new_run' | 'settings'>('runs');
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const specCharacterCount = specText.length;
  const specLineCount = specText.length === 0 ? 0 : specText.split(/\r?\n/).length;
  const attachmentCharacterCount = specAttachmentContent.length;
  const attachmentLineCount =
    specAttachmentContent.length === 0 ? 0 : specAttachmentContent.split(/\r?\n/).length;
  const showSpecSoftWarning = specCharacterCount > SPEC_SOFT_WARNING_CHARS;

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const importedText = await file.text();
      if (specImportMode === 'attach') {
        setSpecAttachmentName(file.name || 'spec_attachment.md');
        setSpecAttachmentContent(importedText);
      } else {
        setSpecText((current) => {
          if (specImportMode === 'append' && current.trim()) {
            return `${current.trimEnd()}\n\n${importedText.trim()}`;
          }
          return importedText;
        });
      }
      setSpecImportError(null);
    } catch (error) {
      setSpecImportError(
        error instanceof Error ? error.message : 'Failed to read the selected outline file.',
      );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PullToRefresh onRefresh={onRefresh} />

      <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden mt-4">
        <button 
          onClick={() => setShowSessionInfo(!showSessionInfo)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-container-high transition-colors"
        >
          <div className="flex items-center gap-3">
             <div className="flex flex-col">
               <span className="font-headline font-bold text-sm">Session Context</span>
               <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                  {authenticated ? `Signed in as ${config.username}` : 'Not signed in'}
               </span>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex flex-wrap items-center gap-2 hidden sm:flex">
               <StatusBadge status={authenticated ? 'connected' : 'configuration required'} />
             </div>
             <ChevronDown className={cn("w-5 h-5 text-on-surface-variant transition-transform", showSessionInfo && "rotate-180")} />
          </div>
        </button>

        <AnimatePresence>
          {showSessionInfo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-outline-variant/5"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/10">
                  <div className="flex items-center gap-3 mb-3">
                    <LinkIcon className="w-5 h-5 text-primary" />
                    <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Backend
                    </span>
                  </div>
                  <p className="font-mono text-xs break-all text-on-surface">
                    {config.apiBaseUrl || 'Not configured'}
                  </p>
                </div>

                <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/10">
                  <div className="flex items-center gap-3 mb-3">
                    <KeyRound className="w-5 h-5 text-secondary" />
                    <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Operator Session
                    </span>
                  </div>
                  <p className="text-sm text-on-surface">
                    {authenticated ? `Signed in as ${config.username}.` : 'Sign in required before use.'}
                  </p>
                </div>

                <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/10">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageSquare className="w-5 h-5 text-tertiary" />
                    <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Active Runs
                    </span>
                  </div>
                  <p className="text-sm text-on-surface">
                    {runsLoading ? 'Refreshing job list' : `${runs.length} tracked run${runs.length === 1 ? '' : 's'}`}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {pushStatus.registeredDevices} active device
                    {pushStatus.registeredDevices === 1 ? '' : 's'} with push delivery
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 border-b border-outline-variant/10 pb-px overflow-x-auto custom-scrollbar">
        <button onClick={() => setActiveTab('runs')} className={cn("whitespace-nowrap px-4 py-2 font-label text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'runs' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface')}>Tracked Runs</button>
        <button onClick={() => setActiveTab('new_run')} className={cn("whitespace-nowrap px-4 py-2 font-label text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'new_run' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface')}>Create Run</button>
        <button onClick={() => setActiveTab('settings')} className={cn("whitespace-nowrap px-4 py-2 font-label text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface')}>Tools & Config</button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'new_run' && (
          <div className="bg-surface-container rounded-xl border border-outline-variant/10 p-6 space-y-4">
            <div>
              <h2 className="font-headline text-xl font-bold">Start Run</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Create a new governed run directly from this device.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
          <input
            type="text"
            value={repoPath}
            onChange={(event) => setRepoPath(event.target.value)}
            placeholder="/srv/harness/repos/example-repo"
            className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
          <input
            type="text"
            value={baseBranch}
            onChange={(event) => setBaseBranch(event.target.value)}
            placeholder="main"
            className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
          <textarea
            value={specText}
            onChange={(event) => setSpecText(event.target.value)}
            placeholder="Describe the change the harness should deliver, or paste a detailed plan outline."
            rows={12}
            className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt,text/plain"
            className="hidden"
            onChange={(event) => {
              void handleImportFile(event);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <div className="space-y-1">
              <p className="text-xs text-on-surface">
                {specCharacterCount.toLocaleString()} characters · {specLineCount.toLocaleString()} lines
              </p>
              <p className="text-xs text-on-surface-variant">
                No hard app-side limit today. Large outlines are allowed, but very large prompts can reduce planning quality.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSpecImportMode('replace');
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
              >
                <Upload className="h-4 w-4" />
                Replace from File
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpecImportMode('append');
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
              >
                <FileText className="h-4 w-4" />
                Append File
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpecImportMode('attach');
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
              >
                <Upload className="h-4 w-4" />
                Attach File
              </button>
            </div>
          </div>
          {specAttachmentContent && (
            <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-on-surface">
                    {specAttachmentName || 'spec_attachment.md'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Optional planning attachment · {attachmentCharacterCount.toLocaleString()} characters · {attachmentLineCount.toLocaleString()} lines
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSpecAttachmentName('');
                    setSpecAttachmentContent('');
                  }}
                  className="rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
                >
                  Clear Attachment
                </button>
              </div>
            </div>
          )}
        </div>
        {specImportError && (
          <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {specImportError}
          </div>
        )}
        {showSpecSoftWarning && (
          <div className="rounded-lg border border-tertiary/20 bg-tertiary/10 px-4 py-3 text-sm text-tertiary">
            This spec is over {SPEC_SOFT_WARNING_CHARS.toLocaleString()} characters. It should still save, but plan generation may benefit from a tighter outline or a later dedicated attachment flow.
          </div>
        )}
        {createRunError && (
          <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {createRunError}
          </div>
        )}
        <button
          type="button"
          disabled={!authenticated || creatingRun || !repoPath.trim() || !specText.trim()}
          onClick={() => {
            void (async () => {
              setCreatingRun(true);
              setCreateRunError(null);
              try {
                await onCreateRun({
                  repo_path: repoPath.trim(),
                  base_branch: baseBranch.trim() || 'main',
                  spec_text: specText.trim(),
                  spec_attachment_name: specAttachmentContent
                    ? specAttachmentName || 'spec_attachment.md'
                    : undefined,
                  spec_attachment_content: specAttachmentContent || undefined,
                  policy_pack: 'default',
                });
                setSpecText('');
                setSpecAttachmentName('');
                setSpecAttachmentContent('');
              } catch (error) {
                setCreateRunError(
                  error instanceof Error ? error.message : 'Failed to create run.',
                );
              } finally {
                setCreatingRun(false);
              }
            })();
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creatingRun ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create Run
        </button>
      </div>
        )}

        {activeTab === 'runs' && (
          <div className="bg-surface-container rounded-xl border border-outline-variant/10 p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-headline text-xl font-bold">Runs</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Track current status and open a run console for details and control actions.
                </p>
              </div>
            </div>
            {runsError && (
              <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                {runsError}
              </div>
            )}
            {runs.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                {authenticated ? 'No runs yet.' : 'Sign in first to load runs.'}
              </p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <button
                    key={run.run_id}
                    onClick={() => onOpenRun(run.run_id)}
                    className="w-full rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-headline text-lg font-bold text-on-surface">
                            {run.repo_name}
                          </span>
                          <StatusBadge status={run.status} />
                          {run.baseline_status && <StatusBadge status={run.baseline_status} />}
                        </div>
                        <p className="text-sm text-on-surface-variant line-clamp-2">{run.spec_text}</p>
                        <p className="font-mono text-[11px] text-on-surface-variant">
                          {run.run_id} · slot {run.concurrency_slot ?? '-'}
                        </p>
                      </div>
                      <span className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                        {new Date(run.updated_at).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
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
                  onChange={(event) => setManualEscalationId(event.target.value)}
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

            <ConnectionSettings
              initialApiBaseUrl={config.apiBaseUrl}
              onSave={onSaveApiBaseUrl}
            />
            <OperatorAuthCard
              authenticated={authenticated}
              username={config.username}
              onLogin={onLogin}
              onLogout={onLogout}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatEventTypeLabel(eventType: string) {
  return eventType.replace(/_/g, ' ');
}

function readStringDetail(
  details: Record<string, unknown>,
  key: string,
): string | null {
  const value = details[key];
  return typeof value === 'string' ? value : null;
}

function readNumberDetail(
  details: Record<string, unknown>,
  key: string,
): number | null {
  const value = details[key];
  return typeof value === 'number' ? value : null;
}

function readStringArrayDetail(
  details: Record<string, unknown>,
  key: string,
): string[] {
  const value = details[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

interface IterationDetails {
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
  if (!event.event_type.startsWith('slice_iteration_')) {
    return null;
  }
  return {
    sliceId: readStringDetail(event.details, 'slice_id'),
    iterationNumber: readNumberDetail(event.details, 'iteration_number'),
    maxIterations: readNumberDetail(event.details, 'max_iterations'),
    generatorOperation: readStringDetail(event.details, 'generator_operation'),
    generatorAgent: readStringDetail(event.details, 'generator_agent'),
    verificationReasons: readStringArrayDetail(event.details, 'verification_reasons'),
    rubricFloorFailures: readStringArrayDetail(event.details, 'rubric_floor_failures'),
    eventType: event.event_type,
  };
}

function latestIterationForSlice(events: RunEvent[], sliceId: string | null): IterationDetails | null {
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
  const details = event.details;
  const badges: string[] = [];

  if (event.status) {
    badges.push(event.status);
  }

  const sliceId = readStringDetail(details, 'slice_id');
  if (sliceId) {
    badges.push(`slice ${sliceId}`);
  }

  const pausedAgent = readStringDetail(details, 'paused_agent');
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
    badges.push(
      maxIterations ? `iter ${iterationNumber}/${maxIterations}` : `iter ${iterationNumber}`,
    );
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
  const details = event.details;
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
    lines.push(
      `${amendmentCount} recommended amendment${amendmentCount === 1 ? '' : 's'} from review`,
    );
  }

  const sliceCount = readNumberDetail(details, 'slice_count');
  if (typeof sliceCount === 'number') {
    lines.push(`${sliceCount} slice${sliceCount === 1 ? '' : 's'} ready`);
  }

  const repairAttemptsUsed = readNumberDetail(details, 'repair_attempts_used');
  if (typeof repairAttemptsUsed === 'number') {
    lines.push(
      `${repairAttemptsUsed} repair attempt${repairAttemptsUsed === 1 ? '' : 's'} used`,
    );
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
  if (title && event.event_type === 'slice_execution_started') {
    lines.push(title);
  }

  return lines;
}

function RunEventTimeline({ events }: { events: RunEvent[] }) {
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
            className={cn('rounded-xl border px-4 py-4', eventCardClasses(event.event_type))}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={formatEventTypeLabel(event.event_type)} />
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
                      <p
                        key={`${event.event_id}:${line}`}
                        className="text-sm text-on-surface-variant"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                {new Date(event.created_at).toLocaleString()}
              </span>
            </div>
            {Object.keys(event.details).length > 0 && (
              <details className="mt-3 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Raw Event Details
                </summary>
                <pre className="mt-3 overflow-x-auto text-xs text-on-surface-variant">
                  {JSON.stringify(event.details, null, 2)}
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

interface ResumeIntentDetails {
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

interface SliceIterationView {
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

function parseResumeIntentArtifact(artifact: ArtifactContent): ResumeIntentDetails | null {
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
    sessionStrategy:
      typeof parsed.session_strategy === 'string' ? parsed.session_strategy : null,
    sessionId: typeof parsed.session_id === 'string' ? parsed.session_id : null,
    sliceId: typeof parsed.slice_id === 'string' ? parsed.slice_id : null,
    attemptNumber:
      typeof parsed.attempt_number === 'number' ? parsed.attempt_number : null,
    plannedFiles,
    schemaRootType: typeof schema?.type === 'string' ? schema.type : null,
    schemaFieldNames: readSchemaFieldNames(schema).slice(0, 8),
    contractNote:
      typeof parsed.resume_contract_note === 'string' ? parsed.resume_contract_note : null,
  };
}

function parseSliceIterationsArtifact(artifact: ArtifactContent): SliceIterationView[] | null {
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
        implementationSummary:
          typeof record.implementation_summary === 'string' ? record.implementation_summary : null,
        approved: typeof record.approved === 'boolean' ? record.approved : null,
        evaluationSummary:
          typeof record.evaluation_summary === 'string' ? record.evaluation_summary : null,
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
    return `${Object.keys(value as Record<string, unknown>).length} field${Object.keys(value as Record<string, unknown>).length === 1 ? '' : 's'}`;
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
          {
            label: 'Characters',
            value: formatArtifactValue(artifact.metadata.character_count),
          },
          {
            label: 'Lines',
            value: formatArtifactValue(artifact.metadata.line_count),
          },
        ]}
      />
    );
  }

  if (
    artifact.artifact_type === 'run_resume_intent' ||
    artifact.artifact_type === 'slice_resume_intent'
  ) {
    const resumeIntent = parseResumeIntentArtifact(artifact);
    if (resumeIntent) {
      return (
        <ArtifactSummaryGrid
          title="Resume Context"
          values={[
            { label: 'Agent', value: formatArtifactValue(resumeIntent.agent) },
            {
              label: 'Operation',
              value: resumeIntent.operation
                ? formatPausedOperation(resumeIntent.operation)
                : '-',
            },
            {
              label: 'Session strategy',
              value: formatArtifactValue(resumeIntent.sessionStrategy),
            },
            {
              label: 'Schema root',
              value: formatArtifactValue(resumeIntent.schemaRootType),
            },
            {
              label: 'Schema fields',
              value:
                resumeIntent.schemaFieldNames.length === 0
                  ? '-'
                  : resumeIntent.schemaFieldNames.join(', '),
            },
            {
              label: 'Workspace',
              value: formatArtifactValue(resumeIntent.workspacePath),
            },
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
      return (
        item &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).status === 'passed'
      );
    }).length;
    return (
      <ArtifactSummaryGrid
        title="Proof Summary"
        values={[
          {
            label: 'Proof runs',
            value: `${proofResults.length} result${proofResults.length === 1 ? '' : 's'}`,
          },
          {
            label: 'Passed',
            value: `${passedCount} passed`,
          },
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
          {
            label: 'Iteration count',
            value: formatArtifactValue(parsed.iteration_count),
          },
          {
            label: 'Approved',
            value: formatArtifactValue(parsed.approved),
          },
          {
            label: 'Final generator step',
            value: formatArtifactValue(parsed.final_generator_operation),
          },
          {
            label: 'Rubric floor misses',
            value: formatArtifactValue(parsed.rubric_floor_failure_count),
          },
          {
            label: 'Patch failures',
            value: formatArtifactValue(parsed.patch_failure_count),
          },
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
          {
            label: 'Iterations',
            value: `${iterations.length}`,
          },
          {
            label: 'Latest step',
            value: latest.generatorOperation
              ? formatPausedOperation(latest.generatorOperation)
              : '-',
          },
          {
            label: 'Latest verdict',
            value: latest.approved === null ? '-' : latest.approved ? 'approved' : 'rejected',
          },
          {
            label: 'Rubric blockers',
            value: `${latest.rubricFloorFailures.length}`,
          },
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

function pickLatestArtifactByType(
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
    artifact &&
    artifact.content_kind === 'text' &&
    artifact.content &&
    summarizeTextArtifact(artifact.content);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-on-surface">{title}</p>
            <StatusBadge status={artifactSummary.artifact_type} />
          </div>
          <p className="text-sm text-on-surface-variant">{subtitle}</p>
          <p className="font-mono text-[11px] break-all text-on-surface-variant">
            {artifactSummary.path}
          </p>
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
            {textPreview && (
              <p className="text-sm text-on-surface-variant line-clamp-3">{textPreview}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Artifact summary not loaded yet.</p>
        )}
      </div>
    </div>
  );
}

function KeyArtifactsSection({
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

function collectKeyArtifactIds(artifacts: ArtifactSummary[]): number[] {
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

function ResumeIntentCard({
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
                {resumeIntent.operation && (
                  <StatusBadge status={formatPausedOperation(resumeIntent.operation)} />
                )}
                {resumeIntent.sessionStrategy && (
                  <StatusBadge status={`session ${resumeIntent.sessionStrategy}`} />
                )}
                {resumeIntent.schemaRootType && (
                  <StatusBadge status={`schema ${resumeIntent.schemaRootType}`} />
                )}
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

function IterationHistorySection({
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
                    <p
                      key={`${iteration.iterationNumber}:verification:${reason}`}
                      className="text-sm text-on-surface-variant"
                    >
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
                    <p
                      key={`${iteration.iterationNumber}:rubric:${reason}`}
                      className="text-sm text-on-surface-variant"
                    >
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

function CurrentEscalationCard({
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

function SpecAttachmentCard({
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

function SliceList({ slices }: { slices: Slice[] }) {
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

function SliceCard({
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
  iteration?: IterationDetails | null;
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

function RunEscalationsList({
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

function ArtifactExplorer({
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
                isSelected
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-outline-variant/10 bg-surface-container-low',
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
              <p className="text-xs text-on-surface-variant">
                Content truncated for device display.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface EscalationViewProps {
  authenticated: boolean;
  onEscalationSeen: (id: string) => void;
}

function EscalationView({ authenticated, onEscalationSeen }: EscalationViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [escalation, setEscalation] = useState<Escalation | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<RunReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestedFromRunId = searchParams.get('fromRun');

  useEffect(() => {
    async function fetchData() {
      if (!id) {
        setError('Missing escalation ID.');
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

    fetchData();
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
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
          <Settings className="text-error w-6 h-6" />
        </div>
        <h3 className="font-headline text-xl font-bold text-error">Session Error</h3>
        <p className="text-on-surface-variant text-sm max-w-md text-center">
          {error || 'The requested escalation could not be found or is no longer active.'}
        </p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
      {relatedRunId && (
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-5 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <MoveLeft className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-headline text-xl font-bold text-on-surface">
                    Related Run
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Move from this escalation straight back into the run console.
                  </p>
                </div>
              </div>
              <p className="font-mono text-[11px] text-on-surface-variant">{relatedRunId}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/runs/${relatedRunId}`)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
            >
              <MoveLeft className="h-4 w-4" />
              {relatedRunActionLabel}
            </button>
          </div>
        </div>
      )}
      <RunDetails run={run} report={report} />
      <div className="max-w-2xl">
        <DecisionCard
          escalation={escalation}
          onRespond={handleRespond}
          successActions={
            relatedRunId ? (
              <button
                type="button"
                onClick={() => navigate(`/runs/${relatedRunId}`)}
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

function RunConsoleView({ authenticated }: { authenticated: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const loadRunConsole = useCallback(async (background = false) => {
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
  }, [authenticated, id]);

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
        setArtifactError(
          loadError instanceof Error ? loadError.message : 'Failed to load artifact.',
        );
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
              error:
                loadError instanceof Error ? loadError.message : 'Failed to load artifact summary.',
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
      setKeyArtifactLoadingIds((current) =>
        current.filter((artifactId) => !missingIds.includes(artifactId)),
      );
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
        setResumeIntentError(
          loadError instanceof Error ? loadError.message : 'Failed to load resume contract.',
        );
      } finally {
        setResumeIntentLoading(false);
      }
    }

    void loadResumeIntentArtifact();
  }, [id, resumeIntentArtifactSummary, selectedArtifact]);

  useEffect(() => {
    async function loadIterationHistoryArtifact() {
      if (
        !id ||
        iterationHistoryArtifactSummary?.artifact_id === null ||
        !iterationHistoryArtifactSummary
      ) {
        setIterationHistoryArtifact(null);
        setIterationHistoryError(null);
        setIterationHistoryLoading(false);
        return;
      }

      if (
        selectedArtifact &&
        selectedArtifact.artifact_id === iterationHistoryArtifactSummary.artifact_id
      ) {
        setIterationHistoryArtifact(selectedArtifact);
        setIterationHistoryError(null);
        setIterationHistoryLoading(false);
        return;
      }

      setIterationHistoryLoading(true);
      setIterationHistoryError(null);
      try {
        setIterationHistoryArtifact(
          await api.getRunArtifact(id, iterationHistoryArtifactSummary.artifact_id),
        );
      } catch (loadError) {
        setIterationHistoryArtifact(null);
        setIterationHistoryError(
          loadError instanceof Error ? loadError.message : 'Failed to load iteration history.',
        );
      } finally {
        setIterationHistoryLoading(false);
      }
    }

    void loadIterationHistoryArtifact();
  }, [id, iterationHistoryArtifactSummary, selectedArtifact]);

  const runAction = async (action: 'plan' | 'execute_next') => {
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
  };

  const openEscalationFromRun = useCallback((target: string) => {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) {
      return;
    }
    navigate(
      normalizedTarget.startsWith('/escalation/')
        ? normalizedTarget
        : buildEscalationRoute(normalizedTarget, run?.run_id ?? null),
    );
  }, [navigate, run?.run_id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          Loading run...
        </span>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
          <Settings className="text-error w-6 h-6" />
        </div>
        <h3 className="font-headline text-xl font-bold text-error">Run Error</h3>
        <p className="text-on-surface-variant text-sm max-w-md text-center">
          {error || 'The requested run could not be loaded.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <RunDetails
        run={run}
        report={report}
        activeIterationLabel={activeIterationLabel}
        activeIterationDetail={activeIterationDetail}
      />
      <SpecAttachmentCard
        attachment={specAttachmentArtifact}
        onInspect={(artifactId) => setSelectedArtifactId(artifactId)}
      />
      <CurrentEscalationCard
        escalation={currentEscalation}
        runId={run.run_id}
        onOpenEscalation={openEscalationFromRun}
      />
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
                  {run.paused_slice_id && <span>Slice {run.paused_slice_id}</span>}
                  {typeof run.paused_attempt_number === 'number' && (
                    <span>Attempt {run.paused_attempt_number + 1}</span>
                  )}
                  {run.paused_session_strategy && (
                    <span>Session {run.paused_session_strategy}</span>
                  )}
                </div>
                {run.pause_reason && (
                  <p className="text-sm text-on-surface">{run.pause_reason}</p>
                )}
                {!pauseWindowOpened && run.resume_after && (
                  <p className="text-xs text-on-surface-variant">
                    Resume actions stay disabled until the provider window reopens.
                  </p>
                )}
              </div>
            </div>
          </div>
          <ResumeIntentCard
            artifactSummary={resumeIntentArtifactSummary}
            artifact={resumeIntentArtifact}
            loading={resumeIntentLoading}
            error={resumeIntentError}
            onInspect={(artifactId) => setSelectedArtifactId(artifactId)}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={autoRefreshEnabled ? 'live refresh' : 'manual refresh'} />
          {lastRefreshedAt && (
            <span className="text-xs text-on-surface-variant">
              Last refreshed {new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <button
              type="button"
              disabled={actionLoading || !canPlan}
              onClick={() => void runAction('plan')}
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
              onClick={() => void runAction('execute_next')}
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
      </div>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Slices</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Planned and executed work units for this run.
          </p>
        </div>
      {currentSlice && (
        <div className="space-y-3">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface">Current Slice</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                The slice currently in progress, blocked, or next in line.
              </p>
            </div>
            <SliceCard
              slice={currentSlice}
              pinned
              iteration={currentIteration}
              parentRunId={run.run_id}
              linkedEscalation={currentSliceEscalation}
              onOpenEscalation={openEscalationFromRun}
            />
          </div>
        )}
        <IterationHistorySection
          slice={currentSlice}
          artifactSummary={iterationHistoryArtifactSummary}
          artifact={iterationHistoryArtifact}
          loading={iterationHistoryLoading}
          error={iterationHistoryError}
          onInspect={(artifactId) => setSelectedArtifactId(artifactId)}
        />
        {remainingSlices.length > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="font-headline text-lg font-bold text-on-surface">All Slices</h3>
            </div>
            <SliceList slices={remainingSlices} />
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
          escalations={escalations}
          runId={run.run_id}
          onOpenEscalation={openEscalationFromRun}
        />
      </div>

      <KeyArtifactsSection
        artifacts={run.artifacts ?? []}
        loadedArtifacts={keyArtifacts}
        loadingIds={new Set(keyArtifactLoadingIds)}
        errors={keyArtifactErrors}
        onInspect={(artifactId) => setSelectedArtifactId(artifactId)}
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
          selectedArtifactId={selectedArtifactId}
          selectedArtifact={selectedArtifact}
          artifactLoading={artifactLoading}
          artifactError={artifactError}
          onOpenArtifact={(artifactId) => setSelectedArtifactId(artifactId)}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-headline text-xl font-bold">Run Timeline</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Structured progress events from the harness. Raw agent chat history is not exposed yet.
          </p>
        </div>
        <RunEventTimeline events={events} />
      </div>
    </div>
  );
}

interface SettingsViewProps {
  config: HarnessRuntimeConfig;
  authenticated: boolean;
  pushStatus: PushNotificationStatus;
  onSaveApiBaseUrl: (apiBaseUrl: string) => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onEnablePush: () => Promise<void>;
  onDisablePush: () => Promise<void>;
}

function SettingsView({
  config,
  authenticated,
  pushStatus,
  onSaveApiBaseUrl,
  onLogin,
  onLogout,
  onEnablePush,
  onDisablePush,
}: SettingsViewProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface mb-2">
          Settings
        </h1>
        <p className="text-on-surface-variant text-sm">
          Configure the backend URL for this device, then sign in as an operator.
        </p>
      </header>

      <ConnectionSettings
        initialApiBaseUrl={config.apiBaseUrl}
        onSave={onSaveApiBaseUrl}
      />
      <OperatorAuthCard
        authenticated={authenticated}
        username={config.username}
        onLogin={onLogin}
        onLogout={onLogout}
      />
      <PushNotificationsCard
        authenticated={authenticated}
        status={pushStatus}
        onEnable={onEnablePush}
        onDisable={onDisablePush}
      />
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        triggerHaptic('light');
        navigate(to);
      }}
      className={cn(
        'flex flex-col items-center justify-center p-2 transition-all active:scale-90 flex-1',
        active ? 'text-primary' : 'text-on-surface-variant hover:text-primary',
      )}
    >
      <div
        className={cn(
          'px-4 py-1 rounded-full transition-all mb-1',
          active ? 'bg-primary/10' : 'bg-transparent',
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-label uppercase tracking-[0.05em] text-[10px] font-medium">
        {label}
      </span>
    </button>
  );
}

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDeepLinkSim, setShowDeepLinkSim] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<HarnessRuntimeConfig>(loadRuntimeConfig());
  const [recentEscalationIds, setRecentEscalationIds] = useState<string[]>(loadRecentEscalationIds());
  const [pushStatus, setPushStatus] = useState<PushNotificationStatus>(DEFAULT_PUSH_STATUS);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);

  const authenticated = isRuntimeConfigComplete(runtimeConfig);
  const latestEscalationRoute = recentEscalationIds[0]
    ? `/escalation/${recentEscalationIds[0]}`
    : '/';

  const refreshRuns = useCallback(async () => {
    if (!isRuntimeConfigComplete(loadRuntimeConfig())) {
      setRuns([]);
      setRunsError(null);
      setRunsLoading(false);
      return;
    }

    setRunsLoading(true);
    setRunsError(null);
    try {
      setRuns(await api.listRuns());
    } catch (runError) {
      setRunsError(runError instanceof Error ? runError.message : 'Failed to load runs.');
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const syncCurrentOperator = useCallback(async () => {
    const currentConfig = loadRuntimeConfig();
    setRuntimeConfig(currentConfig);
    setRecentEscalationIds(loadRecentEscalationIds());

    if (!isRuntimeConfigComplete(currentConfig)) {
      return;
    }

    try {
      const current = await api.getCurrentOperatorSession();
      setRuntimeConfig(
        saveRuntimeConfig({
          ...currentConfig,
          username: current.operator.username,
        }),
      );
    } catch {
      const nextConfig = saveRuntimeConfig({
        apiBaseUrl: currentConfig.apiBaseUrl,
        sessionToken: '',
        username: '',
      });
      setRuntimeConfig(nextConfig);
    }
  }, []);

  useEffect(() => {
    void syncCurrentOperator();
  }, [syncCurrentOperator]);

  const refreshPushStatus = useCallback(async () => {
    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      const next = await readPushNotificationStatus(isRuntimeConfigComplete(loadRuntimeConfig()));
      setPushStatus({
        ...next,
        loading: false,
        error: null,
      });
    } catch (pushError) {
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error:
          pushError instanceof Error ? pushError.message : 'Failed to sync push notifications.',
      }));
    }
  }, []);

  useEffect(() => {
    void refreshPushStatus();
  }, [runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshPushStatus]);

  useEffect(() => {
    void refreshRuns();
  }, [runtimeConfig.apiBaseUrl, runtimeConfig.sessionToken, refreshRuns]);

  const handleSaveApiBaseUrl = useCallback((apiBaseUrl: string) => {
    const nextConfig = saveRuntimeConfig({
      ...loadRuntimeConfig(),
      apiBaseUrl,
    });
    setRuntimeConfig(nextConfig);
  }, []);

  const handleLogin = useCallback(async (username: string, password: string) => {
    const currentConfig = loadRuntimeConfig();
    if (!currentConfig.apiBaseUrl) {
      throw new Error('Missing backend URL. Save the backend URL first.');
    }

    const session = await api.createOperatorSession(currentConfig.apiBaseUrl, username, password);
    const nextConfig = saveRuntimeConfig({
      apiBaseUrl: currentConfig.apiBaseUrl,
      sessionToken: session.session_token,
      username: session.operator.username,
    });
    setRuntimeConfig(nextConfig);
  }, []);

  const handleLogout = useCallback(async () => {
    const currentConfig = loadRuntimeConfig();
    if (pushStatus.subscribed) {
      await disablePushNotifications();
    }
    if (currentConfig.sessionToken) {
      await api.revokeCurrentOperatorSession();
    }
    const nextConfig = saveRuntimeConfig({
      apiBaseUrl: currentConfig.apiBaseUrl,
      sessionToken: '',
      username: '',
    });
    setRuntimeConfig(nextConfig);
  }, [pushStatus.subscribed]);

  const handleEnablePush = useCallback(async () => {
    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      await enablePushNotifications();
      await refreshPushStatus();
    } catch (pushError) {
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error:
          pushError instanceof Error ? pushError.message : 'Failed to enable push delivery.',
      }));
    }
  }, [refreshPushStatus]);

  const handleDisablePush = useCallback(async () => {
    setPushStatus((current) => ({ ...current, loading: true, error: null }));
    try {
      await disablePushNotifications();
      await refreshPushStatus();
    } catch (pushError) {
      setPushStatus((current) => ({
        ...current,
        loading: false,
        error:
          pushError instanceof Error ? pushError.message : 'Failed to disable push delivery.',
      }));
    }
  }, [refreshPushStatus]);

  const handleEscalationSeen = useCallback((escalationId: string) => {
    setRecentEscalationIds(rememberRecentEscalationId(escalationId));
  }, []);

  const handleRefresh = useCallback(async () => {
    await syncCurrentOperator();
    await refreshRuns();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }, [refreshRuns, syncCurrentOperator]);

  const handleOpenEscalation = useCallback((escalationId: string) => {
    const normalizedTarget = escalationId.trim();
    if (!normalizedTarget) {
      return;
    }
    navigate(
      normalizedTarget.startsWith('/escalation/')
        ? normalizedTarget
        : buildEscalationRoute(normalizedTarget),
    );
  }, [navigate]);

  const handleOpenRun = useCallback((runId: string) => {
    const normalizedId = runId.trim();
    if (!normalizedId) {
      return;
    }
    navigate(`/runs/${normalizedId}`);
  }, [navigate]);

  const handleCreateRun = useCallback(async (payload: RunCreateInput) => {
    const created = await api.createRun(payload);
    await refreshRuns();
    navigate(`/runs/${created.run_id}`);
  }, [navigate, refreshRuns]);

  const content = (
    <div
      className={cn(
        'min-h-screen flex flex-col bg-surface transition-all duration-500',
        isMobilePreview
          ? 'max-w-[390px] mx-auto h-[844px] my-8 rounded-[3rem] border-[8px] border-surface-container-highest shadow-2xl overflow-hidden relative'
          : 'w-full',
      )}
    >
      <header
        className={cn(
          'bg-surface/80 backdrop-blur-md flex justify-between items-center px-6 py-4 w-full sticky top-0 z-40 border-b border-outline-variant/5',
          isMobilePreview && 'pt-10',
        )}
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center overflow-hidden">
            <Terminal className="text-primary w-5 h-5" />
          </div>
          <span className="font-headline tracking-tight font-bold text-xl tracking-tighter text-primary">
            Terminal
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowDeepLinkSim(!showDeepLinkSim)}
            className="text-on-surface-variant hover:bg-surface-container-high transition-colors p-2 rounded active:scale-95"
            title="Simulate Deep Link"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
          <div className="px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/20">
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              {authenticated ? runtimeConfig.username || 'Signed in' : 'Needs sign-in'}
            </span>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {showDeepLinkSim && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-surface-container-high p-4 rounded-xl border border-primary/20 shadow-2xl max-w-xs"
          >
            <h4 className="font-headline font-bold text-sm mb-2">Deep Link Simulator</h4>
            <p className="text-[10px] text-on-surface-variant mb-4 font-label uppercase tracking-widest">
              Opens the hash route used by the installed PWA.
            </p>
            <button
              onClick={() => {
                navigate('/escalation/esc_123');
                setShowDeepLinkSim(false);
              }}
              className="w-full bg-primary text-on-primary py-2 rounded font-label text-[10px] font-bold uppercase tracking-widest"
            >
              Trigger Escalation Link
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        className={cn(
          'flex-1 w-full px-4 sm:px-6 py-6 sm:py-8 pb-32 overflow-y-auto custom-scrollbar',
          !isMobilePreview && 'max-w-7xl mx-auto',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Routes location={location}>
              <Route
                path="/"
                element={
                  <Dashboard
                    config={runtimeConfig}
                    authenticated={authenticated}
                    pushStatus={pushStatus}
                    runs={runs}
                    runsLoading={runsLoading}
                    runsError={runsError}
                    recentEscalationIds={recentEscalationIds}
                    onOpenEscalation={handleOpenEscalation}
                    onOpenRun={handleOpenRun}
                    onRefresh={handleRefresh}
                    onCreateRun={handleCreateRun}
                    onSaveApiBaseUrl={handleSaveApiBaseUrl}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                  />
                }
              />
              <Route
                path="/runs/:id"
                element={<RunConsoleView authenticated={authenticated} />}
              />
              <Route
                path="/escalation/:id"
                element={
                  <EscalationView
                    authenticated={authenticated}
                    onEscalationSeen={handleEscalationSeen}
                  />
                }
              />
              <Route
                path="/settings"
                element={
                  <SettingsView
                    config={runtimeConfig}
                    authenticated={authenticated}
                    pushStatus={pushStatus}
                    onSaveApiBaseUrl={handleSaveApiBaseUrl}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    onEnablePush={handleEnablePush}
                    onDisablePush={handleDisablePush}
                  />
                }
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <nav
        className={cn(
          'fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pt-2 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/10 pb-8 sm:pb-4',
          isMobilePreview && 'absolute rounded-b-[2.5rem]',
        )}
      >
        <NavItem to="/" icon={LayoutDashboard} label="Home" active={location.pathname === '/'} />
        <NavItem
          to={latestEscalationRoute}
          icon={MessageSquare}
          label="Escalation"
          active={location.pathname.startsWith('/escalation')}
        />
        <NavItem
          to="/settings"
          icon={Settings}
          label="Settings"
          active={location.pathname === '/settings'}
        />
      </nav>

      {isMobilePreview && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-surface-container-highest rounded-b-2xl z-50" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col items-center">
      <div className="hidden lg:flex fixed top-4 left-4 z-[60] gap-2">
        <button
          onClick={() => setIsMobilePreview(!isMobilePreview)}
          className="bg-surface-container-highest text-on-surface px-4 py-2 rounded-full font-label text-[10px] font-bold uppercase tracking-widest border border-outline-variant/20 hover:bg-surface-bright transition-all"
        >
          {isMobilePreview ? 'Exit Mobile Preview' : 'Enter Mobile Preview'}
        </button>
      </div>
      {content}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <MainLayout />
    </Router>
  );
}
