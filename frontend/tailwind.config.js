/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          dominant: '#050705',
          secondary: '#090D09',
        },
        panel: {
          default: '#0D130E',
          elevated: '#111811',
        },
        brand: {
          primary: '#7CFF4F',
          accent: '#9DFF70',
          soft: '#C8FFB5',
        },
        text: {
          primary: '#F4F7F2',
          secondary: '#9AA49B',
          muted: '#667067',
        },
        border: {
          default: '#1C261D',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'SF Pro', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
