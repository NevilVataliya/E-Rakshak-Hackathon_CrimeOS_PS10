/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        crime: {
          950: '#060913',
          900: '#0b0f19',
          850: '#111726',
          800: '#172033',
          700: '#23304a',
          600: '#334466',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        indigo: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.25)',
        'glow-indigo': '0 0 20px rgba(99, 102, 241, 0.25)',
        'glow-emerald': '0 0 20px rgba(16, 185, 129, 0.25)',
        'glow-rose': '0 0 20px rgba(244, 63, 94, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
