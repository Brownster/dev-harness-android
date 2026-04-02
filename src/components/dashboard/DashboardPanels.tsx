import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  FileText,
  KeyRound,
  Link as LinkIcon,
  LoaderCircle,
  MessageSquare,
  Plus,
  Upload,
} from 'lucide-react';

import { StatusBadge } from '../StatusBadge';
import { cn } from '../../lib/cn';
import type { PushNotificationStatus } from '../../services/pushNotifications';
import type { HarnessRuntimeConfig } from '../../services/runtimeConfig';
import type { RepositoryOption, Run, RunCreateInput } from '../../types';

const SPEC_SOFT_WARNING_CHARS = 20000;

interface SessionContextPanelProps {
  config: HarnessRuntimeConfig;
  authenticated: boolean;
  pushStatus: PushNotificationStatus;
  runs: Run[];
  runsLoading: boolean;
}

export function SessionContextPanel({
  config,
  authenticated,
  pushStatus,
  runs,
  runsLoading,
}: SessionContextPanelProps) {
  const [showSessionInfo, setShowSessionInfo] = useState(false);

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden mt-4">
      <button
        onClick={() => setShowSessionInfo((current) => !current)}
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
          <ChevronDown
            className={cn(
              'w-5 h-5 text-on-surface-variant transition-transform',
              showSessionInfo && 'rotate-180',
            )}
          />
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
                  {authenticated
                    ? `Signed in as ${config.username}.`
                    : 'Sign in required before use.'}
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
                  {runsLoading
                    ? 'Refreshing job list'
                    : `${runs.length} tracked run${runs.length === 1 ? '' : 's'}`}
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
  );
}

interface RunCreationPanelProps {
  authenticated: boolean;
  repositories: RepositoryOption[];
  repositoriesLoading: boolean;
  repositoriesError: string | null;
  onCreateRun: (payload: RunCreateInput) => Promise<void>;
}

export function RunCreationPanel({
  authenticated,
  repositories,
  repositoriesLoading,
  repositoriesError,
  onCreateRun,
}: RunCreationPanelProps) {
  const [repoPath, setRepoPath] = useState('');
  const [useManualRepoPath, setUseManualRepoPath] = useState(false);
  const [baseBranch, setBaseBranch] = useState('main');
  const [specText, setSpecText] = useState('');
  const [specAttachmentName, setSpecAttachmentName] = useState('');
  const [specAttachmentContent, setSpecAttachmentContent] = useState('');
  const [specImportMode, setSpecImportMode] = useState<'replace' | 'append' | 'attach'>('replace');
  const [creatingRun, setCreatingRun] = useState(false);
  const [createRunError, setCreateRunError] = useState<string | null>(null);
  const [specImportError, setSpecImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const specCharacterCount = specText.length;
  const specLineCount = specText.length === 0 ? 0 : specText.split(/\r?\n/).length;
  const attachmentCharacterCount = specAttachmentContent.length;
  const attachmentLineCount =
    specAttachmentContent.length === 0 ? 0 : specAttachmentContent.split(/\r?\n/).length;
  const showSpecSoftWarning = specCharacterCount > SPEC_SOFT_WARNING_CHARS;
  const selectedRepository = repositories.find((repo) => repo.repo_path === repoPath) ?? null;
  const canUseRepoPicker = repositories.length > 0;

  useEffect(() => {
    if (useManualRepoPath || !canUseRepoPicker) {
      return;
    }
    if (!repoPath || !repositories.some((repo) => repo.repo_path === repoPath)) {
      setRepoPath(repositories[0]?.repo_path ?? '');
    }
  }, [canUseRepoPicker, repoPath, repositories, useManualRepoPath]);

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
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 p-6 space-y-4">
      <div>
        <h2 className="font-headline text-xl font-bold">Start Run</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Create a new governed run directly from this device.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-on-surface">Repository</p>
              <p className="text-xs text-on-surface-variant">
                Choose from approved repo roots or enter a path manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUseManualRepoPath((current) => !current)}
              className="rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
            >
              {canUseRepoPicker
                ? useManualRepoPath
                  ? 'Use Picker'
                  : 'Manual Path'
                : 'Manual Path'}
            </button>
          </div>
          {!useManualRepoPath && canUseRepoPicker ? (
            <div className="space-y-2">
              <select
                value={repoPath}
                onChange={(event) => setRepoPath(event.target.value)}
                className="w-full rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
              >
                <option value="">Select a repository</option>
                {repositories.map((repo) => (
                  <option key={repo.repo_path} value={repo.repo_path}>
                    {repo.relative_path}
                    {repo.current_branch ? ` · ${repo.current_branch}` : ''}
                  </option>
                ))}
              </select>
              {selectedRepository && (
                <p className="text-xs text-on-surface-variant">{selectedRepository.repo_path}</p>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={repoPath}
              onChange={(event) => setRepoPath(event.target.value)}
              placeholder="/srv/harness/repos/example-repo"
              className="rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
            />
          )}
          {repositoriesLoading && (
            <p className="text-xs text-on-surface-variant">Loading approved repositories…</p>
          )}
          {repositoriesError && <p className="text-xs text-error">{repositoriesError}</p>}
          {!repositoriesLoading && !canUseRepoPicker && !repositoriesError && (
            <p className="text-xs text-on-surface-variant">
              No approved repositories were returned by the backend. Manual path entry is still
              available.
            </p>
          )}
        </div>
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
              {specCharacterCount.toLocaleString()} characters · {specLineCount.toLocaleString()}{' '}
              lines
            </p>
            <p className="text-xs text-on-surface-variant">
              No hard app-side limit today. Large outlines are allowed, but very large prompts can
              reduce planning quality.
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
                  Optional planning attachment · {attachmentCharacterCount.toLocaleString()}{' '}
                  characters · {attachmentLineCount.toLocaleString()} lines
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
          This spec is over {SPEC_SOFT_WARNING_CHARS.toLocaleString()} characters. It should still
          save, but plan generation may benefit from a tighter outline or a later dedicated
          attachment flow.
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
              setCreateRunError(error instanceof Error ? error.message : 'Failed to create run.');
            } finally {
              setCreatingRun(false);
            }
          })();
        }}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {creatingRun ? (
          <LoaderCircle className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        Create Run
      </button>
    </div>
  );
}

interface RunsPanelProps {
  authenticated: boolean;
  runs: Run[];
  runsError: string | null;
  onOpenRun: (id: string) => void;
}

export function RunsPanel({ authenticated, runs, runsError, onOpenRun }: RunsPanelProps) {
  return (
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
  );
}
