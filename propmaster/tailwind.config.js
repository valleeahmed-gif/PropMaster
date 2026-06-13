export default {
  content: ['./index.html', './app/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefaf5',
          100: '#d6f3e7',
          200: '#b0e6d3',
          300: '#7dd2b8',
          400: '#47b698',
          500: '#249a7e',
          600: '#0e7c64',
          700: '#0c6353',
          800: '#0c4f43',
          900: '#0b4138',
          950: '#052520',
        },
        brass: {
          50: '#fdf8eb',
          100: '#f9ecc8',
          400: '#ddb04a',
          500: '#c9972a',
          600: '#a87a1e',
          700: '#855d19',
        },
        surface: {
          50: '#f9f9f6',
          100: '#f2f2ed',
          200: '#e8e8e0',
          300: '#d8d8cd',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
