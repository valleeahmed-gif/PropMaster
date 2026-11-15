/** @type {import('tailwindcss').Config} */
// Shared scales so Tailwind's default colour names resolve to flag colours.
const flagGreen = {
  50: '#e8f6ef', 100: '#c9ebd9', 200: '#94d8b5', 300: '#55bf8c', 400: '#1fa268',
  500: '#058c57', 600: '#007749', 700: '#00613c', 800: '#004d30', 900: '#003a24',
};
const flagGold = {
  50: '#fff9e8', 100: '#fff0c4', 200: '#ffe18a', 300: '#ffd152', 400: '#ffc431',
  500: '#ffb81c', 600: '#d99200', 700: '#a36a00', 800: '#7a4f00', 900: '#573900',
};
const neutral = {
  50: '#f6f7f6', 100: '#eceeec', 200: '#dcdfdc', 300: '#c0c5c1', 400: '#8f9690',
  500: '#676e68', 600: '#4b514c', 700: '#343936', 800: '#1d201e', 900: '#0a0c0b',
};

export default {
  content: ['./index.html', './app/index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── South African flag palette ─────────────────────
        // Official colours: Green #007749 · Gold #FFB81C · Red #E03C31
        // Blue #001489 · Black #000000 · White #FFFFFF.
        // Every scale below is anchored on one of them, so the whole UI
        // is built from the six flag colours:
        //   black  → structure and text      green → primary actions, paid
        //   gold   → highlights, pending     red   → overdue, danger
        //   blue   → information, links      white → surfaces
        green: flagGreen,
        amber: flagGold,
        gray: neutral,
        flag: {
          green: '#007749',
          gold:  '#FFB81C',
          red:   '#E03C31',
          blue:  '#001489',
          black: '#0A0A0A',
          white: '#FFFFFF',
        },
        // Green — exact flag green at 600
        brand: {
          50:  '#e8f6ef',
          100: '#c9ebd9',
          200: '#94d8b5',
          300: '#55bf8c',
          400: '#1fa268',
          500: '#058c57',
          600: '#007749',
          700: '#00613c',
          800: '#004d30',
          900: '#003a24',
          950: '#002216',
        },
        // Gold — exact flag gold at 500 (brass kept as the original name)
        brass: {
          50:  '#fff9e8',
          100: '#fff0c4',
          200: '#ffe18a',
          300: '#ffd152',
          400: '#ffc431',
          500: '#ffb81c',
          600: '#d99200',
          700: '#a36a00',
          800: '#7a4f00',
          900: '#573900',
        },
        // Red — exact flag red at 500
        red: {
          50:  '#fdf1ef',
          100: '#fbdfdb',
          200: '#f7bdb6',
          300: '#f0928a',
          400: '#e8665c',
          500: '#e03c31',
          600: '#c42b21',
          700: '#a0221a',
          800: '#7e1c16',
          900: '#621813',
        },
        // Blue — exact flag blue at 900
        blue: {
          50:  '#eef1fd',
          100: '#dce2fa',
          200: '#b8c3f4',
          300: '#8a9aea',
          400: '#5a6cdc',
          500: '#3447cb',
          600: '#1e30b4',
          700: '#10229f',
          800: '#071a93',
          900: '#001489',
          950: '#000c57',
        },
        // Neutrals — from flag black to flag white, no colour cast
        surface: {
          50:  '#fbfbfa',
          100: '#f4f5f3',
          200: '#e7e9e6',
          300: '#d5d8d4',
          400: '#aeb3ad',
        },
        ink: {
          50:  '#f6f7f6',
          100: '#e9ebe9',
          200: '#cfd3cf',
          300: '#a3a9a4',
          400: '#727973',
          500: '#4f5550',
          600: '#383d39',
          700: '#262a27',
          800: '#171a18',
          900: '#0a0c0b',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
      },
      borderRadius: {
        'xl': '0.75rem',      // 12px — controls
        '2xl': '1rem',        // 16px — cards
        '3xl': '1.5rem',
      },
      boxShadow: {
        'sm':  '0 1px 2px rgba(10,12,11,0.05)',
        'DEFAULT': '0 1px 3px rgba(10,12,11,0.06), 0 1px 2px rgba(10,12,11,0.04)',
        'md':  '0 6px 16px -4px rgba(10,12,11,0.10), 0 2px 4px rgba(10,12,11,0.04)',
        'lg':  '0 16px 32px -8px rgba(10,12,11,0.14), 0 4px 8px rgba(10,12,11,0.04)',
        'xl':  '0 28px 56px -12px rgba(10,12,11,0.22)',
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
