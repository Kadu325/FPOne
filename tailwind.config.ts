import type { Config } from "tailwindcss";
import { brand, shadow, surface } from "./src/styles/tokens";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { brand, ...surface },
      fontFamily: { sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"] },
      boxShadow: shadow,
    },
  },
};

export default config;
