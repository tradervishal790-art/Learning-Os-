/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 20px rgba(79, 70, 229, 0.07)',
      },
    },
  },
  plugins: [],
}