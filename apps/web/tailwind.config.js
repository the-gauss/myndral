/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background:     'rgb(var(--background) / <alpha-value>)',
        foreground:     'rgb(var(--foreground) / <alpha-value>)',
        surface:        'rgb(var(--surface) / <alpha-value>)',
        border:         'rgb(var(--border) / <alpha-value>)',
        muted:          'rgb(var(--muted) / <alpha-value>)',
        'muted-fg':     'rgb(var(--muted-foreground) / <alpha-value>)',
        accent:         'rgb(var(--accent) / <alpha-value>)',
        'accent-fg':    'rgb(var(--accent-foreground) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
