import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AlertItem {
  id: number;
  asset_id: string;
  symbol: string;
  spread_type: string | null;
  spread_bps: string;
  z_score: string;
  captured_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBps(v: string): string {
  const n = parseFloat(v);
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

function fmtZ(v: string): string {
  const n = parseFloat(v);
  return (n >= 0 ? '+' : '') + n.toFixed(3);
}

function zBarColor(v: string): string {
  const abs = Math.abs(parseFloat(v));
  if (abs > 3) return parseFloat(v) > 0 ? '#22C55E' : '#EF4444';
  if (abs > 2) return '#F59E0B';
  return '#3a3a42';
}

function zTextColor(v: string): string {
  const abs = Math.abs(parseFloat(v));
  if (abs > 3) return parseFloat(v) > 0 ? '#22C55E' : '#EF4444';
  if (abs > 2) return '#F59E0B';
  return '#5A5A65';
}

function relTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  authToken: string | null;
  onAuthExpired: () => void;
}

export function AlertsPanel({ authToken, onAuthExpired }: Props) {
  const [alerts, setAlerts]   = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick]       = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const apiBase = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;
      const res = await fetch(`${apiBase}/alerts/?page_size=20`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.status === 401) { onAuthExpired(); return; }
      if (!res.ok) return;
      const data = await res.json() as PaginatedResponse<AlertItem>;
      setAlerts(data.items);
    } catch { /* network error — silent */ } finally {
      setLoading(false);
    }
  }, [authToken, onAuthExpired]);

  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: '#3a3a42', letterSpacing: '0.08em' }}>
          Loading…
        </div>
      )}
      {!loading && alerts.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 8 }}>
          <div style={{ fontSize: '1.5rem' }}>✓</div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#3a3a42' }}>
            No active alerts
          </span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#252529', letterSpacing: '0.06em' }}>
            All z-scores within threshold
          </span>
        </div>
      )}
      {alerts.map((a, i) => {
        const barColor  = zBarColor(a.z_score);
        const textColor = zTextColor(a.z_score);
        const bpsN      = parseFloat(a.spread_bps);
        const absZ      = Math.abs(parseFloat(a.z_score));

        return (
          <div
            key={`${a.id}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 14px',
              borderBottom: '1px solid #111115',
              transition: 'background 0.15s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Severity bar */}
            <div style={{
              width: 3,
              alignSelf: 'stretch',
              flexShrink: 0,
              borderRadius: 2,
              background: barColor,
              boxShadow: absZ > 3 ? `0 0 6px ${barColor}60` : 'none',
            }} />

            {/* Symbol */}
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.75rem',
              color: '#E8E8EC',
              fontWeight: 500,
              width: 100,
              flexShrink: 0,
              letterSpacing: '0.04em',
            }}>
              {a.symbol}
            </span>

            {/* Z-Score */}
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: textColor,
              letterSpacing: '-0.02em',
            }}>
              {fmtZ(a.z_score)}σ
            </span>

            {/* Spread */}
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.72rem',
              color: bpsN > 0 ? '#22C55E' : '#EF4444',
              marginLeft: 4,
            }}>
              {fmtBps(a.spread_bps)} bps
            </span>

            {/* Type badge */}
            {a.spread_type && (
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.58rem',
                color: '#3a3a42',
                border: '1px solid #1e1e24',
                padding: '1px 5px',
                borderRadius: 3,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}>
                {a.spread_type}
              </span>
            )}

            {/* Time */}
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '0.6rem',
              color: '#3a3a42',
              marginLeft: 'auto',
              letterSpacing: '0.04em',
            }} key={tick}>
              {relTime(a.captured_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
