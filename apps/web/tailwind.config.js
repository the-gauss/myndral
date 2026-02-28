/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MyndralAI dark theme (Spotify-inspired)
        background: '#121212',
        surface:    '#181818',
        elevated:   '#282828',
        highlight:  '#333333',
        accent:     '#1ed760',   // primary brand green
        'accent-hover': '#1fdf64',
        muted:      '#b3b3b3',
        subtle:     '#727272',
      },
      fontFamily: {
        sans: ['Circular', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
