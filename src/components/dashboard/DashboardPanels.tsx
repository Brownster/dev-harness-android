import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bug,
  ChevronDown,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe2,
  KeyRound,
  Lightbulb,
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
import type {
  RepositoryOption,
  RepositoryPolicy,
  Run,
  RunCreateInput,
  RunDeliverySummary,
} from '../../types';

const SPEC_SOFT_WARNING_CHARS = 20000;

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

interface NormalizedRemoteRepoUrl {
  normalizedUrl: string;
  changed: boolean;
  error: string | null;
  hint: string | null;
  host: string | null;
  owner: string | null;
  repo: string | null;
  issueNumber: string | null;
}

function normalizeRemoteRepoUrl(rawValue: string): NormalizedRemoteRepoUrl {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return {
      normalizedUrl: '',
      changed: false,
      error: null,
      hint: 'Supported formats: https://host/owner/repo(.git) or git@host:owner/repo.git',
      host: null,
      owner: null,
      repo: null,
      issueNumber: null,
    };
  }

  if (trimmed.includes('://')) {
    try {
      const parsed = new URL(trimmed);
      const cleanedPath = parsed.pathname.replace(/\/+$/, '');
      const parts = cleanedPath.split('/').filter(Boolean);
      if (parts.length < 2) {
        return {
          normalizedUrl: trimmed,
          changed: false,
          error: 'Remote URL must include host, owner, and repository.',
          hint: null,
          host: parsed.hostname || null,
          owner: null,
          repo: null,
          issueNumber: null,
        };
      }

      let normalizedPath = `/${parts[0]}/${parts[1]}`;
      if (parts[1].endsWith('.git')) {
        normalizedPath = `/${parts[0]}/${parts[1]}`;
      } else if (cleanedPath.endsWith('.git')) {
        normalizedPath = `/${parts[0]}/${parts[1]}.git`;
      }

      const hadExtraSegments = parts.length > 2;
      const normalizedUrl = `${parsed.protocol}//${parsed.host}${normalizedPath}`;
      const isGitHubLike = (parsed.hostname || '').toLowerCase() === 'github.com';
      const issueNumber =
        isGitHubLike && parts[2] === 'issues' && parts[3] && /^\d+$/.test(parts[3])
          ? parts[3]
          : null;
      return {
        normalizedUrl,
        changed: normalizedUrl !== trimmed,
        error: null,
        hint: hadExtraSegments
          ? 'Extra path segments were removed. The harness clones the repository root, not issue, tree, or blob URLs.'
          : parsed.search || parsed.hash
            ? 'Query parameters and fragments are ignored for repository cloning.'
            : null,
        host: parsed.hostname || null,
        owner: parts[0] ?? null,
        repo: parts[1]?.replace(/\.git$/, '') ?? null,
        issueNumber,
      };
    } catch {
      return {
        normalizedUrl: trimmed,
        changed: false,
        error: 'This does not look like a valid remote repository URL.',
        hint: null,
        host: null,
        owner: null,
        repo: null,
        issueNumber: null,
      };
    }
  }

  if (trimmed.includes('@') && trimmed.includes(':')) {
    const [, path = ''] = trimmed.split(':', 2);
    const parts = path.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length < 2) {
      return {
        normalizedUrl: trimmed,
        changed: false,
        error: 'SSH repository URLs must include owner and repository.',
        hint: 'Example: git@github.com:owner/repo.git',
        host: null,
        owner: null,
        repo: null,
        issueNumber: null,
      };
    }
    const normalizedRepo = parts.slice(0, 2).join('/');
    const normalizedUrl = trimmed.replace(path, normalizedRepo.endsWith('.git') ? normalizedRepo : `${normalizedRepo}.git`);
    const host = trimmed.split('@')[1]?.split(':')[0] ?? null;
    return {
      normalizedUrl,
      changed: normalizedUrl !== trimmed,
      error: null,
      hint:
        parts.length > 2
          ? 'Extra path segments were removed. Use the repository SSH URL, not a file or branch URL.'
          : null,
      host,
      owner: parts[0] ?? null,
      repo: parts[1]?.replace(/\.git$/, '') ?? null,
      issueNumber: null,
    };
  }

  return {
    normalizedUrl: trimmed,
    changed: false,
    error: 'Unsupported remote URL format.',
    hint: 'Use an HTTPS clone URL or SSH clone URL.',
    host: null,
    owner: null,
    repo: null,
    issueNumber: null,
  };
}

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
  repositoryPolicy: RepositoryPolicy | null;
  repositoriesLoading: boolean;
  repositoriesError: string | null;
  onCreateRun: (payload: RunCreateInput) => Promise<void>;
}

