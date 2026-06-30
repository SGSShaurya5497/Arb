import { useMarketStrip } from '../hooks/useMarketStrip';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(price: number | null, currency: string): string {
  if (price === null) return '—';
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
      style={{
        height: 28,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(90deg, #050508 0%, #080810 100%)',
        borderBottom: '1px solid #1a1a1e',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
      className="hide-scrollbar"
    >
      {/* Label */}
      <span
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.6rem',
          color: '#3a3a42',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
          padding: '0 14px',
          borderRight: '1px solid #1a1a1e',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        MARKETS
      </span>

      {/* Quotes */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
        {quotes.map((q) => {
          const isPos = (q.changePct ?? 0) > 0;
          const isNeg = (q.changePct ?? 0) < 0;
          const pctColor = q.unavailable
            ? '#3a3a42'
            : isPos ? '#22C55E'
            : isNeg ? '#EF4444'
            : '#5A5A65';

          return (
            <div
              key={q.symbol}
              className="strip-item"
              style={{ cursor: 'default' }}
            >
              {/* Label */}
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.6rem',
                color: '#3a3a42',
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                flexShrink: 0,
                fontWeight: 500,
              }}>
                {q.label}
              </span>

              {q.unavailable ? (
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42' }}>n/a</span>
              ) : (
                <>
                  {/* Price */}
                  <span style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.68rem',
                    color: '#C8C8CC',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {q.currency}{fmt(q.price, q.currency)}
                  </span>

                  {/* Change % with direction indicator */}
                  <span style={{
                    fontFamily: 'JetBrains Mono',
                    fontSize: '0.6rem',
                    color: pctColor,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}>
                    {q.changePct !== null && (isPos ? '▲' : isNeg ? '▼' : '')}
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
        <span style={{
          fontFamily: 'JetBrains Mono',
          fontSize: '0.58rem',
          color: '#252529',
          marginLeft: 'auto',
          padding: '0 12px',
          flexShrink: 0,
        }}>
          {lastUpdated.toLocaleTimeString('en-IN', { hour12: false })}
        </span>
      )}
    </div>
  );
}
