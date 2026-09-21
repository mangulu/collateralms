/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: '#FFFFFF',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        card: 'hsl(var(--card) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: '#FFFFFF',
        },
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        sidebar: {
          DEFAULT: 'var(--sidebar-bg)',
          foreground: 'var(--sidebar-fg)',
        },
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.05)',
        modal: '0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
        dropdown: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        primary: '0 3px 10px var(--izou-primary-shadow)',
      },
      ringWidth: {
        2: '1.5px',
      },
    },
  },
  plugins: [],
};