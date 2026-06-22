import { useMarketStrip } from '../hooks/useMarketStrip';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(price: number | null, currency: string): string {
  if (price === null) return '—';
  // USD/INR shows 4 decimal places; everything else 2
  const decimals = currency === '₹' && price > 100 ? 2 : currency === '$' ? 2 : 4;
  return price.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v: number | null): string {
  if (v === null) return '';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MarketStrip() {
  const { quotes, lastUpdated } = useMarketStrip();

  return (
    <div
      className="flex items-center border-b border-border bg-surface"
      style={{ height: 26, flexShrink: 0, overflowX: 'auto', overflowY: 'hidden' }}
    >
      {/* Label */}
      <span
        className="font-sans text-2xs text-muted uppercase tracking-widest px-3 shrink-0"
        style={{ borderRight: '1px solid #252529', lineHeight: '26px', height: '100%', display: 'flex', alignItems: 'center' }}
      >
        MARKETS
      </span>

      {/* Quotes */}
      <div className="flex items-center divide-x divide-border h-full">
        {quotes.map((q) => {
          const isPos = (q.changePct ?? 0) > 0;
          const isNeg = (q.changePct ?? 0) < 0;
          const pctColor = q.unavailable
            ? 'text-muted'
            : isPos ? 'text-flux-pos'
            : isNeg ? 'text-flux-neg'
            : 'text-muted';

          return (
            <div
              key={q.symbol}
              className="flex items-center gap-2 px-4 h-full"
              style={{ borderRight: '1px solid #252529' }}
            >
              {/* Label */}
              <span className="font-sans text-2xs text-muted tracking-wider uppercase shrink-0">
                {q.label}
              </span>

              {q.unavailable ? (
                <span className="data text-2xs text-muted">n/a</span>
              ) : (
                <>
                  {/* Price */}
                  <span className="data text-2xs text-text tabular-nums">
                    {q.currency}{fmt(q.price, q.currency)}
                  </span>

                  {/* Change % */}
                  <span className={`data text-2xs tabular-nums ${pctColor}`}>
                    {fmtPct(q.changePct)}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Last updated — far right */}
      {lastUpdated && (
        <span className="data text-2xs text-muted ml-auto px-3 shrink-0">
          {lastUpdated.toLocaleTimeString('en-IN', { hour12: false })}
        </span>
      )}
    </div>
  );
}
