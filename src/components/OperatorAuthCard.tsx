import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, LogIn, LogOut, ShieldCheck, User } from 'lucide-react';

interface OperatorAuthCardProps {
  authenticated: boolean;
  username: string;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export function OperatorAuthCard({
  authenticated,
  username,
  onLogin,
  onLogout,
}: OperatorAuthCardProps) {
  const [loginUsername, setLoginUsername] = useState(username);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoginUsername(username);
  }, [username]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onLogin(loginUsername, password);
      setPassword('');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Failed to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Failed to sign out.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-container rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="bg-surface-container-high px-6 py-4 border-b border-outline-variant/5">
        <h2 className="font-headline text-lg font-bold">Operator Session</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Sign in with an operator account. The app stores only the session token on this device.
        </p>
      </div>

      <div className="p-6 space-y-5">
        {authenticated ? (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-secondary/20 bg-secondary/10 px-4 py-3 text-sm text-on-surface">
              <ShieldCheck className="w-4 h-4 mt-0.5 text-secondary flex-shrink-0" />
              <div>
                <p className="font-medium">Signed in as {username}</p>
                <p className="text-on-surface-variant">
                  Escalation responses are now attributed to this operator account.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-lg border border-outline-variant/10 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block space-y-2">
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Username
              </span>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  placeholder="operator"
                  className="w-full rounded-lg border border-outline-variant/10 bg-surface-container-low py-3 pl-10 pr-4 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                Password
              </span>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  className="w-full rounded-lg border border-outline-variant/10 bg-surface-container-low py-3 pl-10 pr-4 text-sm text-on-surface focus:border-primary/30 focus:ring-1 focus:ring-primary/30"
                  autoComplete="current-password"
                />
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !loginUsername.trim() || !password}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-primary to-primary-container px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-primary active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </form>
        )}

        {authenticated && error && (
          <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
