import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Quote {
  symbol:      string;
  label:       string;
  price:       number | null;
  changePct:   number | null;
  currency:    string;
  unavailable: boolean;
}

// ─── Instruments to track ─────────────────────────────────────────────────────
const INSTRUMENTS = [
  { symbol: '^NSEI',  label: 'NIFTY 50',  currency: '₹' },
  { symbol: '^BSESN', label: 'SENSEX',    currency: '₹' },
  { symbol: 'GC=F',   label: 'GOLD',      currency: '$' },
  { symbol: 'INR=X',  label: 'USD/INR',   currency: '₹' },
] as const;

// ─── Fetch one symbol from Yahoo Finance public chart API ─────────────────────
async function fetchQuote(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    // Yahoo Finance public endpoint — works from browser without a proxy key.
    // We use a 1d range / 1d interval which returns just the current session data.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const json = await res.json() as {
      chart: {
        result: Array<{
          meta: {
            regularMarketPrice: number;
            previousClose:      number;
            chartPreviousClose: number;
          };
        }> | null;
        error: unknown;
      };
    };

    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const { regularMarketPrice, previousClose, chartPreviousClose } = result.meta;
    const prev   = previousClose ?? chartPreviousClose;
    const price  = regularMarketPrice;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;

    return { price, changePct };
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL_MS = 30_000; // 30 seconds

export function useMarketStrip() {
  const [quotes, setQuotes] = useState<Quote[]>(() =>
    INSTRUMENTS.map(i => ({
      symbol:      i.symbol,
      label:       i.label,
      currency:    i.currency,
      price:       null,
      changePct:   null,
      unavailable: false,
    }))
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const results = await Promise.all(
      INSTRUMENTS.map(async (inst) => {
        const data = await fetchQuote(inst.symbol);
        return {
          symbol:      inst.symbol,
          label:       inst.label,
          currency:    inst.currency,
          price:       data?.price      ?? null,
          changePct:   data?.changePct  ?? null,
          unavailable: data === null,
        };
      })
    );
    setQuotes(results);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { quotes, lastUpdated, refresh };
}
