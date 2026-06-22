import { useState, useCallback, useEffect } from 'react';
import { useSpreads } from './hooks/useSpreads';
import { useSparklineBuffer } from './hooks/useSparklineBuffer';
import { SpreadTable } from './components/SpreadTable';
import { BasisChart } from './components/BasisChart';
import { LiveFeed } from './components/LiveFeed';
import { LoginPanel } from './components/LoginPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { MarketStrip } from './components/MarketStrip';
import { NewsPanel } from './components/NewsPanel';
import './index.css';

// ─── Clock hook ───────────────────────────────────────────────────────────────
function useClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('en-IN', { hour12: false })
  );
  useEffect(() => {
    const id = setInterval(() =>
      setTime(new Date().toLocaleTimeString('en-IN', { hour12: false })), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// ─── Timestamp tick (forces relative-time recompute every 5s) ────────────────
function useTimestampTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

type RightPanel = 'chart' | 'alerts' | 'news';

export default function App() {
  const [authed, setAuthed]           = useState(() => !!localStorage.getItem('arb_token'));
  const [authToken, setToken]         = useState<string | null>(() => localStorage.getItem('arb_token'));
  const [selectedAsset, setSelected]  = useState<{ id: string; symbol: string } | null>(null);
  const [rightPanel, setRightPanel]   = useState<RightPanel>('chart');
  const clock                         = useClock();
  const _tick                         = useTimestampTick(); // triggers re-renders for "Xs ago" labels

  const { rows, wsStatus, liveFeedEvents, isLoading, error, fetchHistory, setAuthToken }
    = useSpreads();

  // ── Sparkline rolling buffers (persists across SpreadTable re-renders) ──
  const sparklines = useSparklineBuffer(rows);

  // ── 401 auto-logout ─────────────────────────────────────────────────────
  // When a token expires, apiFetch throws 'Unauthorized'. We surface that here
  // so the app snaps back to the login screen instead of silently breaking.
  useEffect(() => {
    if (error === 'Unauthorized') {
      handleLogout();
    }
  }, [error]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('arb_token');
    setToken(null);
    setAuthed(false);
  }, []);

  const handleLogin = useCallback((token: string) => {
    setToken(token);
    setAuthToken(token);
    setAuthed(true);
  }, [setAuthToken]);

  const handleSelectAsset = useCallback((id: string, symbol: string) => {
    setSelected(prev => prev?.id === id ? null : { id, symbol });
    setRightPanel('chart'); // clicking a row always opens chart first
  }, []);

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!authed) return <LoginPanel onLogin={handleLogin} />;

  const hasRightPanel = selectedAsset || rightPanel === 'alerts' || rightPanel === 'news';

  // ── Main terminal layout ───────────────────────────────────────────────────
  return (
    <div
      className="h-screen w-screen flex flex-col bg-surface overflow-hidden"
      style={{ fontFamily: 'system-ui, Segoe UI, sans-serif' }}
    >
      {/* ── Market Overview Strip ───────────────────────────────────────── */}
      <MarketStrip />

      {/* ── Top chrome bar ──────────────────────────────────────────────── */}
      <header className="flex items-center px-4 border-b border-border bg-panel"
              style={{ height: 36, flexShrink: 0 }}>
        <span className="data text-xs text-text font-semibold tracking-widest mr-4">
          ARB
        </span>
        <span className="text-border mx-1.5">│</span>
        <span className="font-sans text-xs text-muted uppercase tracking-widest">
          Real-time Arbitrage Monitor
        </span>

        {/* Nav tabs */}
        <div className="flex items-center gap-0 ml-6">
          <button
            onClick={() => setRightPanel('chart')}
            className={`font-sans text-xs px-3 py-1 uppercase tracking-widest border-b-2 ${
              rightPanel === 'chart'
                ? 'border-text text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setRightPanel('alerts')}
            className={`font-sans text-xs px-3 py-1 uppercase tracking-widest border-b-2 ${
              rightPanel === 'alerts'
                ? 'border-amber text-amber'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Alerts
          </button>
          <button
            onClick={() => setRightPanel('news')}
            className={`font-sans text-xs px-3 py-1 uppercase tracking-widest border-b-2 ${
              rightPanel === 'news'
                ? 'border-[#60A5FA] text-[#60A5FA]'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            News
          </button>
        </div>

        <span className="ml-auto flex items-center gap-4">
          {/* WS status */}
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${
              wsStatus === 'connected'  ? 'bg-flux-pos' :
              wsStatus === 'connecting' ? 'bg-amber' :
              'bg-flux-neg'
            }`} />
            <span className="data text-2xs text-muted">
              {wsStatus.toUpperCase()}
            </span>
          </span>

          {/* Clock */}
          <span className="data text-xs text-muted">{clock} IST</span>

          {/* Logout */}
          <button
            className="font-sans text-2xs text-muted hover:text-flux-neg uppercase tracking-widest"
            onClick={handleLogout}
          >
            Disconnect
          </button>
        </span>
      </header>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* Left: SpreadTable */}
        <div
          className="flex flex-col border-r border-border"
          style={{ width: hasRightPanel ? '52%' : '100%', flexShrink: 0 }}
        >
          <div className="panel-header">
            <span className={`dot ${wsStatus !== 'connected' ? 'offline' : ''}`} />
            SPREAD MONITOR
            <span className="ml-auto data text-2xs text-muted">
              {rows.length} instruments
            </span>
            {isLoading && (
              <span className="data text-2xs text-muted ml-2">loading…</span>
            )}
          </div>

          {error && error !== 'Unauthorized' && (
            <div className="px-3 py-2 border-b border-border data text-xs text-flux-neg">
              ⚠ {error}
            </div>
          )}

          {/* Pass tick (not key) so SpreadTable re-renders timestamps in-place
              without remounting — preserves sort state and sparkline buffer refs */}
          <SpreadTable
            rows={rows}
            onSelectAsset={handleSelectAsset}
            selectedAssetId={selectedAsset?.id ?? null}
            sparklines={sparklines}
            tick={_tick}
          />
        </div>

        {/* Right: Chart + Feed  OR  Alerts */}
        {hasRightPanel && (
          <div className="flex flex-col flex-1 min-w-0 min-h-0">

            {rightPanel === 'alerts' ? (
              // ── Alerts panel ─────────────────────────────────────────────
              <>
                <div className="panel-header border-b border-border">
                  <span className="dot" style={{ background: '#F59E0B' }} />
                  ACTIVE ALERTS
                  <span className="ml-auto data text-2xs text-muted">
                    |z| &gt; {2.0}σ threshold
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <AlertsPanel
                    authToken={authToken}
                    onAuthExpired={handleLogout}
                  />
                </div>
              </>
            ) : rightPanel === 'news' ? (
              // ── News panel ─────────────────────────────────────────────
              <>
                <div className="panel-header border-b border-border">
                  <span className="dot" style={{ background: '#60A5FA' }} />
                  MARKETS NEWS
                  <span className="ml-auto data text-2xs text-muted">
                    CNBC Finance · 5m refresh
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <NewsPanel />
                </div>
              </>
            ) : selectedAsset ? (
              // ── Chart + Feed split ────────────────────────────────────────
              <>
                {/* BasisChart — top 60% */}
                <div className="panel-header border-b border-border">
                  <span className="dot" style={{ background: '#E8A027' }} />
                  BASIS CHART
                  <span className="ml-auto data text-2xs text-muted">30d spread history</span>
                </div>
                <div style={{ flex: '0 0 60%', minHeight: 0 }}>
                  <BasisChart
                    assetId={selectedAsset.id}
                    symbol={selectedAsset.symbol}
                    fetchHistory={fetchHistory}
                  />
                </div>

                {/* LiveFeed — bottom 40% */}
                <div style={{ flex: '0 0 40%', minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid #252529' }}>
                  <div className="panel-header border-b border-border">
                    <span className={`dot ${wsStatus !== 'connected' ? 'offline' : ''}`} />
                    LIVE FEED
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <LiveFeed events={liveFeedEvents} wsStatus={wsStatus} />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <footer className="flex items-center px-4 border-t border-border bg-panel"
              style={{ height: 24, flexShrink: 0 }}>
        <span className="data text-2xs text-muted">
          NSE · Market data 15s delayed · Spreads in basis points · Click row to open chart
        </span>
        {selectedAsset && rightPanel === 'chart' && (
          <span className="ml-4 data text-2xs text-text">
            ▶ {selectedAsset.symbol}
          </span>
        )}
      </footer>
    </div>
  );
}
