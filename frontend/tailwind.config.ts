import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        foreground: "#0F172A",
        brand: {
          primary: "#059669",    // Emerald 600
          secondary: "#0284C7",  // Sky Blue 600
          surface: "#FFFFFF",
          bg: "#F8FAFC",
          border: "#E2E8F0"
        },
      },
      fontFamily: {
        heading: ["'General Sans'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body: ["'Satoshi'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      borderRadius: {
        'card': '32px',
        'pill': '9999px',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 12px 20px -5px rgba(0, 0, 0, 0.05)',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      }
    },
  },
  plugins: [],
};
export default config;
