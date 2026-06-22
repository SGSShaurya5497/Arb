import type { WsTickPayload } from '../types/spread';

interface Props {
  events: WsTickPayload[];
  wsStatus: 'connecting' | 'connected' | 'disconnected';
}

function fmtTime(streamId: string): string {
  // Redis stream IDs are "<millisecond_epoch>-<seq>"
  try {
    const ms = parseInt(streamId.split('-')[0], 10);
    if (isNaN(ms)) return '—';
    return new Date(ms).toLocaleTimeString('en-IN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function fmtBps(v: string | undefined): string {
  if (!v) return '—';
  const n = parseFloat(v);
  return (n >= 0 ? '+' : '') + n.toFixed(2);
}

function bpsColor(v: string | undefined): string {
  if (!v) return 'text-muted';
  const n = parseFloat(v);
  return n > 0 ? 'text-flux-pos' : n < 0 ? 'text-flux-neg' : 'text-muted';
}

const STATUS_MAP = {
  connected:    { dot: 'bg-flux-pos',  label: 'LIVE' },
  connecting:   { dot: 'bg-amber',     label: 'CONNECTING' },
  disconnected: { dot: 'bg-flux-neg',  label: 'OFFLINE' },
};

export function LiveFeed({ events, wsStatus }: Props) {
  const st = STATUS_MAP[wsStatus];

  return (
    <div className="h-full flex flex-col">
      {/* Feed rows */}
      <div className="flex-1 overflow-hidden">
        {events.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            Waiting for WebSocket events…
          </div>
        )}
        {events.map((ev, i) => (
          <div
            key={`${ev.id}-${i}`}
            className={[
              'flex items-center gap-0 border-b border-[#1a1a1e] px-3 py-[4px]',
              i === 0 ? 'flash-row' : '',
            ].join(' ')}
            style={{ minHeight: 26 }}
          >
            {/* Timestamp */}
            <span className="data text-2xs text-muted w-[72px] shrink-0 mr-3">
              {fmtTime(ev.id)}
            </span>

            {/* Symbol */}
            <span className="data text-xs text-text font-medium w-[100px] shrink-0">
              {ev.symbol}
            </span>

            {/* Exchange badge */}
            <span className="font-sans text-2xs text-muted border border-border px-1 mr-3"
                  style={{ borderRadius: 1, lineHeight: '16px' }}>
              {ev.exchange}
            </span>

            {/* Price */}
            <span className="data text-xs text-text mr-4 shrink-0">
              ₹{parseFloat(ev.price).toFixed(2)}
            </span>

            {/* NAV */}
            <span className="data text-xs text-muted mr-4 shrink-0">
              NAV {parseFloat(ev.nav).toFixed(2)}
            </span>

            {/* Spread bps */}
            {ev.spread_bps && (
              <span className={`data text-xs ml-auto ${bpsColor(ev.spread_bps)}`}>
                {fmtBps(ev.spread_bps)} bps
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Status bar — bottom of feed panel */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border">
        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shrink-0`} />
        <span className="data text-2xs text-muted tracking-widest">{st.label}</span>
        <span className="ml-auto data text-2xs text-muted">{events.length} events</span>
      </div>
    </div>
  );
}
