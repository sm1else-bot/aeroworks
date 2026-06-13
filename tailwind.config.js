/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carbon: {
          950: '#07090c',
          900: '#0b0e13',
          850: '#10141b',
          800: '#161b24',
          700: '#1f2733',
          600: '#2b3545',
        },
        accent: {
          cyan: '#22d3ee',
          amber: '#fbbf24',
          red: '#f87171',
          green: '#4ade80',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', '"SF Mono"', 'monospace'],
        display: ['Rajdhani', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hud: '0 0 0 1px rgba(34,211,238,0.12), 0 8px 32px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
