import { useState } from 'react';

import {
  RunCreationPanel,
  RunsPanel,
} from '../components/dashboard/DashboardPanels';
import { PullToRefresh } from '../components/NativeInteractions';
import { cn } from '../lib/cn';
import type { RepositoryOption, Run, RunCreateInput } from '../types';

export interface DashboardViewProps {
  authenticated: boolean;
  repositories: RepositoryOption[];
  repositoriesLoading: boolean;
  repositoriesError: string | null;
  runs: Run[];
  runsLoading: boolean;
  runsError: string | null;
  onOpenRun: (id: string) => void;
  onRefresh: () => Promise<void>;
  onCreateRun: (payload: RunCreateInput) => Promise<void>;
}

export function DashboardView({
  authenticated,
  repositories,
  repositoriesLoading,
  repositoriesError,
  runs,
  runsLoading,
  runsError,
  onOpenRun,
  onRefresh,
  onCreateRun,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<'runs' | 'new_run'>('runs');

  return (
    <div className="space-y-6 sm:space-y-8">
      <PullToRefresh onRefresh={onRefresh} />

      <div className="flex gap-2 border-b border-outline-variant/10 pb-px overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('runs')}
          className={cn(
            'whitespace-nowrap px-4 py-2 font-label text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b-2 transition-colors',
            activeTab === 'runs'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface',
          )}
        >
          Tracked Runs
        </button>
        <button
          onClick={() => setActiveTab('new_run')}
          className={cn(
            'whitespace-nowrap px-4 py-2 font-label text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b-2 transition-colors',
            activeTab === 'new_run'
              ? 'border-primary text-primary'
              : 'border-transparent text-on-surface-variant hover:text-on-surface',
          )}
        >
          Create Run
        </button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'new_run' ? (
          <RunCreationPanel
            authenticated={authenticated}
            repositories={repositories}
            repositoriesLoading={repositoriesLoading}
            repositoriesError={repositoriesError}
            onCreateRun={onCreateRun}
          />
        ) : (
          <RunsPanel
            authenticated={authenticated}
            runs={runs}
            runsError={runsError}
            onOpenRun={onOpenRun}
          />
        )}
      </div>
    </div>
  );
}
