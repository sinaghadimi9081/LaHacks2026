/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101f1f',
        sand: '#f7f1e8',
        ember: '#bf5a36',
        mist: '#e7ded1',
        cream: '#fff7dc',
        petal: '#f5b7bc',
        phthalo: '#193d30',
        mustard: '#879451',
        'light-gray': '#e5e9e4',
        moonstone: '#82b3c3',
        tomato: '#e84636',
        citrus: '#f4d35e',
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 24px 60px -24px rgba(15, 23, 42, 0.35)',
        pop: '6px 6px 0 #101f1f',
        paper: '10px 10px 0 #101f1f',
        sticker: '4px 4px 0 #101f1f',
      },
    },
  },
  plugins: [],
}
