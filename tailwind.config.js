/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0b0b0f',
          card: '#141418',
          raised: '#1e1e28',
          border: '#2e2e3c',
        },
        gold: {
          DEFAULT: '#e8b84b',
          dim: '#b08a2c',
          faint: 'rgba(232,184,75,0.12)',
        },
        parchment: {
          DEFAULT: '#e8e4de',
          muted: '#8b8999',
          dim: '#52505e',
        },
        jade: '#4ade80',
        coral: '#f87171',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out both',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
