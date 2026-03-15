/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background:  'rgb(var(--background) / <alpha-value>)',
        foreground:  'rgb(var(--foreground) / <alpha-value>)',
        surface:     'rgb(var(--surface) / <alpha-value>)',
        border:      'rgb(var(--border) / <alpha-value>)',
        muted:       'rgb(var(--muted) / <alpha-value>)',
        'muted-fg':  'rgb(var(--muted-foreground) / <alpha-value>)',
        accent:      'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-foreground) / <alpha-value>)',
        success:     'rgb(var(--success) / <alpha-value>)',
        warning:     'rgb(var(--warning) / <alpha-value>)',
        danger:      'rgb(var(--danger) / <alpha-value>)',
        info:        'rgb(var(--info) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xs:   'var(--radius-xs)',
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        pill: 'var(--radius-pill)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
