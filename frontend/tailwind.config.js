/** Colours come from CSS variables (src/index.css) so one class works in
 *  both the dark (default) and light themes. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        accent: { DEFAULT: '#E8403A', dark: '#c9302b' },
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 40px -18px rgb(0 0 0 / 0.55)',
      },
    },
  },
  plugins: [],
}
