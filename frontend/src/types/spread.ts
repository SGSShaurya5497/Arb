// ─── Core Domain Types ────────────────────────────────────────────────────────
// These mirror the FastAPI backend schemas exactly.
// Numeric fields that come as Decimal strings from the DB are typed as string
// here and parsed to number on the client where needed.

export interface Asset {
  id: string;           // UUID
  symbol: string;       // e.g. "NIFTYBEES"
  name: string;
  asset_type: string;   // e.g. "ETF"
  exchange_primary: string; // e.g. "NSE"
}

export interface SpreadRecord {
  id: number;
  asset_id: string;
  spread_type: string | null;
  spread_bps: string;   // Decimal from Postgres, arrives as string
  z_score: string;      // Decimal from Postgres, arrives as string
  captured_at: string;  // ISO-8601 UTC
}

// The response from GET /api/v1/spreads/current — one entry per asset
export interface CurrentSpreadRow {
  asset: Asset;
  latest_spread: SpreadRecord | null;
}

// Parsed/computed version used inside the UI
export interface SpreadTableRow {
  assetId: string;
  symbol: string;
  assetType: string;
  exchange: string;
  spreadBps: number | null;
  zScore: number | null;
  capturedAt: Date | null;
  /** tracks if this row received a WS update recently — used for flash effect */
  isFlashing: boolean;
}

// ─── WebSocket Payload ────────────────────────────────────────────────────────
// Emitted by the Celery collector via Redis Stream → ws.py fan-out
export interface WsTickPayload {
  id: string;           // Redis stream entry ID e.g. "1718900000000-0"
  symbol: string;
  price: string;
  nav: string;
  exchange: string;
  spread_bps?: string;
  z_score?: string;
  captured_at?: string;
}

// A "ping" keepalive frame from the server
export interface WsPingPayload {
  type: 'ping';
}

export type WsMessage = WsTickPayload | WsPingPayload;

// ─── Paginated Response ───────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ─── Spread History (for BasisChart) ─────────────────────────────────────────
export interface SpreadHistoryPoint {
  capturedAt: Date;
  spreadBps: number;
  zScore: number;
}

// ─── Z-Score Severity Tier ───────────────────────────────────────────────────
export type ZScoreTier = 'neutral' | 'warning' | 'strong-pos' | 'strong-neg';

export function getZScoreTier(zScore: number | null): ZScoreTier {
  if (zScore === null) return 'neutral';
  const abs = Math.abs(zScore);
  if (abs > 3) return zScore > 0 ? 'strong-pos' : 'strong-neg';
  if (abs > 2) return 'warning';
  return 'neutral';
}
