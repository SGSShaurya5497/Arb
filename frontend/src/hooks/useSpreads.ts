import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CurrentSpreadRow,
  SpreadTableRow,
  WsTickPayload,
  SpreadHistoryPoint,
  PaginatedResponse,
  SpreadRecord,
} from '../types/spread';
import { useWebSocket } from './useWebSocket';

// ─── API base ─────────────────────────────────────────────────────────────────
// In dev, Vite proxies /api → localhost:8000 (configured in vite.config.ts)
const API = '/api/v1';

// How long (ms) a row keeps the .flash-row class — must match the CSS keyframe
const FLASH_DURATION_MS = 320;

// ─── Helper ────────────────────────────────────────────────────────────────────
function parseRow(row: CurrentSpreadRow): SpreadTableRow {
  const s = row.latest_spread;
  return {
    assetId:    row.asset.id,
    symbol:     row.asset.symbol,
    assetType:  row.asset.asset_type,
    exchange:   row.asset.exchange_primary,
    spreadBps:  s ? parseFloat(s.spread_bps) : null,
    zScore:     s ? parseFloat(s.z_score) : null,
    capturedAt: s ? new Date(s.captured_at) : null,
    isFlashing: false,
  };
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
// A minimal token store. In a real product use a proper auth context.
let _authToken: string | null = localStorage.getItem('arb_token');

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: _authToken ? { Authorization: `Bearer ${_authToken}` } : {},
  });
  if (res.status === 401) {
    // Token expired or missing — reset and prompt user
    _authToken = null;
    localStorage.removeItem('arb_token');
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSpreadsReturn {
  rows: SpreadTableRow[];
  wsStatus: WsConnectionStatus;
  liveFeedEvents: WsTickPayload[];
  isLoading: boolean;
  error: string | null;
  fetchHistory: (assetId: string, days?: number) => Promise<SpreadHistoryPoint[]>;
  setAuthToken: (token: string) => void;
}

export function useSpreads(): UseSpreadsReturn {
  const [rows, setRows]               = useState<SpreadTableRow[]>([]);
  const [wsStatus, setWsStatus]       = useState<WsConnectionStatus>('connecting');
  const [liveFeedEvents, setFeedEvts] = useState<WsTickPayload[]>([]);
  const [isLoading, setLoading]       = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // rowsRef lets the WS callback read the latest rows without stale closure issues
  const rowsRef = useRef<SpreadTableRow[]>([]);
  rowsRef.current = rows;

  // Flash timers keyed by assetId — clear on unmount
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Initial REST fetch ────────────────────────────────────────────────────
  const fetchCurrent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<CurrentSpreadRow[]>('/spreads/current');
      const parsed = data.map(parseRow);
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spreads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCurrent(); }, [fetchCurrent]);

  // ── WebSocket handler ──────────────────────────────────────────────────────
  const handleWsMessage = useCallback((msg: WsTickPayload) => {
    // Push to live feed (keep last 10)
    setFeedEvts(prev => [msg, ...prev].slice(0, 10));

    // Update the matching row by symbol
    setRows(prev => {
      const next = prev.map(row => {
        if (row.symbol !== msg.symbol) return row;

        // Schedule removal of flash class
        const existing = flashTimers.current.get(row.assetId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setRows(r => r.map(x => x.assetId === row.assetId ? { ...x, isFlashing: false } : x));
          flashTimers.current.delete(row.assetId);
        }, FLASH_DURATION_MS);
        flashTimers.current.set(row.assetId, timer);

        return {
          ...row,
          spreadBps:  msg.spread_bps  ? parseFloat(msg.spread_bps)  : row.spreadBps,
          zScore:     msg.z_score     ? parseFloat(msg.z_score)     : row.zScore,
          capturedAt: msg.captured_at ? new Date(msg.captured_at)   : row.capturedAt,
          isFlashing: true,
        };
      });
      return next;
    });
  }, []);

  useWebSocket({
    onMessage: handleWsMessage as (msg: import('../types/spread').WsMessage) => void,
    onStatusChange: setWsStatus,
  });

  // Cleanup flash timers
  useEffect(() => {
    const timers = flashTimers.current;
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, []);

  // ── History fetch ─────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (assetId: string, days = 30): Promise<SpreadHistoryPoint[]> => {
    const data = await apiFetch<PaginatedResponse<SpreadRecord>>(
      `/spreads/${assetId}/history?days=${days}&page_size=100`
    );
    return data.items.map(item => ({
      capturedAt: new Date(item.captured_at),
      spreadBps:  parseFloat(item.spread_bps),
      zScore:     parseFloat(item.z_score),
    })).reverse(); // API returns newest-first; chart needs oldest-first
  }, []);

  // ── Token setter (for auth UI) ────────────────────────────────────────────
  const setAuthToken = useCallback((token: string) => {
    _authToken = token;
    localStorage.setItem('arb_token', token);
    fetchCurrent(); // reload after login
  }, [fetchCurrent]);

  return { rows, wsStatus, liveFeedEvents, isLoading, error, fetchHistory, setAuthToken };
}
