/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Direction A — official palette (Aug 2026)
        navy: '#16213E',
        navyDeep: '#16213E', // alias kept for any lingering references
        mid: '#4C7BC9',
        blue: '#4C7BC9', // alias kept for any lingering references
        amber: '#E8963C',
        gold: '#C9A868', // accent/labels on navy surfaces ONLY — never a button
        paper: '#F7F5F0',
        ink: '#1C1B19',
        muted: '#6B7280',
        border: '#E3DFD3',
        borderSoft: '#EFEBE0',
        inputBorder: '#D9D4C7',
        navLight: '#B3BBCC',
        navMuted: '#9AA3B8',
        navFaint: '#7C86A0',
        navDisabled: '#5C6478',
        warn: '#C8721E',
        disabledBg: '#E7E4DB',
        disabledText: '#A2A5AE',

        // --- Legacy tokens (pre-Direction A) ---
        // Kept temporarily so pages not yet migrated to Direction A don't
        // break visually. Remove once every page has been redone.
        navyMid: '#2A5187',
        blueLight: '#7FB2E2',
        bluePale: '#B9DBF2',
        tealBright: '#7FE0D4',
        teal: '#3FA8A0',
        tealDark: '#2E8A82',
        coral: '#B4562E',
        tintBlue: '#EEF4FB',
        tintTeal: '#E3F5F3',
        borderBlue: '#DBE7F5',
        borderTeal: '#C9E8E4',
        inkStrong: '#16213E',
        faint: '#8A93A3',
      },
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['"Libre Franklin"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 12px 32px rgba(22, 33, 62, 0.08)',
        sheet: '0 16px 40px rgba(22, 33, 62, 0.2)',
      },
    },
  },
  plugins: [],
}
