import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-text-main)",
        line: "var(--color-border)",
        panel: "var(--color-bg-soft)",
        brand: "var(--color-primary)",
        card: "var(--color-card)",
        muted: "var(--color-text-muted)"
      },
      boxShadow: {
        soft: "var(--shadow-card)",
        lift: "var(--shadow-lift)"
      }
    }
  },
  plugins: []
};

export default config;
