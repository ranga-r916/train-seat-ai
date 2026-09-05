/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#adc2ff',
          400: '#7fa3ff',
          500: '#4d7cff',
          600: '#2554ff',
          700: '#153eff',
          800: '#0025eb',
          900: '#001cb3',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-bright': '0 8px 32px 0 rgba(77, 124, 255, 0.15)',
      }
    },
  },
  plugins: [],
}
