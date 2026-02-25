/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        panel: {
          100: "#dcfce7",
          500: "#16a34a",
          700: "#166534"
        }
      }
    }
  },
  plugins: []
};