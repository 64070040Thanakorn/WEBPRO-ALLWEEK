/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors:{
        "primary-blue":"#19a6d3"
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}