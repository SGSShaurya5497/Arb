import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NewsItem {
  title:   string;
  link:    string;
  pubDate: string; // raw date string from feed
  source:  string; // feed/channel title
}

interface NewsState {
  items:       NewsItem[];
  loading:     boolean;
  unavailable: boolean;
  lastUpdated: Date | null;
}

// ─── Native JSON sources ───────────────────────────────────────────────────────
// We avoid RSS-to-JSON proxies (rss2json, allorigins) because they are frequently
// blocked by ad-blockers, brave shields, or rate-limited on local networks.
const SOURCES = [
  {
    label: 'Yahoo Finance',
    // Native Yahoo Finance Search API — returns JSON directly, CORS friendly.
    // Using query1 which we know works from useMarketStrip.ts without CORS issues.
    url: 'https://query1.finance.yahoo.com/v1/finance/search?q=india%20finance%20markets&quotesCount=0&newsCount=20',
    parse: parseYahooSearch,
  },
];

// ─── Parsers ─────────────────────────────────────────────────────────────────
interface YahooSearchResponse {
  news: Array<{
    title: string;
    link: string;
    publisher: string;
    providerPublishTime: number; // Unix timestamp in seconds
  }>;
}

function parseYahooSearch(json: unknown, fallbackLabel: string): NewsItem[] {
  const data = json as YahooSearchResponse;
  if (!Array.isArray(data?.news)) return [];
  
  return data.news.map(item => ({
    title:   item.title?.trim() ?? '',
    link:    item.link ?? '#',
    // Convert Unix timestamp (seconds) to ISO string for relNewsTime
    pubDate: item.providerPublishTime ? new Date(item.providerPublishTime * 1000).toISOString() : '',
    // Use the actual publisher from the feed (e.g. "Bloomberg", "Reuters"), fallback to label
    source:  item.publisher?.trim() || fallbackLabel,
  })).filter(i => i.title.length > 0);
}

// ─── Relative time formatter ──────────────────────────────────────────────────
export function relNewsTime(dateStr: string): string {
  try {
    const d    = new Date(dateStr);
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (isNaN(secs) || secs < 0) return '';
    if (secs < 60)   return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  } catch {
    return '';
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export function useNewsPanel(): NewsState {
  const [state, setState] = useState<NewsState>({
    items:       [],
    loading:     true,
    unavailable: false,
    lastUpdated: null,
  });

  const fetchNews = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));

    let fetched: NewsItem[] = [];

    // Try each source in sequence; stop at the first that yields results.
    for (const src of SOURCES) {
      try {
        const res = await fetch(src.url, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const json = await res.json();
        const items = src.parse(json, src.label);
        if (items.length > 0) {
          fetched = items;
          break;
        }
      } catch {
        // Network error or timeout — try next source
        continue;
      }
    }

    setState({
      items:       fetched,
      loading:     false,
      unavailable: fetched.length === 0,
      lastUpdated: new Date(),
    });
  }, []);

  useEffect(() => {
    fetchNews();
    const id = setInterval(fetchNews, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  return state;
}
