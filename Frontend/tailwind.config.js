/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101f1f',
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
        card: '6px 6px 0 #101f1f',
        paper: '10px 10px 0 #101f1f',
        sticker: '4px 4px 0 #101f1f',
      },
    },
  },
  plugins: [],
}
