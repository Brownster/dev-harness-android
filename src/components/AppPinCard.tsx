import { FormEvent, useState } from 'react';
import { KeyRound, Lock, LockOpen, Shield } from 'lucide-react';

interface AppPinCardProps {
  pinConfigured: boolean;
  onSetPin: (pin: string) => Promise<void>;
  onChangePin: (currentPin: string, nextPin: string) => Promise<void>;
  onRemovePin: (currentPin: string) => Promise<void>;
  onLockNow: () => void;
}

export function AppPinCard({
  pinConfigured,
  onSetPin,
  onChangePin,
  onRemovePin,
  onLockNow,
}: AppPinCardProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPin !== confirmPin) {
      setError('PIN confirmation does not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (pinConfigured) {
        await onChangePin(currentPin, newPin);
      } else {
        await onSetPin(newPin);
      }
      resetForm();
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : 'Failed to save app PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onRemovePin(currentPin);
      resetForm();
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : 'Failed to remove app PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant/5">
        <h2 className="font-headline text-lg font-bold">App PIN Lock</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Add a local PIN so this device can reopen the app without re-entering the operator
          username and password every time.
        </p>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/10 bg-surface-container-low px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-on-surface">PIN Status</p>
            <p className="text-sm text-on-surface-variant">
              {pinConfigured
                ? 'A local PIN is active for this device.'
                : 'No PIN is set. The app opens directly into the stored session.'}
            </p>
          </div>
          <div className="rounded-full border border-outline-variant/10 bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface">
            {pinConfigured ? 'PIN enabled' : 'PIN disabled'}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {pinConfigured && (
            <label className="block space-y-2">
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Current PIN
              </span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={currentPin}
                  onChange={(event) => setCurrentPin(event.target.value)}
                  placeholder="Current PIN"
                  className="w-full rounded-lg border border-outline-variant/10 bg-surface-container-low py-3 pl-10 pr-4 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </label>
          )}

          <label className="block space-y-2">
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              {pinConfigured ? 'New PIN' : 'PIN'}
            </span>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={newPin}
                onChange={(event) => setNewPin(event.target.value)}
                placeholder="4 to 8 digits"
                className="w-full rounded-lg border border-outline-variant/10 bg-surface-container-low py-3 pl-10 pr-4 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Confirm PIN
            </span>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value)}
                placeholder="Repeat PIN"
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
              disabled={
                submitting ||
                !newPin.trim() ||
                !confirmPin.trim() ||
                (pinConfigured && !currentPin.trim())
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Shield className="w-4 h-4" />
              {pinConfigured ? 'Change PIN' : 'Set PIN'}
            </button>

            {pinConfigured && (
              <>
                <button
                  type="button"
                  onClick={onLockNow}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface"
                >
                  <Lock className="w-4 h-4" />
                  Lock Now
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={submitting || !currentPin.trim()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LockOpen className="w-4 h-4" />
                  Remove PIN
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
