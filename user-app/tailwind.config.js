/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4fbff",
          500: "#1177ff",
          700: "#0a4ecc"
        }
      }
    }
  },
  plugins: []
};