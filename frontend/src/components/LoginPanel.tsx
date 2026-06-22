import { useState } from 'react';

interface Props {
  onLogin: (token: string) => void;
}

export function LoginPanel({ onLogin }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail]           = useState('');
  const [password, setPass]         = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isRegister) {
        // Register first
        const regRes = await fetch('/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!regRes.ok) {
          const body = await regRes.json() as { detail: string };
          throw new Error(body.detail ?? 'Registration failed');
        }
      }

      // Login (either after register, or directly)
      const form = new URLSearchParams({ username: email, password });
      const res = await fetch('/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      if (!res.ok) {
        const body = await res.json() as { detail: string };
        throw new Error(body.detail ?? 'Login failed');
      }
      const data = await res.json() as { access_token: string };
      onLogin(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-surface">
      <div className="panel w-full max-w-sm">
        <div className="panel-header">
          <span className="dot" />
          ARB TERMINAL — AUTHENTICATION
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border">
          <button
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`flex-1 py-2 text-xs font-sans tracking-widest uppercase ${!isRegister ? 'bg-[rgba(255,255,255,0.04)] text-text' : 'text-muted hover:text-text'}`}
          >
            Connect
          </button>
          <div className="w-[1px] bg-border" />
          <button
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`flex-1 py-2 text-xs font-sans tracking-widest uppercase ${isRegister ? 'bg-[rgba(255,255,255,0.04)] text-text' : 'text-muted hover:text-text'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-muted text-xs uppercase tracking-widest font-sans">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="data text-sm bg-surface border border-border text-text px-3 py-2 outline-none focus:border-muted"
              style={{ borderRadius: 2 }}
              placeholder="user@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-muted text-xs uppercase tracking-widest font-sans">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPass(e.target.value)}
              required
              className="data text-sm bg-surface border border-border text-text px-3 py-2 outline-none focus:border-muted"
              style={{ borderRadius: 2 }}
            />
          </div>

          {error && (
            <div className="data text-xs text-flux-neg border border-flux-neg/30 px-3 py-2"
                 style={{ borderRadius: 2 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="data text-sm border border-text text-text px-4 py-2 hover:bg-text hover:text-surface transition-colors disabled:opacity-40 mt-2"
            style={{ borderRadius: 2 }}
          >
            {loading ? 'AUTHENTICATING…' : isRegister ? 'CREATE ACCOUNT & CONNECT' : 'CONNECT'}
          </button>
        </form>
      </div>
    </div>
  );
}
