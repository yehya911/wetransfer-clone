/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F3F5F8',
        surface: '#FFFFFF',
        rail: '#0E1017',
        'rail-soft': '#171A24',
        ink: '#10131A',
        'ink-soft': '#4B5264',
        muted: '#8A93A6',
        line: '#E3E7EE',
        accent: '#3654FF',
        'accent-dark': '#2540D6',
        'accent-soft': '#EAEDFF',
        teal: '#0EA5A0',
        amber: '#F5A623',
        danger: '#E5484D',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,19,26,0.04), 0 12px 32px -12px rgba(16,19,26,0.12)',
      },
    },
  },
  plugins: [],
}
