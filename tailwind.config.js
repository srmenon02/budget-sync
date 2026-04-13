/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Cabin"', '"Trebuchet MS"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#f4f6f4',
          card: '#ffffff',
          raised: '#ecf1ee',
          border: '#c8d2cc',
        },
        gold: {
          DEFAULT: '#1f5c4d',
          dim: '#18493d',
          faint: 'rgba(31,92,77,0.1)',
        },
        parchment: {
          DEFAULT: '#1e2a25',
          muted: '#4b5b55',
          dim: '#667670',
        },
        jade: '#2e7d5b',
        coral: '#b4574a',
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
