import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Deep Green & Off-White Premium Botanical Palette
        // Deep rich pine canvas, frosted emerald glass surfaces,
        // warm off-white crystal typography, and gold/amber highlights.
        ink: "#FAF8F5",                       // warm off-white primary text
        paper: "#061812",                     // deep botanical forest green canvas
        graphite: "rgba(9, 27, 21, 0.90)",    // frosted deep forest glass sidebar / surfaces
        ash: "rgba(13, 38, 30, 0.75)",        // secondary frosted forest green surface
        panel: "rgba(11, 34, 27, 0.82)",      // prominent frosted deep green panel
        flame: "#10B981",                     // primary vibrant emerald action
        verdigris: "#34D399",                 // fresh mint / ready marker
        brass: "#F59E0B",                     // warm gold spice / pending highlight
        smoke: "#9DB7AA",                     // soft sage / muted secondary text
        line: "rgba(250, 248, 244, 0.14)",    // frosted off-white specular border
        forest: {
          950: "#04120D",
          900: "#061812",
          850: "#09231A",
          800: "#0D2E23",
          700: "#123E30",
          600: "#195442",
          500: "#227259",
        },
        offwhite: {
          DEFAULT: "#FAF8F5",
          cream: "#F4EFE6",
          pure: "#FFFFFF",
          muted: "#E5DFD3",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(4, 18, 13, 0.45), inset 0 1px 0 rgba(250, 248, 244, 0.18)",
        "glass-sm": "0 4px 16px 0 rgba(4, 18, 13, 0.35), inset 0 1px 0 rgba(250, 248, 244, 0.14)",
        "glass-lg": "0 16px 48px 0 rgba(4, 18, 13, 0.6), inset 0 1px 0 rgba(250, 248, 244, 0.25)",
        "glass-glow": "0 0 25px rgba(16, 185, 129, 0.35)",
        "glass-glow-emerald": "0 0 25px rgba(16, 185, 129, 0.4)",
        "glass-glow-amber": "0 0 25px rgba(245, 158, 11, 0.35)",
        sticker: "0 12px 28px -6px rgba(0, 0, 0, 0.55), 0 6px 12px -4px rgba(0, 0, 0, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
        glass: "16px",
        "glass-lg": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
