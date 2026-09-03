/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        sidebar: {
          DEFAULT: '#0f172a',
          light: '#1e293b',
          border: '#334155',
        },
      },
      boxShadow: {
        'sidebar': '4px 0 20px -4px rgba(0,0,0,0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