export function RunCreationPanel({
  authenticated,
  repositories,
  repositoryPolicy,
  repositoriesLoading,
  repositoriesError,
  onCreateRun,
}: RunCreationPanelProps) {
  const [sourceMode, setSourceMode] = useState<'local' | 'remote'>('local');
  const [requestMode, setRequestMode] = useState<'spec' | 'issue' | 'feature'>('spec');
  const [repoPath, setRepoPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [useManualRepoPath, setUseManualRepoPath] = useState(false);
  const [baseBranch, setBaseBranch] = useState('main');
  const [specText, setSpecText] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [featureRequestText, setFeatureRequestText] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [autoDeliver, setAutoDeliver] = useState(false);
  const [pushOnComplete, setPushOnComplete] = useState(false);
  const [deliveryRemoteName, setDeliveryRemoteName] = useState('origin');
  const [specAttachmentName, setSpecAttachmentName] = useState('');
  const [specAttachmentContent, setSpecAttachmentContent] = useState('');
  const [specImportMode, setSpecImportMode] = useState<'replace' | 'append' | 'attach'>('replace');
  const [creatingRun, setCreatingRun] = useState(false);
  const [createRunError, setCreateRunError] = useState<string | null>(null);
  const [specImportError, setSpecImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const attachmentCharacterCount = specAttachmentContent.length;
  const attachmentLineCount =
    specAttachmentContent.length === 0 ? 0 : specAttachmentContent.split(/\r?\n/).length;
  const selectedRepository = repositories.find((repo) => repo.repo_path === repoPath) ?? null;
  const canUseRepoPicker = repositories.length > 0;
  const selectedSourceValue = sourceMode === 'remote' ? repoUrl.trim() : repoPath.trim();
  const normalizedRemoteRepo = normalizeRemoteRepoUrl(repoUrl);
  const effectiveRemoteRepoUrl = normalizedRemoteRepo.normalizedUrl || repoUrl.trim();
  const effectiveSpecText = (() => {
    const trimmedSpec = specText.trim();
    if (trimmedSpec) {
      return trimmedSpec;
    }
    if (requestMode === 'issue') {
      const trimmedTitle = issueTitle.trim();
      const trimmedBody = issueBody.trim();
      if (trimmedTitle || trimmedBody) {
        return [
          trimmedTitle ? `Resolve issue: ${trimmedTitle}` : 'Resolve issue',
          trimmedBody,
        ]
          .filter(Boolean)
          .join('\n\n');
      }
    }
    if (requestMode === 'feature') {
      const trimmedFeature = featureRequestText.trim();
      if (trimmedFeature) {
        return `Deliver feature request:\n\n${trimmedFeature}`;
      }
    }
    return '';
  })();
  const effectiveSpecCharacterCount = effectiveSpecText.length;
  const effectiveSpecLineCount =
    effectiveSpecText.length === 0 ? 0 : effectiveSpecText.split(/\r?\n/).length;
  const showSpecSoftWarning = effectiveSpecCharacterCount > SPEC_SOFT_WARNING_CHARS;
  const detectedRepoSlug =
    normalizedRemoteRepo.owner && normalizedRemoteRepo.repo
      ? `${normalizedRemoteRepo.owner}/${normalizedRemoteRepo.repo}`
      : null;
  const canCreateRun =
    authenticated &&
    !creatingRun &&
    Boolean(selectedSourceValue) &&
    Boolean(effectiveSpecText) &&
    !(sourceMode === 'remote' && Boolean(normalizedRemoteRepo.error));

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

  const handleCreateRunSubmit = async () => {
    setCreatingRun(true);
    setCreateRunError(null);
    try {
      await onCreateRun({
        repo_path: sourceMode === 'local' ? repoPath.trim() : undefined,
        repo_url: sourceMode === 'remote' ? effectiveRemoteRepoUrl : undefined,
        base_branch: baseBranch.trim() || 'main',
        spec_text: effectiveSpecText,
        issue_title: requestMode === 'issue' ? issueTitle.trim() || undefined : undefined,
        issue_url:
          requestMode === 'issue' && normalizedRemoteRepo.issueNumber
            ? repoUrl.trim() || undefined
            : undefined,
        issue_body: requestMode === 'issue' ? issueBody.trim() || undefined : undefined,
        feature_request_text:
          requestMode === 'feature' ? featureRequestText.trim() || undefined : undefined,
        target_branch: targetBranch.trim() || undefined,
        auto_deliver: autoDeliver,
        push_on_complete: autoDeliver ? pushOnComplete : false,
        delivery_remote_name: deliveryRemoteName.trim() || 'origin',
        spec_attachment_name: specAttachmentContent
          ? specAttachmentName || 'spec_attachment.md'
          : undefined,
        spec_attachment_content: specAttachmentContent || undefined,
        policy_pack: 'default',
      });
      setSpecText('');
      setIssueTitle('');
      setIssueBody('');
      setFeatureRequestText('');
      setRepoUrl('');
      setSpecAttachmentName('');
      setSpecAttachmentContent('');
    } catch (error) {
      setCreateRunError(error instanceof Error ? error.message : 'Failed to create run.');
    } finally {
      setCreatingRun(false);
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
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 sm:hidden rounded-xl border border-outline-variant/10 bg-surface/95 backdrop-blur px-3 py-3 shadow-lg shadow-primary/10">
        <button
          type="button"
          data-testid="create-run-submit"
          disabled={!canCreateRun}
          onClick={() => {
            void handleCreateRunSubmit();
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creatingRun ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Run
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-on-surface">Repository Source</p>
              <p className="text-xs text-on-surface-variant">
                Start from an approved local checkout or a policy-allowed remote git URL.
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-outline-variant/10 bg-surface p-1">
              <button
                type="button"
                onClick={() => setSourceMode('local')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
                  sourceMode === 'local'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface',
                )}
              >
                <FolderGit2 className="h-4 w-4" />
                Local
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('remote')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors',
                  sourceMode === 'remote'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface',
                )}
              >
                <Globe2 className="h-4 w-4" />
                Remote URL
              </button>
            </div>
          </div>
          {sourceMode === 'local' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-on-surface">Local Repository</p>
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
                  placeholder="/home/marc/Documents/github/example-repo"
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
          ) : (
            <div className="space-y-2">
              <input
                type="url"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/example/project.git"
                className="rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
              />
              {normalizedRemoteRepo.changed && !normalizedRemoteRepo.error && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-on-surface">
                  Normalized to <span className="font-mono">{normalizedRemoteRepo.normalizedUrl}</span>
                </div>
              )}
              {normalizedRemoteRepo.error && (
                <div className="rounded-lg border border-error/20 bg-error/10 px-3 py-2 text-xs text-error">
                  {normalizedRemoteRepo.error}
                </div>
              )}
              {normalizedRemoteRepo.hint && !normalizedRemoteRepo.error && (
                <p className="text-xs text-on-surface-variant">{normalizedRemoteRepo.hint}</p>
              )}
              {repositoryPolicy && (
                <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-3 py-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Remote Intake Policy
                  </p>
                    <div className="flex flex-wrap gap-2">
                    {repositoryPolicy.remote_enabled ? (
                      <StatusBadge status="remote enabled" />
                    ) : (
                      <StatusBadge status="remote disabled" />
                    )}
                    {repositoryPolicy.allowed_remote_hosts.map((host) => (
                      <span key={host}>
                        <StatusBadge status={host} />
                      </span>
                    ))}
                  </div>
                  {repositoryPolicy.allowed_remote_owners.length > 0 && (
                    <p className="text-xs text-on-surface-variant">
                      Allowed owners: {repositoryPolicy.allowed_remote_owners.join(', ')}
                    </p>
                  )}
                  {repositoryPolicy.allowed_remote_hosts.length === 0 && (
                    <p className="text-xs text-on-surface-variant">
                      No remote hosts are currently enabled on this backend.
                    </p>
                  )}
                </div>
              )}
              {(detectedRepoSlug || normalizedRemoteRepo.issueNumber) && (
                <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-3 py-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Detected From URL
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detectedRepoSlug && <StatusBadge status={detectedRepoSlug} />}
                    {normalizedRemoteRepo.host && <StatusBadge status={normalizedRemoteRepo.host} />}
                    {normalizedRemoteRepo.issueNumber && (
                      <StatusBadge status={`issue #${normalizedRemoteRepo.issueNumber}`} />
                    )}
                  </div>
                  {normalizedRemoteRepo.issueNumber && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRequestMode('issue');
                          setIssueTitle((current) =>
                            current.trim()
                              ? current
                              : `${detectedRepoSlug ? `${detectedRepoSlug} ` : ''}Issue #${normalizedRemoteRepo.issueNumber}`,
                          );
                        }}
                        className="rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
                      >
                        Use as Issue Context
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-on-surface-variant">
                Remote clone support is policy-gated by host and owner allowlists on the backend.
                GitHub issue, tree, and blob URLs are normalized back to the repo root where
                possible.
              </p>
            </div>
          )}
        </div>
        <input
          type="text"
          value={baseBranch}
          onChange={(event) => setBaseBranch(event.target.value)}
          placeholder="main"
          className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="text"
            value={targetBranch}
            onChange={(event) => setTargetBranch(event.target.value)}
            placeholder="Optional delivery branch, e.g. feat/harness-output"
            className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
          <input
            type="text"
            value={deliveryRemoteName}
            onChange={(event) => setDeliveryRemoteName(event.target.value)}
            placeholder="origin"
            className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <input
              type="checkbox"
              checked={autoDeliver}
              onChange={(event) => setAutoDeliver(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-outline-variant/20"
            />
            <span className="space-y-1">
              <span className="block text-sm text-on-surface">Auto-deliver on completion</span>
              <span className="block text-xs text-on-surface-variant">
                Create a delivery branch and commit verified changes when the run completes.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <input
              type="checkbox"
              checked={pushOnComplete}
              onChange={(event) => setPushOnComplete(event.target.checked)}
              disabled={!autoDeliver}
              className="mt-1 h-4 w-4 rounded border-outline-variant/20"
            />
            <span className="space-y-1">
              <span className="block text-sm text-on-surface">Push delivery branch</span>
              <span className="block text-xs text-on-surface-variant">
                Push the created branch to the selected remote after local delivery succeeds.
              </span>
            </span>
          </label>
        </div>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 space-y-3">
          <div>
            <p className="text-sm text-on-surface">Request Type</p>
            <p className="text-xs text-on-surface-variant">
              Tell the harness whether this is a direct brief, an issue to resolve, or a feature
              request against the selected repo.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setRequestMode('spec')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
                requestMode === 'spec'
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-outline-variant/10 bg-surface',
              )}
            >
              <FileText className="h-4 w-4 text-primary" />
              <span>
                <span className="block text-xs font-bold uppercase tracking-widest text-on-surface">
                  Direct Spec
                </span>
                <span className="block text-xs text-on-surface-variant">
                  Give the harness a fresh brief.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRequestMode('issue')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
                requestMode === 'issue'
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-outline-variant/10 bg-surface',
              )}
            >
              <Bug className="h-4 w-4 text-primary" />
              <span>
                <span className="block text-xs font-bold uppercase tracking-widest text-on-surface">
                  Resolve Issue
                </span>
                <span className="block text-xs text-on-surface-variant">
                  Work from a bug or issue description.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRequestMode('feature')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-3 text-left transition-colors',
                requestMode === 'feature'
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-outline-variant/10 bg-surface',
              )}
            >
              <Lightbulb className="h-4 w-4 text-primary" />
              <span>
                <span className="block text-xs font-bold uppercase tracking-widest text-on-surface">
                  Feature Request
                </span>
                <span className="block text-xs text-on-surface-variant">
                  Drive work from a requested capability.
                </span>
              </span>
            </button>
          </div>
        </div>
        {requestMode === 'issue' && (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 space-y-3">
            <div>
              <p className="text-sm text-on-surface">Issue Context</p>
              <p className="text-xs text-on-surface-variant">
                This is stored separately from the execution brief and helps planning stay grounded
                in the original problem statement.
              </p>
            </div>
            <input
              type="text"
              value={issueTitle}
              onChange={(event) => setIssueTitle(event.target.value)}
              placeholder="Short issue title"
              className="rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
            />
            <textarea
              value={issueBody}
              onChange={(event) => setIssueBody(event.target.value)}
              placeholder="Paste the issue body, reproduction notes, failure details, or acceptance notes."
              rows={6}
              className="rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        )}
        {requestMode === 'feature' && (
          <div className="rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3 space-y-3">
            <div>
              <p className="text-sm text-on-surface">Feature Request</p>
              <p className="text-xs text-on-surface-variant">
                Use this for the original request language. The execution brief can then narrow how
                the harness should approach it.
              </p>
            </div>
            <textarea
              value={featureRequestText}
              onChange={(event) => setFeatureRequestText(event.target.value)}
              placeholder="Describe the requested feature, user need, expected behavior, and any constraints."
              rows={6}
              className="rounded-lg border border-outline-variant/10 bg-surface px-4 py-3 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
            />
          </div>
        )}
        <textarea
          value={specText}
          onChange={(event) => setSpecText(event.target.value)}
          placeholder={
            requestMode === 'issue'
              ? 'Optional execution brief. Leave blank to use the issue title/body as the planning brief.'
              : requestMode === 'feature'
                ? 'Optional execution brief. Leave blank to use the feature request text as the planning brief.'
                : 'Describe the change the harness should deliver, or paste a detailed plan outline.'
          }
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
              {effectiveSpecCharacterCount.toLocaleString()} effective characters ·{' '}
              {effectiveSpecLineCount.toLocaleString()} effective lines
            </p>
            <p className="text-xs text-on-surface-variant">
              {specText.trim()
                ? 'Using the explicit execution brief.'
                : requestMode === 'issue'
                  ? 'No execution brief entered. The issue title/body will become the planning brief.'
                  : requestMode === 'feature'
                    ? 'No execution brief entered. The feature request text will become the planning brief.'
                    : 'No hard app-side limit today. Large outlines are allowed, but very large prompts can reduce planning quality.'}
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
          This planning brief is over {SPEC_SOFT_WARNING_CHARS.toLocaleString()} characters. It
          should still save, but plan generation may benefit from a tighter outline or a later
          dedicated attachment flow.
        </div>
      )}
      {createRunError && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {createRunError}
        </div>
      )}
      <div className="hidden sm:block sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] sm:static -mx-2 sm:mx-0 px-2 sm:px-0 pt-3 bg-gradient-to-t from-surface-container via-surface-container/95 to-transparent">
        <button
          type="button"
          disabled={!canCreateRun}
          onClick={() => {
            void handleCreateRunSubmit();
          }}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-primary/10"
        >
          {creatingRun ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Run
        </button>
      </div>
    </div>
  );
}

