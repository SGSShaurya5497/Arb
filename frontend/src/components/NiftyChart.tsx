// src/components/NiftyChart.tsx
import { useEffect, useRef } from 'react'

export function NiftyChart() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear any previous widget (handles React Strict-Mode double-mount)
    container.innerHTML = ''

    // TradingView advanced chart widget — config goes in script.textContent
    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.cssText = 'height:100%;width:100%'
    container.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    // textContent is what TradingView reads — innerHTML is stripped by some browsers
    script.textContent = JSON.stringify({
      autosize:           true,
      symbol:             'NSE:NIFTY50',    // ← correct Nifty 50 symbol
      interval:           '5',
      timezone:           'Asia/Kolkata',
      theme:              'dark',
      style:              '1',
      locale:             'en',
      backgroundColor:    '#0e0e10',
      gridColor:          '#1a1a1f',
      hide_top_toolbar:   false,
      hide_legend:        false,
      save_image:         false,
      calendar:           false,
      hide_volume:        false,
      support_host:       'https://www.tradingview.com',
    })
    container.appendChild(script)

    // Cleanup: wipe the container so the effect can re-run cleanly
    return () => {
      container.innerHTML = ''
    }
  }, [])

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height: '100%', width: '100%' }}
    />
  )
}