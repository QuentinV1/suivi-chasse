/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f3f7f4',
          100: '#e2ece4',
          200: '#c5d9ca',
          300: '#9bbfa6',
          400: '#6b9d7c',
          500: '#497f5c',
          600: '#356547',
          700: '#2a5139',
          800: '#23412f',
          900: '#1b3325',
          950: '#0f1d15',
        },
        earth: {
          50: '#faf7f2',
          100: '#f3ede1',
          200: '#e6d9c2',
          300: '#d5be9a',
          400: '#c29e6e',
          500: '#b2834f',
          600: '#a36e42',
          700: '#875738',
          800: '#6e4732',
          900: '#5a3b2b',
          950: '#301e15',
        },
        copper: {
          500: '#c46d3b',
          600: '#b3592d',
        },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
