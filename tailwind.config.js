/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0EA5A4",
        secondary: "#FB7185",
        accent: "#F59E0B",
        bg: "#FFF7ED",
        surface: "#FFFFFF",
        text: "#1F2937",
        textMuted: "#64748B"
      },
      fontFamily: {
        sans: ['"Nunito"', 'system-ui', 'sans-serif'],
        display: ['"Baloo 2"', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
