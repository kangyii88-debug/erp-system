import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        line: "#d8dfd7",
        panel: "#f8faf7",
        brand: "#1f7a55"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(23, 32, 27, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
