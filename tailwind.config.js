/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: {
          900: '#0d0f14',
          800: '#13161d',
          700: '#1a1e28',
          600: '#222736',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        surface: '#1e2330',
        border: '#2a3040',
      },
    },
  },
  plugins: [],
}
