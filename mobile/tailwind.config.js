/** @type {import('tailwindcss').Config} */
// Look from the Google Stitch project "Canton Fair Sourcing Portal" (D49). `slate` and `blue` are
// remapped to its neutrals and its cobalt, so every screen takes its colours; `ink` is the header.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#001529',
        brand: { DEFAULT: '#002a81', container: '#003eb3', soft: '#dce1ff' },
        slate: {
          50: '#faf9f9',
          100: '#f4f3f3',
          200: '#e3e2e2',
          300: '#c4c5d6',
          400: '#9a9cab',
          500: '#747685',
          600: '#5a5d6b',
          700: '#434653',
          800: '#2f3031',
          900: '#1b1c1c',
        },
        blue: {
          50: '#f0f5ff',
          100: '#dce1ff',
          300: '#91caff',
          500: '#2a55c9',
          600: '#003eb3',
          700: '#002a81',
          800: '#00216a',
        },
      },
      fontFamily: {
        sans: ['"Geist Sans"', '-apple-system', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Geist Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
