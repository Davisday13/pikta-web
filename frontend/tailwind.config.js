/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pikta: {
          bg: '#2b3e50',
          panel: '#4e5d6c',
          accent: '#df691a',
          info: '#5bc0de',
          ok: '#5cb85c',
          warn: '#f0ad4e',
          err: '#d9534f',
        }
      }
    },
  },
  plugins: [],
}
