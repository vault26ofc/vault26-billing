/** @type {import('tailwindcss').Config} */
// Vault 26 look (same as vault26.co.in): black ink on white paper, one red
// accent, square corners, Imbue headings and Lato text. Telugu letters fall
// back to Noto Sans Telugu, which Imbue and Lato do not include.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        v26: {
          ink: '#0F0F0F',
          paper: '#FFFFFF',
          page: '#F1F1F1',
          soft: '#F6F6F6',
          line: '#D9D9D9',
          muted: '#4D4D4D',
          red: '#BB0006',
          'red-dark': '#8F0005',
        },
        status: {
          green: '#15803D',
          greenBg: '#F0FDF4',
          greenBorder: '#BBF7D0',
          amber: '#B45309',
          amberBg: '#FFFBEB',
          amberBorder: '#FDE68A',
          red: '#B91C1C',
          redBg: '#FEF2F2',
          redBorder: '#FECACA',
          blue: '#1D4ED8',
          blueBg: '#EFF6FF',
          blueBorder: '#BFDBFE',
        },
      },
      fontFamily: {
        display: ['Imbue', "'Bodoni Moda'", "'Noto Sans Telugu'", 'Georgia', 'serif'],
        sans: ['Lato', "'Noto Sans Telugu'", 'system-ui', 'sans-serif'],
        mono: ['Lato', "'Noto Sans Telugu'", 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        float: '0 8px 24px -8px rgba(15, 15, 15, 0.18)',
        modal: '0 16px 40px -12px rgba(15, 15, 15, 0.28)',
      },
    },
  },
  plugins: [],
};
