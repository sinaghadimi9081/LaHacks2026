/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        sand: '#f7f1e8',
        ember: '#bf5a36',
        mist: '#e7ded1',
      },
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 24px 60px -24px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
}
