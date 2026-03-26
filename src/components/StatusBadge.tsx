/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case 'connected':
      case 'running':
      case 'active':
      case 'open':
        return 'text-secondary bg-secondary/10 border-secondary/20';
      case 'token auth':
      case 'operator session':
      case 'completed':
      case 'resolved':
        return 'text-primary bg-primary/10 border-primary/20';
      case 'failed':
        return 'text-error bg-error/10 border-error/20';
      case 'configuration required':
      case 'paused':
      case 'pending':
        return 'text-tertiary bg-tertiary/10 border-tertiary/20';
      default:
        return 'text-on-surface-variant bg-surface-container-highest border-outline-variant/20';
    }
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border",
      getStatusStyles(status),
      className
    )}>
      {status}
    </span>
  );
}
