import { useRef, useEffect } from 'react';
import type { SpreadTableRow } from '../types/spread';

const BUFFER_SIZE = 20;

/**
 * Maintains a rolling buffer of the last 20 spread_bps values per asset,
 * fed by the existing SpreadTable rows (which update via WebSocket).
 *
 * Pattern: useRef-as-mutable-cache.
 *   - The returned Map is the same reference across renders.
 *   - We detect new data by comparing capturedAt timestamps.
 *   - When a row's timestamp advances, we push its new spread_bps.
 *   - SpreadTable reads from the Map on every render — no extra state needed.
 *
 * The hook is intentionally placed at App level so the buffer survives
 * SpreadTable remounts (e.g. if key changes elsewhere).
 */
export function useSparklineBuffer(rows: SpreadTableRow[]): Map<string, number[]> {
  // Mutable buffer: assetId → rolling array of spread_bps
  const bufferRef = useRef<Map<string, number[]>>(new Map());
  // Track last seen capturedAt per asset to detect new WS data
  const prevTsRef = useRef<Map<string, number>>(new Map());

  // Run on every render — no dep array because we want to catch every row update
  useEffect(() => {
    for (const row of rows) {
      if (row.spreadBps === null || row.capturedAt === null) continue;

      const ts  = row.capturedAt.getTime();
      const prev = prevTsRef.current.get(row.assetId) ?? 0;

      // Only append when timestamp is genuinely newer (new WS event arrived)
      if (ts > prev) {
        prevTsRef.current.set(row.assetId, ts);

        const buf = bufferRef.current.get(row.assetId) ?? [];
        buf.push(row.spreadBps);
        // Trim to last BUFFER_SIZE entries in-place
        if (buf.length > BUFFER_SIZE) buf.splice(0, buf.length - BUFFER_SIZE);
        bufferRef.current.set(row.assetId, [...buf]); // new array ref so Sparkline sees change
      }
    }
  });

  return bufferRef.current;
}
