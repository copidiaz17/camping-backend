/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        // Paleta camping (verde naturaleza) + colores de pulsera por zona
        monte: {
          50: "#eef7f0",
          100: "#d6ecdb",
          500: "#2e7d4f",
          600: "#256b43",
          700: "#1d5435",
        },
        pulsera: {
          quincho: "#e23b3b",
          pileta: "#2e7d4f",
          acampe: "#2471a3",
        },
      },
    },
  },
  plugins: [],
};
