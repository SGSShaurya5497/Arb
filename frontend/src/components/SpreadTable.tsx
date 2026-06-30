import { useState, useMemo } from 'react';
import type { SpreadTableRow } from '../types/spread';
import { getZScoreTier } from '../types/spread';
import { Sparkline } from './Sparkline';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatBps(v: number | null): string {
  if (v === null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}

function formatZ(v: number | null): string {
  if (v === null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(3);
}

function relativeTime(d: Date | null): string {
  if (!d) return '—';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

type SortKey = 'symbol' | 'assetType' | 'exchange' | 'spreadBps' | 'zScore' | 'capturedAt';
type SortDir = 'asc' | 'desc';

// ─── Z-Score cell colors ─────────────────────────────────────────────────────
const TIER_STYLES: Record<string, React.CSSProperties> = {
  'strong-pos': { color: '#22C55E', fontWeight: 600 },
  'strong-neg': { color: '#EF4444', fontWeight: 600 },
  'warning':    { color: '#F59E0B' },
  'neutral':    { color: '#E8E8EC' },
};

// ─── Sort indicator ───────────────────────────────────────────────────────────
function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ color: '#252529', marginLeft: 4, fontSize: '0.6rem' }}>⇅</span>;
  return <span style={{ color: '#5A5A65', marginLeft: 4, fontSize: '0.6rem' }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

interface Props {
  rows:            SpreadTableRow[];
  onSelectAsset:   (assetId: string, symbol: string) => void;
  selectedAssetId: string | null;
  sparklines:      Map<string, number[]>;
  tick:            number;
}

export function SpreadTable({ rows, onSelectAsset, selectedAssetId, sparklines, tick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  void tick;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let va: string | number | null;
      let vb: string | number | null;
      switch (sortKey) {
        case 'symbol':     va = a.symbol;     vb = b.symbol; break;
        case 'assetType':  va = a.assetType;  vb = b.assetType; break;
        case 'exchange':   va = a.exchange;   vb = b.exchange; break;
        case 'spreadBps':  va = a.spreadBps;  vb = b.spreadBps; break;
        case 'zScore':     va = a.zScore;     vb = b.zScore; break;
        case 'capturedAt': va = a.capturedAt?.getTime() ?? null; vb = b.capturedAt?.getTime() ?? null; break;
        default: return 0;
      }
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === 'string'
        ? va.localeCompare(vb as string)
        : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function col(key: SortKey, label: string) {
    return (
      <th className="sortable" onClick={() => handleSort(key)}>
        {label}<SortArrow active={sortKey === key} dir={sortDir} />
      </th>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'auto' }}>
      <table>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr>
            {col('symbol',    'Symbol')}
            <th style={{ width: 96 }}>Trend</th>
            {col('assetType', 'Type')}
            {col('exchange',  'Exchange')}
            {col('spreadBps', 'Spread (bps)')}
            {col('zScore',    'Z-Score')}
            {col('capturedAt','Updated')}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#3a3a42', padding: '32px 0', fontFamily: 'JetBrains Mono', fontSize: '0.7rem' }}>
                No data — collector may not be running
              </td>
            </tr>
          )}
          {sorted.map(row => {
            const tier = getZScoreTier(row.zScore);
            const isSelected = row.assetId === selectedAssetId;
            const bpsStyle: React.CSSProperties = row.spreadBps !== null
              ? { color: row.spreadBps > 0 ? '#22C55E' : row.spreadBps < 0 ? '#EF4444' : '#E8E8EC' }
              : { color: '#3a3a42' };

            const sparkPoints = sparklines.get(row.assetId) ?? [];

            return (
              <tr
                key={row.assetId}
                className={[
                  'cursor-pointer',
                  isSelected ? 'row-selected' : '',
                  row.isFlashing ? 'flash-row' : '',
                ].join(' ')}
                onClick={() => onSelectAsset(row.assetId, row.symbol)}
                style={{ transition: 'background 0.1s ease' }}
              >
                {/* Symbol */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono',
                      fontWeight: 500,
                      color: isSelected ? '#3B82F6' : '#E8E8EC',
                      fontSize: '0.8125rem',
                      letterSpacing: '0.04em',
                      transition: 'color 0.15s ease',
                    }}>
                      {row.symbol}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: '0.55rem', color: '#3B82F6' }}>▶</span>
                    )}
                  </div>
                </td>

                {/* Sparkline */}
                <td style={{ padding: '3px 10px', lineHeight: 0 }}>
                  <Sparkline
                    points={sparkPoints}
                    currentValue={row.spreadBps}
                  />
                </td>

                {/* Type */}
                <td style={{ fontFamily: 'Inter, sans-serif', color: '#5A5A65', fontSize: '0.72rem' }}>
                  {row.assetType}
                </td>

                {/* Exchange */}
                <td>
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    color: '#3a3a42',
                    fontSize: '0.65rem',
                    border: '1px solid #1e1e24',
                    padding: '1px 5px',
                    borderRadius: 3,
                    letterSpacing: '0.04em',
                  }}>
                    {row.exchange}
                  </span>
                </td>

                {/* Spread bps */}
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem', ...bpsStyle }}>
                  {formatBps(row.spreadBps)}
                </td>

                {/* Z-Score */}
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8125rem', ...TIER_STYLES[tier] }}>
                  {formatZ(row.zScore)}
                </td>

                {/* Last updated */}
                <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.65rem', color: '#3a3a42' }}>
                  {relativeTime(row.capturedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
