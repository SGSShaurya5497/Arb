import { useNewsPanel, relNewsTime } from '../hooks/useNewsPanel';

export function NewsPanel() {
  const { items, loading, unavailable, lastUpdated } = useNewsPanel();

  // ── Empty / loading / error states ──────────────────────────────────────
  if (loading && items.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-xs">
        Fetching headlines…
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1">
        <span className="data text-xs text-muted">Feed unavailable</span>
        <span className="font-sans text-2xs text-muted">
          Check network or CORS policy
        </span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Headline list ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item, i) => {
          const age = relNewsTime(item.pubDate);
          return (
            <a
              key={`${item.link}-${i}`}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-b border-[#1a1a1e] px-3 hover:bg-[rgba(255,255,255,0.025)] transition-none"
              style={{ textDecoration: 'none', minHeight: 48, paddingTop: 7, paddingBottom: 7 }}
            >
              {/* Top row: source + age */}
              <div className="flex items-center gap-2 mb-[3px]">
                {/* Source badge — same hairline badge style as exchange in LiveFeed */}
                <span
                  className="font-sans text-2xs text-muted border border-border px-1 shrink-0"
                  style={{ borderRadius: 1, lineHeight: '15px' }}
                >
                  {item.source}
                </span>
                {age && (
                  <span className="data text-2xs text-muted ml-auto shrink-0">
                    {age}
                  </span>
                )}
              </div>

              {/* Headline text */}
              <p
                className="font-sans text-xs text-text leading-snug"
                style={{
                  display:         '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow:        'hidden',
                }}
              >
                {item.title}
              </p>
            </a>
          );
        })}
      </div>

      {/* ── Footer bar — same pattern as LiveFeed status bar ─────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber shrink-0" />
        <span className="data text-2xs text-muted tracking-widest">
          MARKETS NEWS
        </span>
        {lastUpdated && (
          <span className="ml-auto data text-2xs text-muted">
            {lastUpdated.toLocaleTimeString('en-IN', { hour12: false })}
          </span>
        )}
        <span className="data text-2xs text-muted">
          {items.length} items · 5m refresh
        </span>
      </div>
    </div>
  );
}
