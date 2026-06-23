// src/components/NiftyChart.tsx
import { useEffect, useRef } from 'react'

export function NiftyChart() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) return
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: 'NSE:NIFTY',
      interval: '5',
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0e0e10',
      gridColor: '#1a1a1f',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      width: '100%',
      height: '100%',
    })
    container.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container" ref={container}
      style={{ height: '400px', width: '100%' }}>
      <div className="tradingview-widget-container__widget"
        style={{ height: '100%', width: '100%' }} />
    </div>
  )
}