import { FormEvent, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  ExternalLink,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Settings,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '../lib/cn';
import { StatusBadge } from './StatusBadge';
import type { OperatorConnectionStatus } from '../types';

interface AppHeaderProps {
  authenticated: boolean;
  username: string | null | undefined;
  apiBaseUrl: string;
  registeredDevices: number;
  runCount: number;
  connectionStatus: OperatorConnectionStatus;
  isMobilePreview: boolean;
  showDeepLinkSim: boolean;
  onHome: () => void;
  onToggleDeepLinkSim: () => void;
}

export function AppHeader({
  authenticated,
  username,
  apiBaseUrl,
  registeredDevices,
  runCount,
  connectionStatus,
  isMobilePreview,
  showDeepLinkSim,
  onHome,
  onToggleDeepLinkSim,
}: AppHeaderProps) {
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const badgeLabel =
    connectionStatus.session_state === 'active'
      ? username || 'Signed in'
      : connectionStatus.backend_state === 'unreachable'
        ? 'Backend offline'
        : connectionStatus.session_state === 'expired'
          ? 'Session expired'
          : connectionStatus.backend_state === 'reachable'
            ? 'Signed out'
            : 'Needs setup';
  const sessionBadgeStatus =
    connectionStatus.session_state === 'active'
      ? 'operator session'
      : connectionStatus.backend_state === 'unreachable'
        ? 'failed'
        : connectionStatus.session_state === 'expired'
          ? 'paused'
          : connectionStatus.backend_state === 'reachable'
            ? 'connected'
            : 'configuration required';
  const backendBadgeStatus =
    connectionStatus.backend_state === 'reachable'
      ? 'connected'
      : connectionStatus.backend_state === 'unreachable'
        ? 'failed'
        : 'configuration required';

  return (
    <header
      className={cn(
        'bg-surface/80 backdrop-blur-md flex justify-between items-start px-6 pb-4 w-full sticky top-0 z-40 border-b border-outline-variant/5',
        isMobilePreview ? 'pt-10' : 'pt-[calc(env(safe-area-inset-top)+1rem)]',
      )}
    >
      <div className="flex items-center gap-3 cursor-pointer" onClick={onHome}>
        <div className="w-8 h-8 rounded bg-surface-container-highest flex items-center justify-center overflow-hidden">
          <Terminal className="text-primary w-5 h-5" />
        </div>
        <span className="font-headline tracking-tight font-bold text-xl tracking-tighter text-primary">
          Terminal
        </span>
      </div>
      <div className="relative flex items-start gap-4">
        <button
          onClick={onToggleDeepLinkSim}
          className={cn(
            'text-on-surface-variant hover:bg-surface-container-high transition-colors p-2 rounded active:scale-95',
            showDeepLinkSim && 'bg-surface-container-high',
          )}
          title="Simulate Deep Link"
        >
          <ExternalLink className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setShowSessionInfo((current) => !current)}
            className="px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant/20"
          >
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              {badgeLabel}
            </span>
          </button>
          <AnimatePresence>
            {showSessionInfo && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-[15rem] max-w-[70vw] rounded-2xl border border-outline-variant/15 bg-surface-container-high p-4 shadow-xl"
              >
                <div className="space-y-3">
                  <div>
                    <p className="font-headline text-sm font-bold">Session Context</p>
                    <p className="mt-1 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      {connectionStatus.session_message}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={backendBadgeStatus} />
                    <StatusBadge status={sessionBadgeStatus} />
                  </div>
                  <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2">
                    <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                      Backend
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-on-surface">
                      {apiBaseUrl || 'Not configured'}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {connectionStatus.backend_message}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2">
                      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                        Runs
                      </p>
                      <p className="mt-1 text-sm font-medium text-on-surface">{runCount}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Bell className="h-3.5 w-3.5 text-primary" />
                        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                          Push
                        </p>
                      </div>
                      <p className="mt-1 text-sm font-medium text-on-surface">
                        {registeredDevices} device{registeredDevices === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

interface DeepLinkSimulatorProps {
  open: boolean;
  onTrigger: () => void;
}

export function DeepLinkSimulator({ open, onTrigger }: DeepLinkSimulatorProps) {
  return (
    <AnimatePresence>
      {open && (
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
            onClick={onTrigger}
            className="w-full bg-primary text-on-primary py-2 rounded font-label text-[10px] font-bold uppercase tracking-widest"
          >
            Trigger Escalation Link
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PinUnlockScreenProps {
  username: string | null | undefined;
  onUnlock: (pin: string) => Promise<void>;
  onResetLocalAccess: () => void;
}

export function PinUnlockScreen({
  username,
  onUnlock,
  onResetLocalAccess,
}: PinUnlockScreenProps) {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onUnlock(pin);
      setPin('');
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Failed to unlock app.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3">
        <p className="text-sm font-medium text-on-surface">
          {username ? `Stored session for ${username}` : 'Stored local session'}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          Unlocking is local to this device. It does not contact the backend until the app is open.
        </p>
      </div>

      <label className="block space-y-2">
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
          PIN
        </span>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="4 to 8 digits"
            className="w-full rounded-lg border border-outline-variant/10 bg-surface-container-low py-3 pl-10 pr-4 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </label>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={submitting || !pin.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock className="w-4 h-4" />
          Unlock
        </button>
        <button
          type="button"
          onClick={onResetLocalAccess}
          disabled={submitting}
          className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
        >
          Reset Local Access
        </button>
      </div>
    </form>
  );
}

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onNavigate: (to: string) => void;
}

function NavItem({ to, icon: Icon, label, active, onNavigate }: NavItemProps) {
  return (
    <button
      onClick={() => onNavigate(to)}
      className="flex flex-col items-center gap-1 p-2 transition-all active:scale-95"
      aria-current={active ? 'page' : undefined}
    >
      <div
        className={cn(
          'p-2 rounded-full transition-colors',
          active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant',
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <span
        className={cn(
          'font-label text-[10px] uppercase tracking-widest',
          active ? 'text-primary font-bold' : 'text-on-surface-variant',
        )}
      >
        {label}
      </span>
    </button>
  );
}

interface BottomNavProps {
  isMobilePreview: boolean;
  pathname: string;
  onNavigate: (to: string) => void;
}

interface MobilePreviewToggleProps {
  isMobilePreview: boolean;
  onToggle: () => void;
}

export function MobilePreviewToggle({
  isMobilePreview,
  onToggle,
}: MobilePreviewToggleProps) {
  return (
    <div className="hidden lg:flex fixed top-4 left-4 z-[60] gap-2">
      <button
        onClick={onToggle}
        className="bg-surface-container-highest text-on-surface px-4 py-2 rounded-full font-label text-[10px] font-bold uppercase tracking-widest border border-outline-variant/20 hover:bg-surface-bright transition-all"
      >
        {isMobilePreview ? 'Exit Mobile Preview' : 'Enter Mobile Preview'}
      </button>
    </div>
  );
}

export function BottomNav({ isMobilePreview, pathname, onNavigate }: BottomNavProps) {
  return (
    <nav
      className={cn(
        'shrink-0 w-full z-50 flex justify-around items-center px-4 pt-2 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/10 pb-[calc(env(safe-area-inset-bottom)+1rem)]',
        isMobilePreview && 'rounded-b-[2.5rem]',
      )}
    >
      <NavItem to="/" icon={LayoutDashboard} label="Home" active={pathname === '/'} onNavigate={onNavigate} />
      <NavItem
        to="/escalation"
        icon={MessageSquare}
        label="Escalations"
        active={pathname === '/escalation' || pathname.startsWith('/escalation/')}
        onNavigate={onNavigate}
      />
      <NavItem
        to="/settings"
        icon={Settings}
        label="Settings"
        active={pathname === '/settings'}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
