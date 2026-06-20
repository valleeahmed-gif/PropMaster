/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './app/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Estate green — refined with proper contrast across the scale
        brand: {
          50:  '#edfaf4',
          100: '#d2f3e5',
          200: '#a7e5cd',
          300: '#73cfb0',
          400: '#3eb38f',
          500: '#1c9573',
          600: '#0e7c64',  // primary
          700: '#0a5f4e',
          800: '#094c40',
          900: '#083d35',
          950: '#03241f',  // deepest — used in sidebar
        },
        // Brass — refined for premium feel
        brass: {
          50:  '#fbf6e6',
          100: '#f5ebbf',
          200: '#ebd684',
          300: '#dfbb47',
          400: '#cea22a',
          500: '#b88719',  // primary brass
          600: '#a06d15',
          700: '#7e5414',
        },
        // Warm neutral surfaces — feels like quality stationery, not generic
        surface: {
          50:  '#fcfcfa',
          100: '#f7f7f3',
          200: '#ecede7',
          300: '#dcded5',
          400: '#b8bcb1',
        },
        // Ink — deep neutral text colours, not just black
        ink: {
          50:  '#f7f8f7',
          100: '#e8eae8',
          200: '#c8ccc8',
          300: '#9da39d',
          400: '#6d756e',
          500: '#4a514c',
          600: '#363c38',
          700: '#252a27',
          800: '#171c19',
          900: '#0d110f',
        },
      },
      fontFamily: {
        sans: ['Nunito Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
      },
      borderRadius: {
        'xl': '0.875rem',     // 14px — refined
        '2xl': '1.125rem',    // 18px — primary card radius
        '3xl': '1.5rem',
      },
      boxShadow: {
        // Elegant, soft shadows with green tint
        'sm':  '0 1px 2px rgba(11,65,56,0.04), 0 0 0 1px rgba(11,65,56,0.04)',
        'DEFAULT': '0 2px 8px rgba(11,65,56,0.06), 0 0 0 1px rgba(11,65,56,0.04)',
        'md':  '0 4px 16px rgba(11,65,56,0.08), 0 0 0 1px rgba(11,65,56,0.04)',
        'lg':  '0 12px 32px rgba(11,65,56,0.10), 0 0 0 1px rgba(11,65,56,0.04)',
        'xl':  '0 24px 56px rgba(11,65,56,0.14), 0 0 0 1px rgba(11,65,56,0.04)',
        'inner-focus': 'inset 0 0 0 2px rgba(14,124,100,0.25)',
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'rise-in':  'riseIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
