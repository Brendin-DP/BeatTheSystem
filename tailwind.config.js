/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  corePlugins: {
    preflight: false, /* Disable aggressive reset to preserve layout; we use minimal base styles */
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
