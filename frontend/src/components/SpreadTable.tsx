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
const TIER_STYLES: Record<string, string> = {
  'strong-pos': 'text-flux-pos font-semibold',
  'strong-neg': 'text-flux-neg font-semibold',
  'warning':    'text-amber',
  'neutral':    'text-text',
};

// ─── Sort indicator ───────────────────────────────────────────────────────────
function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-border ml-1">⇅</span>;
  return <span className="text-text ml-1">{dir === 'asc' ? '↑' : '↓'}</span>;
}

interface Props {
  rows:            SpreadTableRow[];
  onSelectAsset:   (assetId: string, symbol: string) => void;
  selectedAssetId: string | null;
  sparklines:      Map<string, number[]>;  // assetId → rolling buffer
  tick:            number;                 // forces timestamp recompute without remounting
}

export function SpreadTable({ rows, onSelectAsset, selectedAssetId, sparklines, tick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // tick is read here so React sees it as a used dep and re-renders the component
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
    <div className="h-full overflow-auto">
      <table>
        <thead className="sticky top-0 bg-panel z-10">
          <tr>
            {col('symbol',    'Symbol')}
            {/* Sparkline column — no sort, fixed width */}
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
              <td colSpan={7} className="text-center text-muted py-8">
                No data — collector may not be running
              </td>
            </tr>
          )}
          {sorted.map(row => {
            const tier = getZScoreTier(row.zScore);
            const isSelected = row.assetId === selectedAssetId;
            const bpsColor = row.spreadBps !== null
              ? row.spreadBps > 0 ? 'text-flux-pos' : row.spreadBps < 0 ? 'text-flux-neg' : 'text-text'
              : 'text-muted';

            const sparkPoints = sparklines.get(row.assetId) ?? [];

            return (
              <tr
                key={row.assetId}
                className={[
                  'cursor-pointer transition-none',
                  isSelected ? 'bg-[rgba(255,255,255,0.04)]' : '',
                  row.isFlashing ? 'flash-row' : '',
                ].join(' ')}
                onClick={() => onSelectAsset(row.assetId, row.symbol)}
              >
                {/* Symbol */}
                <td>
                  <span className="data font-medium text-text text-sm tracking-wide">
                    {row.symbol}
                  </span>
                  {isSelected && (
                    <span className="ml-2 text-2xs text-muted font-sans">▶</span>
                  )}
                </td>

                {/* Sparkline */}
                <td style={{ padding: '3px 10px', lineHeight: 0 }}>
                  <Sparkline
                    points={sparkPoints}
                    currentValue={row.spreadBps}
                  />
                </td>

                {/* Type */}
                <td className="text-muted text-xs font-sans">{row.assetType}</td>

                {/* Exchange */}
                <td className="text-muted text-xs font-sans">{row.exchange}</td>

                {/* Spread bps */}
                <td className={`data text-sm ${bpsColor}`}>
                  {formatBps(row.spreadBps)}
                </td>

                {/* Z-Score */}
                <td className={`data text-sm ${TIER_STYLES[tier]}`}>
                  {formatZ(row.zScore)}
                </td>

                {/* Last updated — re-evaluates on every render (tick prop causes this) */}
                <td className="data text-xs text-muted">
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
