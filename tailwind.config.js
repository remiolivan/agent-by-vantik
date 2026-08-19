/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navyDeep: '#163052',
        navyMid: '#2A5187',
        blue: '#4A7BC8',
        blueLight: '#7FB2E2',
        bluePale: '#B9DBF2',
        tealBright: '#7FE0D4',
        teal: '#3FA8A0',
        tealDark: '#2E8A82',
        amber: '#C08A2E',
        coral: '#B4562E',
        tintBlue: '#EEF4FB',
        tintTeal: '#E3F5F3',
        borderBlue: '#DBE7F5',
        borderTeal: '#C9E8E4',
        paper: '#FDFCFA',
        ink: '#22344E',
        inkStrong: '#163052',
        muted: '#5A6B84',
        faint: '#8A93A3',
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
