/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          100: "#ffe9d6",
          500: "#f97316",
          700: "#c2410c"
        }
      }
    }
  },
  plugins: []
};