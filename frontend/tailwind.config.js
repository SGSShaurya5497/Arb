/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:   '#0D0D0F',
        panel:     '#141417',
        border:    '#252529',
        muted:     '#5A5A65',
        text:      '#E8E8EC',
        'flux-pos': '#22C55E',
        'flux-neg': '#EF4444',
        amber:     '#F59E0B',
        flash:     'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        sans:  ['system-ui', 'Segoe UI', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.65rem',
        'xs':  '0.75rem',
        'sm':  '0.8125rem',
      },
      keyframes: {
        rowflash: {
          '0%':   { backgroundColor: 'rgba(255,255,255,0.07)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        rowflash: 'rowflash 280ms steps(1, end) forwards',
      },
    },
  },
  plugins: [],
}
