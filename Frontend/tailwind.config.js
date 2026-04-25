/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12312a',
        sand: '#f2f7ec',
        ember: '#527a37',
        mist: '#dfe9d8',
        cream: '#f5f9ed',
        petal: '#cfe8d2',
        phthalo: '#174733',
        mustard: '#7d9a4d',
        'soon-soft': '#edf4bd',
        'soon-ring': '#a6b957',
        'feed-soft': '#f3dfbf',
        'feed-ring': '#c48a43',
        'light-gray': '#e7eee2',
        moonstone: '#9fcfb2',
        tomato: '#2f7d4f',
        danger: '#b6534b',
        'danger-soft': '#f5d9d4',
        citrus: '#d9e872',
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 24px 60px -32px rgba(18, 49, 42, 0.35)',
        pop: '0 18px 44px -28px rgba(18, 49, 42, 0.45)',
        paper: '0 28px 70px -42px rgba(18, 49, 42, 0.45)',
        sticker: '0 12px 24px -20px rgba(18, 49, 42, 0.4)',
      },
    },
  },
  plugins: [],
}
