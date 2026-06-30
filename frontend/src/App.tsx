import { useState, useCallback, useEffect, useRef } from 'react';
import { useSpreads } from './hooks/useSpreads';
import { useSparklineBuffer } from './hooks/useSparklineBuffer';
import { SpreadTable } from './components/SpreadTable';
import { BasisChart } from './components/BasisChart';
import { LiveFeed } from './components/LiveFeed';
import { LoginPanel } from './components/LoginPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { MarketStrip } from './components/MarketStrip';
import { NiftyChart } from './components/NiftyChart';
import { StockChart } from './components/StockChart';
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

type RightPanel = 'chart' | 'alerts' | 'stocks';

export default function App() {
  const [authed, setAuthed]           = useState(() => !!localStorage.getItem('arb_token'));
  const [authToken, setToken]         = useState<string | null>(() => localStorage.getItem('arb_token'));
  const [selectedAsset, setSelected]  = useState<{ id: string; symbol: string } | null>(null);
  const [rightPanel, setRightPanel]   = useState<RightPanel>('chart');
  const clock                         = useClock();
  const _tick                         = useTimestampTick();

  const { rows, wsStatus, liveFeedEvents, isLoading, error, fetchHistory, setAuthToken }
    = useSpreads();

  const sparklines = useSparklineBuffer(rows);

  // ── Nifty chart drag-to-resize ────────────────────────────────────────────
  const [niftyHeight, setNiftyHeight] = useState(280);
  const isDragging   = useRef(false);
  const dragStartY   = useRef(0);
  const dragStartH   = useRef(0);

  const onDragHandleDown = useCallback((e: React.MouseEvent) => {
    isDragging.current  = true;
    dragStartY.current  = e.clientY;
    dragStartH.current  = niftyHeight;
    e.preventDefault();
  }, [niftyHeight]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const delta = dragStartY.current - e.clientY;
      setNiftyHeight(Math.max(120, Math.min(560, dragStartH.current + delta)));
    }
    function onUp() { isDragging.current = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  // ── 401 auto-logout ──────────────────────────────────────────────────────
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
    setRightPanel('chart');
  }, []);

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (!authed) return <LoginPanel onLogin={handleLogin} />;

  const hasRightPanel = selectedAsset || rightPanel === 'alerts' || rightPanel === 'stocks';

  // WS status style
  const wsStyle = wsStatus === 'connected'
    ? { dotClass: 'live-dot', label: 'LIVE' }
    : wsStatus === 'connecting'
    ? { dotClass: 'live-dot amber', label: 'CONNECTING' }
    : { dotClass: 'live-dot red',   label: 'OFFLINE' };

  // ── Main terminal layout ──────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden"
      style={{ background: '#080810', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Market Overview Strip ─────────────────────────────────────────── */}
      <MarketStrip />

      {/* ── Top chrome bar ────────────────────────────────────────────────── */}
      <header
        className="flex items-center px-4 border-b"
        style={{
          height: 40,
          flexShrink: 0,
          borderColor: '#1a1a1e',
          background: 'linear-gradient(90deg, #0A0A12 0%, #0D0D0F 100%)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4,
            background: 'linear-gradient(135deg, #3B82F6 0%, #1d4ed8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 8px rgba(59,130,246,0.4)',
          }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0 }}>
              A
            </span>
          </div>
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #E8E8EC 0%, #5A5A65 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            ARB
          </span>
        </div>

        <span style={{ color: '#252529', margin: '0 4px' }}>│</span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#3a3a42', marginRight: 16 }}>
          Real-time Arbitrage Monitor
        </span>

        {/* Nav tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', marginLeft: 4 }}>
          <button
            onClick={() => setRightPanel('chart')}
            className={`nav-tab ${rightPanel === 'chart' ? 'active-chart' : ''}`}
          >
            Chart
          </button>
          <button
            onClick={() => setRightPanel('alerts')}
            className={`nav-tab ${rightPanel === 'alerts' ? 'active-alerts' : ''}`}
          >
            Alerts
          </button>
          <button
            onClick={() => setRightPanel('stocks')}
            className={`nav-tab ${rightPanel === 'stocks' ? 'active-stocks' : ''}`}
          >
            Stocks
          </button>
        </div>

        <span style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
          {/* WS status */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={wsStyle.dotClass} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#5A5A65', letterSpacing: '0.08em' }}>
              {wsStyle.label}
            </span>
          </span>

          {/* Clock */}
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.7rem', color: '#5A5A65', letterSpacing: '0.04em' }}>
            {clock} <span style={{ color: '#3a3a42' }}>IST</span>
          </span>

          {/* Logout */}
          <button
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.6rem', letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#3a3a42', background: 'none',
              border: 'none', cursor: 'pointer', transition: 'color 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a42')}
            onClick={handleLogout}
          >
            Disconnect
          </button>
        </span>
      </header>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left column: SpreadTable + Nifty Chart ────────────────────── */}
        <div
          className="flex flex-col"
          style={{
            width: hasRightPanel ? '52%' : '100%',
            flexShrink: 0,
            borderRight: '1px solid #1a1a1e',
            transition: 'width 0.2s ease',
          }}
        >
          {/* SpreadTable */}
          <div className="flex flex-col flex-1 min-h-0">
            <div className="panel-header">
              <span className={`dot ${wsStatus !== 'connected' ? 'offline' : ''}`} />
              SPREAD MONITOR
              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', letterSpacing: '0.06em' }}>
                {rows.length} instruments
              </span>
              {isLoading && (
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', marginLeft: 8 }}>
                  loading…
                </span>
              )}
            </div>

            {error && error !== 'Unauthorized' && (
              <div style={{ padding: '6px 12px', fontSize: '0.7rem', borderBottom: '1px solid #1a1a1e', fontFamily: 'JetBrains Mono', color: '#EF4444' }}>
                ⚠ {error}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-auto">
              <SpreadTable
                rows={rows}
                onSelectAsset={handleSelectAsset}
                selectedAssetId={selectedAsset?.id ?? null}
                sparklines={sparklines}
                tick={_tick}
              />
            </div>
          </div>

          {/* ── Drag handle — grab to resize Nifty chart ──────────────── */}
          <div
            onMouseDown={onDragHandleDown}
            title="Drag to resize"
            style={{
              height: 10,
              flexShrink: 0,
              cursor: 'ns-resize',
              background: 'transparent',
              borderTop: '1px solid #1a1a1e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 1.5, background: '#252529', borderRadius: 1 }} />
              ))}
            </div>
          </div>

          {/* Nifty Chart */}
          <div style={{ height: niftyHeight, flexShrink: 0 }}>
            <div className="panel-header" style={{ borderTop: 'none' }}>
              <span className="dot" style={{ background: '#22C55E' }} />
              NIFTY 50
              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', letterSpacing: '0.06em' }}>
                ^NSEI · 5m · auto-refresh
              </span>
            </div>
            <div style={{ height: `calc(100% - 30px)` }}>
              <NiftyChart />
            </div>
          </div>
        </div>

        {/* ── Right column: Chart / Alerts / Stocks ─────────────────────── */}
        {hasRightPanel && (
          <div className="flex flex-col flex-1 min-w-0 min-h-0" style={{ animation: 'fadeIn 0.2s ease-out forwards' }}>

            {rightPanel === 'alerts' ? (
              // ── Alerts panel ────────────────────────────────────────────
              <>
                <div className="panel-header" style={{ borderBottom: '1px solid #1a1a1e' }}>
                  <span className="dot" style={{ background: '#F59E0B', boxShadow: '0 0 6px rgba(245,158,11,0.5)', animation: 'alertGlow 2s ease-in-out infinite' }} />
                  ACTIVE ALERTS
                  <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', letterSpacing: '0.06em' }}>
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

            ) : rightPanel === 'stocks' ? (
              // ── Stock Charts panel ───────────────────────────────────────
              <>
                <div className="panel-header" style={{ borderBottom: '1px solid #1a1a1e' }}>
                  <span className="dot" style={{ background: '#3B82F6', boxShadow: '0 0 6px rgba(59,130,246,0.5)' }} />
                  STOCK CHARTS
                  <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', letterSpacing: '0.06em' }}>
                    Yahoo Finance · 5m candles
                  </span>
                </div>
                <div className="flex-1 min-h-0">
                  <StockChart rows={rows} />
                </div>
              </>

            ) : selectedAsset ? (
              // ── BasisChart + LiveFeed split ──────────────────────────────
              <>
                {/* BasisChart — top 60% */}
                <div className="panel-header" style={{ borderBottom: '1px solid #1a1a1e' }}>
                  <span className="dot" style={{ background: '#E8A027', boxShadow: '0 0 6px rgba(232,160,39,0.4)' }} />
                  BASIS CHART
                  <span style={{ marginLeft: 8, fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#5A5A65', fontWeight: 400 }}>
                    {selectedAsset.symbol}
                  </span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', letterSpacing: '0.06em' }}>
                    30d spread history
                  </span>
                </div>
                <div style={{ flex: '0 0 60%', minHeight: 0 }}>
                  <BasisChart
                    assetId={selectedAsset.id}
                    symbol={selectedAsset.symbol}
                    fetchHistory={fetchHistory}
                  />
                </div>

                {/* LiveFeed — bottom 40% */}
                <div style={{ flex: '0 0 40%', minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid #1a1a1e' }}>
                  <div className="panel-header" style={{ borderBottom: '1px solid #1a1a1e' }}>
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

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <footer
        style={{
          height: 24,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          borderTop: '1px solid #1a1a1e',
          background: 'linear-gradient(90deg, #0A0A12 0%, #0D0D0F 100%)',
        }}
      >
        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#3a3a42', letterSpacing: '0.05em' }}>
          NSE · Market data 15s delayed · Spreads in basis points · Click row to open chart
        </span>
        {selectedAsset && rightPanel === 'chart' && (
          <span style={{ marginLeft: 16, fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#5A5A65', letterSpacing: '0.05em' }}>
            ▶ {selectedAsset.symbol}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono', fontSize: '0.6rem', color: '#252529', letterSpacing: '0.05em' }}>
          ARB v2
        </span>
      </footer>
    </div>
  );
}