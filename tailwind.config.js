/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12182B',
        'ink-light': '#1B2340',
        kraft: '#C9A876',
        'kraft-light': '#E4D2A8',
        paper: '#F2EDE1',
        stamp: '#B33A2E',
        'stamp-dark': '#8C2C22',
        slate: '#8993A8',
        seal: '#4B6B4F',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        crate: "repeating-linear-gradient(45deg, rgba(201,168,118,0.06) 0px, rgba(201,168,118,0.06) 2px, transparent 2px, transparent 12px)",
      },
    },
  },
  plugins: [],
}
