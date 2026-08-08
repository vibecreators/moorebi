import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F1115",
        panel: "#161A21",
        edge: "#242A34",
        muted: "#8C98AA",
        text: "#E6EAF0",
        accent: "#5B8DEF",
        good: "#3FB27F",
        warn: "#E0A340",
        bad: "#E0605E",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
