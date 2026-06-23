// src/components/NiftyChart.tsx
// Nifty 50 intraday area chart.
// Fetches via /yf proxy (Vite → Yahoo Finance server-side) — no CORS issues.
import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PricePoint {
  time:  string
  price: number
}

interface ChartState {
  data:       PricePoint[]
  price:      number | null
  prevClose:  number | null
  changePct:  number | null
  loading:    boolean
  errMsg:     string | null
  updatedAt:  Date | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toISTTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('en-IN', {
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
    timeZone: 'Asia/Kolkata',
  })
}

function fmtINR(v: number): string {
  return v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
// Goes through the Vite /yf proxy → query1.finance.yahoo.com (server-side, no CORS).
// range=5d gives the last 5 trading days of 5m candles so we always have data
// even on weekends / after market hours.
const CHART_URL = '/yf/v8/finance/chart/%5ENSEI?interval=5m&range=5d'

interface FetchResult {
  data:      PricePoint[]
  price:     number
  prevClose: number
  changePct: number
}

async function fetchNiftyData(): Promise<FetchResult> {
  const res = await fetch(CHART_URL, {
    headers: { Accept: 'application/json' },
    signal:  AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Yahoo Finance proxy`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json()
  const result = json?.chart?.result?.[0]

  if (!result) {
    const errDetail = json?.chart?.error?.description ?? 'no result block'
    throw new Error(`Yahoo Finance: ${errDetail}`)
  }

  const timestamps: number[]          = result.timestamp        ?? []
  const closes:     (number | null)[] = result.indicators?.quote?.[0]?.close ?? []

  // Filter out null / NaN candles (incomplete final candle, pre-market gaps)
  const data: PricePoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i]
    if (c == null || !isFinite(c)) continue
    data.push({ time: toISTTime(timestamps[i]), price: Math.round(c * 100) / 100 })
  }

  if (data.length === 0) {
    throw new Error('No price candles in response (market may be closed)')
  }

  const {
    regularMarketPrice,
    previousClose,
    chartPreviousClose,
  } = result.meta as {
    regularMarketPrice: number
    previousClose:      number | undefined
    chartPreviousClose: number | undefined
  }

  const prev      = previousClose ?? chartPreviousClose ?? regularMarketPrice
  const changePct = prev ? ((regularMarketPrice - prev) / prev) * 100 : 0

  return { data, price: regularMarketPrice, prevClose: prev, changePct }
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, label, color,
}: {
  active?:  boolean
  payload?: Array<{ value: number }>
  label?:   string
  color:    string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#141417', border: '1px solid #252529',
      borderRadius: 2, padding: '5px 9px',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5A5A65' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color }}>
        ₹{fmtINR(payload[0].value)}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
const INIT: ChartState = {
  data: [], price: null, prevClose: null, changePct: null,
  loading: true, errMsg: null, updatedAt: null,
}

export function NiftyChart() {
  const [state, setState] = useState<ChartState>(INIT)

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, errMsg: null }))
    try {
      const r = await fetchNiftyData()
      setState({
        ...r,
        loading:   false,
        errMsg:    null,
        updatedAt: new Date(),
      })
    } catch (e) {
      setState(s => ({
        ...s,
        loading: false,
        errMsg:  e instanceof Error ? e.message : String(e),
      }))
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)   // refresh every 60 s
    return () => clearInterval(id)
  }, [load])

  const { data, price, prevClose, changePct, loading, errMsg, updatedAt } = state
  const isUp    = (changePct ?? 0) >= 0
  const color   = isUp ? '#22C55E' : '#EF4444'
  const prices  = data.map(d => d.price)
  const minP    = prices.length ? Math.min(...prices) : 0
  const maxP    = prices.length ? Math.max(...prices) : 0
  const pad     = Math.max((maxP - minP) * 0.15, 20)

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading && data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5A5A65', letterSpacing: '0.1em' }}>
          LOADING…
        </span>
      </div>
    )
  }

  // ── Error state (shows message so we can debug) ───────────────────────────
  if (errMsg && data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 16px' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#EF4444', textAlign: 'center' }}>
          {errMsg}
        </span>
        <button
          onClick={load}
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5A5A65', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          retry
        </button>
      </div>
    )
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div style={{
        height: 28, flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: 10, padding: '0 12px', borderBottom: '1px solid #1a1a1e',
      }}>
        {price !== null && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: '#E8E8EC' }}>
            ₹{fmtINR(price)}
          </span>
        )}
        {changePct !== null && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color }}>
            {isUp ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        )}
        {prevClose !== null && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#5A5A65' }}>
            prev ₹{fmtINR(prevClose)}
          </span>
        )}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#5A5A65', marginLeft: 'auto' }}>
          {updatedAt?.toLocaleTimeString('en-IN', { hour12: false })} IST
          {loading && ' · refreshing…'}
        </span>
      </div>

      {/* ── Area Chart ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0}   />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="time"
              tick={{ fill: '#5A5A65', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[minP - pad, maxP + pad]}
              tick={{ fill: '#5A5A65', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={v => Math.round(v).toLocaleString('en-IN')}
            />

            <Tooltip content={<ChartTooltip color={color} />} />

            {/* Prev-close reference line */}
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
              strokeWidth={1.5}
              fill="url(#niftyGrad)"
              dot={false}
              activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}