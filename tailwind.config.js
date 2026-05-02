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
        sans: ['DM Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#ff4c4c',
          50: '#fff0f0',
          100: '#ffe5e5',
          200: '#ffcccc',
          500: '#ff4c4c',
          600: '#ff4c4c',
          700: '#e63c3c',
          800: '#cc2e2e',
          900: '#a82020',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#00A86B',
          50: '#ECFDF5',
          100: '#D1FAE5',
          500: '#00A86B',
          600: '#007A4D',
          foreground: '#FFFFFF',
        },
        border: 'hsl(214 20% 88%)',
        background: 'hsl(210 20% 97%)',
        card: 'hsl(0 0% 100%)',
        muted: {
          DEFAULT: 'hsl(214 15% 94%)',
          foreground: 'hsl(215 16% 47%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 72% 51%)',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: 'hsl(38 92% 50%)',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: 'hsl(158 64% 40%)',
          foreground: '#FFFFFF',
        },
        foreground: 'hsl(215 25% 15%)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        dropdown: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};