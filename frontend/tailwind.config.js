/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface:    '#080810',
        panel:      '#0D0D0F',
        border:     '#1e1e24',
        muted:      '#5A5A65',
        text:       '#E8E8EC',
        'flux-pos': '#22C55E',
        'flux-neg': '#EF4444',
        amber:      '#F59E0B',
        accent:     '#3B82F6',
        flash:      'rgba(59,130,246,0.08)',
        'panel-alt': '#111115',
      },
      fontFamily: {
        sans:  ['"Inter"', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
        'xs':  ['0.75rem', { lineHeight: '1.1rem' }],
        'sm':  ['0.8125rem', { lineHeight: '1.25rem' }],
      },
      keyframes: {
        rowflash: {
          '0%':   { backgroundColor: 'rgba(59,130,246,0.08)' },
          '100%': { backgroundColor: 'transparent' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(34,197,94,0.4)' },
          '50%':      { opacity: '0.7', boxShadow: '0 0 0 4px rgba(34,197,94,0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        rowflash:   'rowflash 320ms ease-out forwards',
        livePulse:  'livePulse 2s ease-in-out infinite',
        shimmer:    'shimmer 1.5s infinite',
        fadeIn:     'fadeIn 0.2s ease-out forwards',
      },
      backgroundImage: {
        'panel-gradient': 'linear-gradient(90deg, #0D0D0F 0%, #111115 100%)',
        'surface-gradient': 'linear-gradient(135deg, #080810 0%, #0D0D0F 100%)',
      },
    },
  },
  plugins: [],
}
