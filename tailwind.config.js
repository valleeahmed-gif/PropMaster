/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './app/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── South African flag palette ─────────────────────
        // Exact official colours (SA Government flag spec):
        //   Green #007749 (PMS 3415C) · Gold #FFB81C (PMS 1235C)
        //   Red   #E03C31 (PMS 179C)  · Blue #001489 (Reflex Blue)
        //   Black #000000             · White #FFFFFF
        flag: {
          green: '#007749',
          gold:  '#FFB81C',
          red:   '#E03C31',
          blue:  '#001489',
          black: '#000000',
          white: '#FFFFFF',
        },
        // Brand green — scale anchored on the exact flag green at 600
        brand: {
          50:  '#e9f7f0',
          100: '#c8ecda',
          200: '#93dab6',
          300: '#58c28e',
          400: '#27a468',
          500: '#0f8d55',
          600: '#007749',  // primary — exact flag green
          700: '#00603b',
          800: '#004d30',
          900: '#003b25',
          950: '#002317',  // deepest — used in sidebar
        },
        // Gold — scale anchored on the exact flag gold at 500
        brass: {
          50:  '#fff8e8',
          100: '#ffeec2',
          200: '#ffdf8a',
          300: '#ffd058',
          400: '#ffc436',
          500: '#ffb81c',  // primary — exact flag gold
          600: '#dd9a0b',
          700: '#a87407',
        },
        // Error red — anchored on the exact flag red
        red: {
          500: '#e03c31',  // exact flag red
          600: '#c93026',
        },
        // Info blue — anchored on the exact flag blue
        blue: {
          900: '#001489',  // exact flag blue
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
        'inner-focus': 'inset 0 0 0 2px rgba(0,119,73,0.25)',
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
