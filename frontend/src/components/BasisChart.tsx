import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { SpreadHistoryPoint } from '../types/spread';

interface Props {
  assetId: string;
  symbol: string;
  fetchHistory: (assetId: string, days?: number) => Promise<SpreadHistoryPoint[]>;
}

const ACCENT = '#E8A027'; // deliberate amber-gold — not green or red, neutral analytical

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtBps(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(2) + ' bps';
}

// Custom tooltip — terminal aesthetic, no rounded-corner default
function TerminalTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-panel border border-border px-3 py-2 text-xs data shadow-none">
      <div className="text-muted mb-1 font-sans">{label}</div>
      <div className="text-text">{fmtBps(payload[0].value)}</div>
    </div>
  );
}

export function BasisChart({ assetId, symbol, fetchHistory }: Props) {
  const [data, setData]       = useState<SpreadHistoryPoint[]>([]);
  const [isLoading, setLoad]  = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [days, setDays]       = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoad(true);
    setError(null);
    fetchHistory(assetId, days)
      .then(pts => { if (!cancelled) setData(pts); })
      .catch(e  => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoad(false); });
    return () => { cancelled = true; };
  }, [assetId, days, fetchHistory]);

  // Compute ±2 std-dev reference lines from the data
  const { mean, sd2 } = useMemo(() => {
    if (data.length < 2) return { mean: 0, sd2: 0 };
    const vals = data.map(d => d.spreadBps);
    const avg  = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length;
    return { mean: avg, sd2: 2 * Math.sqrt(variance) };
  }, [data]);

  const chartData = data.map(d => ({
    date:  fmtDate(d.capturedAt),
    bps:   d.spreadBps,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header: days selector */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        <span className="text-muted text-xs font-sans uppercase tracking-widest">
          {symbol} / 30d basis
        </span>
        <div className="ml-auto flex gap-1">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={[
                'data text-xs px-2 py-0.5 border',
                days === d
                  ? 'border-text text-text bg-transparent'
                  : 'border-border text-muted hover:text-text hover:border-muted',
              ].join(' ')}
              style={{ borderRadius: 2 }}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 px-2 py-3">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            Loading…
          </div>
        )}
        {error && !isLoading && (
          <div className="flex items-center justify-center h-full text-flux-neg text-xs">
            {error}
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            No history — collector may not have run yet
          </div>
        )}
        {!isLoading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              {/* Thin charcoal grid — not the default Recharts light grey */}
              <CartesianGrid
                strokeDasharray="2 4"
                stroke="#252529"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: '#5A5A65' }}
                tickLine={false}
                axisLine={{ stroke: '#252529' }}
                interval="preserveStartEnd"
              />

              <YAxis
                tick={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: '#5A5A65' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
                width={52}
              />

              <Tooltip
                content={<TerminalTooltip />}
                cursor={{ stroke: '#252529', strokeWidth: 1 }}
              />

              {/* Zero baseline */}
              <ReferenceLine
                y={mean}
                stroke="#3a3a42"
                strokeDasharray="2 4"
                label={{ value: 'μ', fill: '#5A5A65', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />

              {/* +2σ */}
              {sd2 > 0 && (
                <ReferenceLine
                  y={mean + sd2}
                  stroke="#F59E0B"
                  strokeDasharray="3 5"
                  strokeOpacity={0.5}
                  label={{ value: '+2σ', fill: '#F59E0B', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                />
              )}

              {/* -2σ */}
              {sd2 > 0 && (
                <ReferenceLine
                  y={mean - sd2}
                  stroke="#F59E0B"
                  strokeDasharray="3 5"
                  strokeOpacity={0.5}
                  label={{ value: '-2σ', fill: '#F59E0B', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                />
              )}

              {/* Main spread line — amber-gold, not default blue */}
              <Line
                type="monotone"
                dataKey="bps"
                stroke={ACCENT}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 2, fill: ACCENT, stroke: 'none' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