interface RunsPanelProps {
  authenticated: boolean;
  runs: Run[];
  runsError: string | null;
  runDeliverySummaries: Record<string, RunDeliverySummary | null>;
  onOpenRun: (id: string) => void;
}

function runDeliveryStatus(
  run: Run,
  delivery: RunDeliverySummary | null | undefined,
): { label: string; tone: 'success' | 'warning' | 'neutral' } | null {
  if (delivery?.pushed) {
    return { label: 'delivered', tone: 'success' };
  }
  if (delivery?.push_error) {
    return { label: 'push failed', tone: 'warning' };
  }
  if (delivery) {
    return { label: 'delivery branch ready', tone: 'neutral' };
  }
  if (run.status === 'RUN_COMPLETE' && run.auto_deliver) {
    return { label: 'waiting for delivery', tone: 'warning' };
  }
  return null;
}

export function RunsPanel({
  authenticated,
  runs,
  runsError,
  runDeliverySummaries,
  onOpenRun,
}: RunsPanelProps) {
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
          {runs.map((run) => {
            const deliveryState = runDeliveryStatus(run, runDeliverySummaries[run.run_id]);
            return (
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
                      <StatusBadge status={run.intake_mode} />
                      {run.issue_title && <StatusBadge status="issue" />}
                      {run.feature_request_text && <StatusBadge status="feature" />}
                      <StatusBadge status={run.status} />
                      {run.baseline_status && <StatusBadge status={run.baseline_status} />}
                      {deliveryState && (
                        <StatusBadge
                          status={deliveryState.label}
                          className={
                            deliveryState.tone === 'success'
                              ? 'text-secondary bg-secondary/10 border-secondary/20'
                              : deliveryState.tone === 'warning'
                                ? 'text-tertiary bg-tertiary/10 border-tertiary/20'
                                : undefined
                          }
                        />
                      )}
                    </div>
                    <p className="text-sm text-on-surface-variant line-clamp-2">{run.spec_text}</p>
                    <div className="flex flex-wrap gap-2">
                      {run.auto_deliver && <StatusBadge status="auto deliver" />}
                      {run.push_on_complete && <StatusBadge status="push on complete" />}
                      {run.target_branch && <StatusBadge status={run.target_branch} />}
                    </div>
                    <p className="font-mono text-[11px] text-on-surface-variant">
                      {run.intake_mode === 'remote'
                        ? run.repo_url ?? `${run.repo_owner ?? '-'} / ${run.repo_slug ?? run.repo_name}`
                        : run.repo_path}
                    </p>
                    <p className="font-mono text-[11px] text-on-surface-variant">
                      {run.run_id} · slot {run.concurrency_slot ?? '-'} · branch {run.base_branch}
                    </p>
                    {runDeliverySummaries[run.run_id]?.branch_name && (
                      <p className="font-mono text-[11px] text-on-surface-variant">
                        delivery {runDeliverySummaries[run.run_id]?.branch_name}
                      </p>
                    )}
                    {run.issue_url && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openExternalUrl(run.issue_url ?? '');
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Issue
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] uppercase tracking-widest text-on-surface-variant/80">
                    {new Date(run.updated_at).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
