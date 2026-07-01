import { useEffect } from 'react';

export function LearnPage() {
  // Simple scroll-to-top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const navigateTo = (path: string) => {
    window.dispatchEvent(new CustomEvent('navigate', { detail: path }));
  };

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden"
      style={{ background: '#080810', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* ── Top chrome bar (matching App.tsx) ─────────────────────────────── */}
      <header
        className="flex items-center px-4 border-b"
        style={{
          height: 40,
          flexShrink: 0,
          borderColor: '#1a1a1e',
          background: 'linear-gradient(90deg, #0A0A12 0%, #0D0D0F 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4,
            background: 'linear-gradient(135deg, #3B82F6 0%, #1d4ed8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 8px rgba(59,130,246,0.4)',
          }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700, color: '#fff' }}>
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
          Educational Resources
        </span>

        {/* Global Nav */}
        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', marginLeft: 4 }}>
          <button
            onClick={() => navigateTo('/')}
            className="nav-tab"
          >
            Dashboard
          </button>
          <button
            className="nav-tab active-alerts"
            style={{ color: '#E8A027', borderBottomColor: '#E8A027' }}
          >
            Learn
          </button>
        </div>
      </header>

      {/* ── Page Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-8" style={{ color: '#E8E8EC' }}>
        <div className="max-w-3xl mx-auto space-y-12 pb-16">
          
          <div className="space-y-4">
            <h1 style={{ color: '#E8A027', fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Understanding ETF Arbitrage
            </h1>
            <p style={{ color: '#5A5A65', fontSize: '1.1rem', lineHeight: 1.6 }}>
              A beginner-friendly guide to understanding spreads, Z-scores, and how the market corrects itself.
            </p>
          </div>

          {/* 1. What is this? */}
          <section className="space-y-4">
            <h2 style={{ color: '#E8A027', fontSize: '1.25rem', fontWeight: 500 }}>
              1. What is this?
            </h2>
            <div className="p-6 rounded border space-y-4" style={{ borderColor: '#1a1a1e', background: '#0A0A12' }}>
              <p style={{ lineHeight: 1.6 }}>
                Think of an ETF like a fruit basket. The <strong>NAV (Net Asset Value)</strong> is the actual cost of all the individual fruits inside the basket if you bought them directly from the farm. The <strong>Market Price</strong> is what people are currently paying for that pre-packaged basket on the store shelf.
              </p>
              <p style={{ lineHeight: 1.6 }}>
                Most of the time, the Market Price and the NAV are almost identical. But sometimes, due to sudden demand or panic, the price of the basket on the shelf can temporarily drift away from the actual cost of the fruits inside.
              </p>
              <p style={{ lineHeight: 1.6 }}>
                This difference is called the <strong>Spread</strong>. In finance, we measure this tiny gap in <em>basis points (bps)</em>. 
                <span style={{ fontFamily: 'JetBrains Mono', color: '#3B82F6', marginLeft: 8 }}>100 bps = 1.00%</span>.
              </p>
            </div>
          </section>

          {/* 2. How the system works */}
          <section className="space-y-4">
            <h2 style={{ color: '#E8A027', fontSize: '1.25rem', fontWeight: 500 }}>
              2. How the system works
            </h2>
            <div className="p-6 rounded border space-y-6" style={{ borderColor: '#1a1a1e', background: '#0A0A12' }}>
              <p style={{ lineHeight: 1.6 }}>
                Our system continuously monitors these price gaps in real-time. Here's the data pipeline:
              </p>
              
              <div className="flex flex-col gap-3 pl-4 border-l-2" style={{ borderColor: '#1a1a1e' }}>
                <div className="flex gap-4 items-center">
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#5A5A65' }}>01</span>
                  <span><strong>Collect:</strong> Fetch the latest Market Price and NAV for each ETF.</span>
                </div>
                <div className="flex gap-4 items-center">
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#5A5A65' }}>02</span>
                  <span><strong>Compute:</strong> Calculate the exact spread in basis points.</span>
                </div>
                <div className="flex gap-4 items-center">
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#5A5A65' }}>03</span>
                  <span><strong>Analyze:</strong> Calculate the <strong>Z-Score</strong> based on a 30-day rolling history.</span>
                </div>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: '#1a1a1e' }}>
                <h3 className="font-medium mb-2" style={{ color: '#E8E8EC' }}>What is a Z-Score?</h3>
                <p style={{ lineHeight: 1.6, color: '#A1A1AA' }}>
                  The Z-score tells us <em>how unusual</em> the current gap is compared to the ETF's normal behavior. 
                  A spread of <span style={{ fontFamily: 'JetBrains Mono' }}>20 bps</span> might be completely normal for one ETF (Z-score: 0.5), but a massive, rare anomaly for another highly liquid ETF (Z-score: 3.0).
                </p>
              </div>
            </div>
          </section>

          {/* 3. Strategy & Limitations */}
          <section className="space-y-4">
            <h2 style={{ color: '#E8A027', fontSize: '1.25rem', fontWeight: 500 }}>
              3. How can I actually use this?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Premium Card */}
              <div className="p-5 rounded border space-y-3" style={{ borderColor: '#1a1a1e', background: 'linear-gradient(180deg, rgba(34,197,94,0.03) 0%, rgba(10,10,18,1) 100%)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#22C55E' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }}></span>
                  Premium (Price &gt; NAV)
                </h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#A1A1AA' }}>
                  The ETF is trading <em>higher</em> than its underlying assets. Buyers are overpaying.
                </p>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <strong>Action:</strong> If you own this ETF, it might be a good time to sell and lock in the extra premium before the gap closes.
                </p>
              </div>

              {/* Discount Card */}
              <div className="p-5 rounded border space-y-3" style={{ borderColor: '#1a1a1e', background: 'linear-gradient(180deg, rgba(239,68,68,0.03) 0%, rgba(10,10,18,1) 100%)' }}>
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#EF4444' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }}></span>
                  Discount (Price &lt; NAV)
                </h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5, color: '#A1A1AA' }}>
                  The ETF is trading <em>lower</em> than its underlying assets. It's essentially on sale.
                </p>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <strong>Action:</strong> If you were planning to invest in this ETF anyway, buying now gives you a slight mathematical edge.
                </p>
              </div>
            </div>

            <div className="p-5 rounded border mt-4" style={{ borderColor: '#1a1a1e', background: '#0A0A12' }}>
              <h3 className="font-medium mb-3" style={{ color: '#E8E8EC' }}>Z-Score Reference</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div style={{ color: '#5A5A65', fontFamily: 'JetBrains Mono' }}>0.0 to 1.0</div>
                  <div style={{ color: '#A1A1AA' }}>Normal noise</div>
                </div>
                <div>
                  <div style={{ color: '#F59E0B', fontFamily: 'JetBrains Mono' }}>1.0 to 2.0</div>
                  <div style={{ color: '#A1A1AA' }}>Keep an eye</div>
                </div>
                <div>
                  <div style={{ color: '#F97316', fontFamily: 'JetBrains Mono' }}>2.0 to 3.0</div>
                  <div style={{ color: '#A1A1AA' }}>Unusual (Actionable)</div>
                </div>
                <div>
                  <div style={{ color: '#EF4444', fontFamily: 'JetBrains Mono' }}>&gt; 3.0</div>
                  <div style={{ color: '#A1A1AA' }}>Rare anomaly</div>
                </div>
              </div>
            </div>

            <div className="p-5 rounded border mt-4 space-y-2" style={{ borderColor: '#1a1a1e', background: 'rgba(239, 68, 68, 0.05)' }}>
              <h3 className="font-medium flex items-center gap-2" style={{ color: '#EF4444' }}>
                ⚠ Realistic Limitations
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm" style={{ color: '#A1A1AA' }}>
                <li><strong>Transaction Costs:</strong> Brokerage fees, STT, and slippage can easily eat up a 10-15 bps spread. Ensure the spread is wide enough to cover costs.</li>
                <li><strong>Speed:</strong> Institutional high-frequency trading (HFT) bots and Authorized Participants (APs) close these gaps very quickly. Retail investors often only catch the tail end.</li>
                <li><strong>Not a crystal ball:</strong> A high premium doesn't guarantee the price will fall; it just means the price has outpaced the NAV temporarily.</li>
              </ul>
            </div>
          </section>

          {/* 4. FAQ / Glossary */}
          <section className="space-y-4">
            <h2 style={{ color: '#E8A027', fontSize: '1.25rem', fontWeight: 500 }}>
              4. Glossary
            </h2>
            <div className="rounded border divide-y" style={{ borderColor: '#1a1a1e', background: '#0A0A12' }}>
              <div className="p-4">
                <h4 className="font-semibold mb-1">NAV (Net Asset Value)</h4>
                <p className="text-sm text-gray-400">The total value of all underlying assets held by the ETF, divided by the number of shares. It's the "true" worth of one ETF unit.</p>
              </div>
              <div className="p-4">
                <h4 className="font-semibold mb-1">Basis Point (bps)</h4>
                <p className="text-sm text-gray-400">A unit of measure for interest rates and financial percentages. One basis point equals 1/100th of 1%, or 0.01%.</p>
              </div>
              <div className="p-4">
                <h4 className="font-semibold mb-1">Authorized Participant (AP)</h4>
                <p className="text-sm text-gray-400">Large financial institutions that have the right to create or destroy ETF shares. They arbitrage the difference when price drifts from NAV, keeping the ETF price in line.</p>
              </div>
              <div className="p-4">
                <h4 className="font-semibold mb-1">Arbitrage</h4>
                <p className="text-sm text-gray-400">The simultaneous buying and selling of an asset in different markets to profit from a tiny difference in price.</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
