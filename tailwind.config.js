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
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#00A9E0',
          50: '#e8f8fd',
          100: '#cdf0fb',
          200: '#9be1f7',
          300: '#5ccef2',
          400: '#1db8e9',
          500: '#00A9E0',
          600: '#007CB3',
          700: '#005f8a',
          800: '#004a6e',
          900: '#003a57',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#00C2A8',
          50: '#e6faf7',
          100: '#ccf5ef',
          500: '#00C2A8',
          600: '#009e88',
          foreground: '#FFFFFF',
        },
        border: '#e5e7eb',
        background: '#f5f7fa',
        card: '#ffffff',
        muted: {
          DEFAULT: '#f1f4f8',
          foreground: '#667085',
        },
        destructive: {
          DEFAULT: '#dc2626',
          foreground: '#FFFFFF',
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#FFFFFF',
        },
        success: {
          DEFAULT: '#16a34a',
          foreground: '#FFFFFF',
        },
        foreground: '#102033',
        sidebar: {
          DEFAULT: '#007CB3',
          foreground: '#FFFFFF',
        },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        dropdown: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        primary: '0 8px 24px rgba(0,169,224,0.25)',
      },
    },
  },
  plugins: [],
};