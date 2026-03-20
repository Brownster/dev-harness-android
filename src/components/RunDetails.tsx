/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Activity, Clock, Database, GitBranch, Terminal } from 'lucide-react';
import { Run } from '../types';
import { StatusBadge } from './StatusBadge';

interface RunDetailsProps {
  run: Run;
}

export function RunDetails({ run }: RunDetailsProps) {
  return (
    <div className="space-y-6">
      {/* Run Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
              <Terminal className="text-primary w-6 h-6" />
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">{run.name}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container-highest rounded border border-outline-variant/10">
              <GitBranch className="text-on-surface-variant w-3.5 h-3.5" />
              <span className="text-[10px] font-mono text-on-surface-variant">ID: {run.id}</span>
            </div>
            <StatusBadge status={run.status} />
          </div>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-label text-[10px] uppercase tracking-widest">Updated {new Date(run.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Description */}
      <div className="bg-surface-container p-6 rounded-xl border border-outline-variant/5">
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">Run Description</span>
        <p className="text-on-surface-variant leading-relaxed text-sm">
          {run.description}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="text-primary w-5 h-5" />
          </div>
          <div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant block">Active Slices</span>
            <span className="font-headline font-bold text-xl">12</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
            <Database className="text-secondary w-5 h-5" />
          </div>
          <div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant block">CPU Load</span>
            <span className="font-headline font-bold text-xl">24%</span>
          </div>
        </div>
        <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
            <Terminal className="text-tertiary w-5 h-5" />
          </div>
          <div>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant block">Memory</span>
            <span className="font-headline font-bold text-xl">8.2GB</span>
          </div>
        </div>
      </div>
    </div>
  );
}
