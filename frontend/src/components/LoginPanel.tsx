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
    const authBase = `${import.meta.env.VITE_API_URL ?? ''}/auth`;
    try {
      if (isRegister) {
        const regRes = await fetch(`${authBase}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!regRes.ok) {
          const body = await regRes.json() as { detail: string };
          throw new Error(body.detail ?? 'Registration failed');
        }
      }

      const form = new URLSearchParams({ username: email, password });
      const res = await fetch(`${authBase}/token`, {
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

  const inputStyle: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.8125rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #252529',
    color: '#E8E8EC',
    padding: '10px 12px',
    borderRadius: 6,
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #0a0a18 0%, #080810 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)',
        top: '10%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,197,94,0.03) 0%, transparent 70%)',
        bottom: '20%', right: '20%', pointerEvents: 'none',
      }} />

      {/* Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: 380, borderRadius: 12, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '24px 24px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(13,13,15,0) 60%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #3B82F6 0%, #1d4ed8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
            }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: '#fff' }}>A</span>
            </div>
            <div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #E8E8EC 0%, #9090a0 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                ARB Terminal
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: '#3a3a42', letterSpacing: '0.06em', marginTop: 1 }}>
                Real-time Arbitrage Monitor
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {[
            { label: 'Sign In', value: false },
            { label: 'Register', value: true },
          ].map(tab => (
            <button
              key={String(tab.value)}
              onClick={() => { setIsRegister(tab.value); setError(null); }}
              style={{
                flex: 1,
                padding: '10px 0',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.72rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontWeight: 500,
                border: 'none',
                background: isRegister === tab.value ? 'rgba(59,130,246,0.08)' : 'transparent',
                color: isRegister === tab.value ? '#3B82F6' : '#5A5A65',
                cursor: 'pointer',
                borderBottom: isRegister === tab.value ? '2px solid #3B82F6' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: '#5A5A65', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="user@example.com"
              onFocus={e => {
                e.target.style.borderColor = '#3B82F6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#252529';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', color: '#5A5A65', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPass(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => {
                e.target.style.borderColor = '#3B82F6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#252529';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.7rem',
              color: '#EF4444',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              padding: '8px 12px',
              borderRadius: 6,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: loading
                ? 'rgba(59,130,246,0.3)'
                : 'linear-gradient(135deg, #3B82F6 0%, #2563eb 100%)',
              color: loading ? 'rgba(255,255,255,0.4)' : '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(59,130,246,0.3)',
              transition: 'all 0.15s ease',
              marginTop: 4,
            }}
            onMouseEnter={e => {
              if (!loading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.45)';
            }}
            onMouseLeave={e => {
              if (!loading) e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.3)';
            }}
          >
            {loading ? 'Authenticating…' : isRegister ? 'Create Account & Connect' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
