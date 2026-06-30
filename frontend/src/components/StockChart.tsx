// src/components/StockChart.tsx
// Generic per-symbol intraday price chart, similar to NiftyChart but configurable.
// Uses the existing Vite /yf proxy → Yahoo Finance.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { SpreadTableRow } from '../types/spread';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PricePoint {
  time: string;
  price: number;
}

interface ChartState {
  data: PricePoint[];
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  loading: boolean;
  errMsg: string | null;
  updatedAt: Date | null;
}

interface SymbolOption {
  ticker: string;   // Yahoo Finance ticker (e.g. "^NSEI")
  label: string;    // Display label (e.g. "NIFTY 50")
  currency: string; // "₹" or "$"
}

interface Props {
  rows: SpreadTableRow[];
}

// ─── Static market-level symbols (same as MarketStrip) ────────────────────────
const MARKET_SYMBOLS: SymbolOption[] = [
  { ticker: '^NSEI',  label: 'NIFTY 50',  currency: '₹' },
  { ticker: '^BSESN', label: 'SENSEX',    currency: '₹' },
  { ticker: 'GC=F',   label: 'GOLD',      currency: '$' },
  { ticker: 'INR=X',  label: 'USD/INR',   currency: '₹' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISTTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  });
}

function fmtPrice(v: number, currency: string): string {
  const decimals = currency === '$' ? 2 : v > 1000 ? 2 : 4;
  return v.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Fetch chart data from Yahoo Finance via /yf proxy ───────────────────────
async function fetchStockData(
  ticker: string,
  range: '1d' | '5d',
): Promise<{ data: PricePoint[]; price: number; prevClose: number; changePct: number }> {
  const interval = range === '1d' ? '5m' : '30m';
  const encoded  = encodeURIComponent(ticker);
  const url      = `/yf/v8/finance/chart/${encoded}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${ticker}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const desc = json?.chart?.error?.description ?? 'no result block';
    throw new Error(`Yahoo Finance: ${desc}`);
  }

  const timestamps: number[]          = result.timestamp ?? [];
  const closes:     (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const data: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !isFinite(c)) continue;
    data.push({ time: toISTTime(timestamps[i]), price: Math.round(c * 100) / 100 });
  }

  if (data.length === 0) throw new Error('No candles in response (market may be closed)');

  const { regularMarketPrice, previousClose, chartPreviousClose } = result.meta as {
    regularMarketPrice: number;
    previousClose?: number;
    chartPreviousClose?: number;
  };
  const prev      = previousClose ?? chartPreviousClose ?? regularMarketPrice;
  const changePct = prev ? ((regularMarketPrice - prev) / prev) * 100 : 0;

  return { data, price: regularMarketPrice, prevClose: prev, changePct };
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label, color, currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  color: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D0D0F',
      border: `1px solid ${color}40`,
      borderRadius: 6,
      padding: '6px 11px',
      boxShadow: `0 0 12px ${color}20`,
    }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5A5A65', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color, fontWeight: 600 }}>
        {currency}{fmtPrice(payload[0].value, currency)}
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="chart-skeleton" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 12px' }}>
      {[60, 80, 45, 90, 55, 70].map((h, i) => (
        <div key={i} style={{
          height: `${h}%`,
          background: 'linear-gradient(90deg, #1a1a1e 25%, #252529 50%, #1a1a1e 75%)',
          backgroundSize: '200% 100%',
          borderRadius: 2,
          animation: 'shimmer 1.5s infinite',
          animationDelay: `${i * 0.1}s`,
          opacity: 0.4,
        }} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const INIT: ChartState = {
  data: [], price: null, prevClose: null, changePct: null,
  loading: true, errMsg: null, updatedAt: null,
};

export function StockChart({ rows }: Props) {
  // Build the full symbol list: market indices + spread table assets
  const allSymbols: SymbolOption[] = [
    ...MARKET_SYMBOLS,
    ...rows
      .filter(r => r.symbol)
      .map(r => ({
        ticker: `${r.symbol}.NS`,  // NSE-listed assets get .NS suffix on Yahoo Finance
        label: r.symbol,
        currency: '₹',
      }))
      // Deduplicate
      .filter((opt, idx, arr) => arr.findIndex(o => o.ticker === opt.ticker) === idx),
  ];

  const [selected, setSelected]   = useState<SymbolOption>(MARKET_SYMBOLS[0]);
  const [range, setRange]         = useState<'1d' | '5d'>('1d');
  const [state, setState]         = useState<ChartState>(INIT);
  const tabsRef                   = useRef<HTMLDivElement>(null);

  const load = useCallback(async (sym: SymbolOption, r: '1d' | '5d') => {
    setState(s => ({ ...s, loading: true, errMsg: null }));
    try {
      const result = await fetchStockData(sym.ticker, r);
      setState({ ...result, loading: false, errMsg: null, updatedAt: new Date() });
    } catch (e) {
      setState(s => ({ ...s, loading: false, errMsg: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  useEffect(() => {
    load(selected, range);
    const id = setInterval(() => load(selected, range), 60_000);
    return () => clearInterval(id);
  }, [selected, range, load]);

  // Scroll selected tab into view
  useEffect(() => {
    const active = tabsRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selected]);

  const { data, price, prevClose, changePct, loading, errMsg, updatedAt } = state;
  const isUp    = (changePct ?? 0) >= 0;
  const color   = isUp ? '#22C55E' : '#EF4444';
  const prices  = data.map(d => d.price);
  const minP    = prices.length ? Math.min(...prices) : 0;
  const maxP    = prices.length ? Math.max(...prices) : 0;
  const pad     = Math.max((maxP - minP) * 0.15, 20);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Symbol tabs ─────────────────────────────────────────────────────── */}
      <div
        ref={tabsRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px',
          borderBottom: '1px solid #252529',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}
        className="hide-scrollbar"
      >
        {allSymbols.map(sym => {
          const isActive = sym.ticker === selected.ticker;
          return (
            <button
              key={sym.ticker}
              data-active={isActive}
              onClick={() => setSelected(sym)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.06em',
                padding: '3px 9px',
                borderRadius: 4,
                border: isActive ? `1px solid ${color}60` : '1px solid #252529',
                background: isActive ? `${color}15` : 'transparent',
                color: isActive ? color : '#5A5A65',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              {sym.label}
            </button>
          );
        })}
      </div>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 44,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 14px',
        borderBottom: '1px solid #1a1a1e',
        background: 'linear-gradient(90deg, #0D0D0F 0%, #141417 100%)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#5A5A65', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {selected.label}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {price !== null ? (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: '#E8E8EC' }}>
                {selected.currency}{fmtPrice(price, selected.currency)}
              </span>
            ) : (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, color: '#3a3a42' }}>—</span>
            )}
            {changePct !== null && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                fontWeight: 600,
                color,
                background: `${color}15`,
                padding: '1px 6px',
                borderRadius: 3,
                border: `1px solid ${color}30`,
              }}>
                {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {prevClose !== null && (
          <div style={{ marginLeft: 4 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#3a3a42', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prev Close</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5A5A65' }}>
              {selected.currency}{fmtPrice(prevClose, selected.currency)}
            </div>
          </div>
        )}

        {/* Range selector + refresh time — far right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['1d', '5d'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                letterSpacing: '0.06em',
                padding: '2px 7px',
                borderRadius: 3,
                border: range === r ? '1px solid #5A5A65' : '1px solid #252529',
                background: range === r ? '#252529' : 'transparent',
                color: range === r ? '#E8E8EC' : '#5A5A65',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {r.toUpperCase()}
            </button>
          ))}
          {updatedAt && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#3a3a42' }}>
              {loading ? 'refreshing…' : updatedAt.toLocaleTimeString('en-IN', { hour12: false })}
            </span>
          )}
        </div>
      </div>

      {/* ── Chart area ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {loading && data.length === 0 && <ChartSkeleton />}

        {errMsg && data.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#EF4444', textAlign: 'center', maxWidth: 280 }}>
              {errMsg}
            </span>
            <button
              onClick={() => load(selected, range)}
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5A5A65', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              retry
            </button>
          </div>
        )}

        {!loading && !errMsg && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 6, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id={`stockGrad-${selected.ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.25} />
                  <stop offset="60%"  stopColor={color} stopOpacity={0.06} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="time"
                tick={{ fill: '#5A5A65', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={48}
              />
              <YAxis
                domain={[minP - pad, maxP + pad]}
                tick={{ fill: '#5A5A65', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                tickLine={false}
                axisLine={false}
                width={66}
                tickFormatter={v => Math.round(v).toLocaleString('en-IN')}
              />
              <Tooltip content={<ChartTooltip color={color} currency={selected.currency} />} />

              {prevClose != null && (
                <ReferenceLine
                  y={prevClose}
                  stroke="#3a3a42"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
              )}

              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill={`url(#stockGrad-${selected.ticker})`}
                dot={false}
                activeDot={{ r: 4, fill: color, strokeWidth: 0, filter: `drop-shadow(0 0 4px ${color})` }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Stale refresh overlay */}
        {loading && data.length > 0 && (
          <div style={{
            position: 'absolute', top: 8, right: 10,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            color: '#5A5A65', letterSpacing: '0.06em',
          }}>
            refreshing…
          </div>
        )}
      </div>
    </div>
  );
}
