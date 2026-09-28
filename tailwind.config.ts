import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-vazir)", "Tahoma", "sans-serif"] },
      colors: { ink: "#17211c", cream: "#f5f2e9", moss: "#315c48", sage: "#dfe9df", gold: "#d5a84b", coral: "#c9654b" },
      boxShadow: { soft: "0 14px 45px rgba(23,33,28,.08)" },
    },
  },
  plugins: [],
} satisfies Config;
