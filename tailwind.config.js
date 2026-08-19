/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nightfall: '#163052',
        navyMid: '#2A5187',
        teal: '#3FA8A0',
        dune: '#C08A2E',
        paper: '#F7F5F0',
        fog: '#6B7280',
        ink: '#1C1B19',
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body: ['"Albert Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
