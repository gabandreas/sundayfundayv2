import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base palette: Dark charcoal / slate (not pure black #000, not default zinc)
        canvas: "#0c0e14",
        surface: {
          subtle: "#11141c",
          DEFAULT: "#161922",
          hover: "#1d222e",
          active: "#242a38",
        },
        border: {
          subtle: "#1f2430",
          DEFAULT: "#282e3d",
          strong: "#384054",
        },
        text: {
          primary: "#f3f4f6",
          secondary: "#9ca3af",
          tertiary: "#6b7280",
          disabled: "#4b5563",
        },
        // Shifted financial delta colors
        delta: {
          positive: "#10b78d", // Calmer emerald-teal (not generic bright green)
          negative: "#e06c53", // Muted rust / terracotta (not stop-sign red)
        },
        // Warning/caution (distinct from delta and urgency)
        caution: {
          DEFAULT: "#e59b2c", // Muted amber
        },
        // Urgency accent: High-contrast assertive vermilion, reserved strictly for deficit/locked states
        urgency: {
          DEFAULT: "#ff3838",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        display: ["var(--font-newsreader)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
