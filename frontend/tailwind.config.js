/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        atlas: {
          // Brand palette for the Climate Tech theme.
          primary: "#0f766e",
          accent: "#22c55e",
          risk: "#ef4444",
          ink: "#0f172a",
        },
      },
    },
  },
  plugins: [],
};
