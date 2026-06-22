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

function zColor(v: string): string {
  const abs = Math.abs(parseFloat(v));
  if (abs > 3) return parseFloat(v) > 0 ? 'text-flux-pos' : 'text-flux-neg';
  if (abs > 2) return 'text-amber';
  return 'text-muted';
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
  const [tick, setTick]       = useState(0); // force re-render for relative times

  // Refresh relative timestamps every 5s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/alerts/?page_size=20', {
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

  // Poll every 30s so the panel stays fresh
  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  return (
    <div className="h-full overflow-auto">
      {loading && (
        <div className="flex items-center justify-center h-20 text-muted text-xs">
          Loading…
        </div>
      )}
      {!loading && alerts.length === 0 && (
        <div className="flex items-center justify-center h-20 text-muted text-xs">
          No active alerts — all z-scores within threshold
        </div>
      )}
      {alerts.map((a, i) => {
        const absZ = Math.abs(parseFloat(a.z_score));
        const isExtreme = absZ > 3;
        return (
          <div
            key={`${a.id}-${i}`}
            className="flex items-center gap-3 px-3 py-[5px] border-b border-[#1a1a1e]"
          >
            {/* Severity indicator bar */}
            <div className={`w-0.5 self-stretch shrink-0 ${
              isExtreme ? (parseFloat(a.z_score) > 0 ? 'bg-flux-pos' : 'bg-flux-neg') : 'bg-amber'
            }`} />

            {/* Symbol */}
            <span className="data text-xs text-text font-medium w-[90px] shrink-0">
              {a.symbol}
            </span>

            {/* Z-Score */}
            <span className={`data text-sm font-semibold ${zColor(a.z_score)}`}>
              {fmtZ(a.z_score)}σ
            </span>

            {/* Spread */}
            <span className={`data text-xs ml-2 ${
              parseFloat(a.spread_bps) > 0 ? 'text-flux-pos' : 'text-flux-neg'
            }`}>
              {fmtBps(a.spread_bps)} bps
            </span>

            {/* Time — updates via tick */}
            <span className="data text-2xs text-muted ml-auto" key={tick}>
              {relTime(a.captured_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
