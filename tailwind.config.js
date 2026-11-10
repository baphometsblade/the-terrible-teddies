/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: [
          '"Baloo 2"',
          "ui-rounded",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      colors: {
        // Dive-bar night. Wood-black, not nursery purple: the same ink as the
        // reference still (docs/ART_STYLE.md). Ivory plush is the paper on it.
        night: {
          950: "#100e0c",
          900: "#1a1410",
          800: "#261c16",
          700: "#36281e",
          600: "#4a3828",
        },
        plush: {
          900: "#2c2018",
          800: "#463428",
          700: "#6a5040",
          400: "#a89074",
          300: "#cbb59a",
          200: "#e7d9c8",
          100: "#f7f1e8",
        },
        brass: {
          600: "#b45309",
          500: "#d97706",
          400: "#f59e0b",
          300: "#fbbf24",
          200: "#fde68a",
        },
        felt: {
          900: "#0f2419",
          800: "#163423",
          700: "#1d442e",
          600: "#275a3d",
        },
        // The bar's neon (the .neon material in index.css reads these through
        // theme(), so this is the one place a tone is defined). Each tone is a
        // core and a glow: the core is the hot glass and carries the text
        // contrast (16.06, 18.08, 17.36 and 13.26 to 1 on night-950), the glow
        // is the gas colour and is only ever the halo around it.
        neon: {
          pink: { core: "#FFE3F1", glow: "#FF2F86" },
          teal: { core: "#DBFFFB", glow: "#3EC8FF" },
          amber: { core: "#FFF2D6", glow: "#FF9A2C" },
          red: { core: "#FFC9C9", glow: "#FF4D4D" },
        },
        // Brushed steel, for the door: 700 to 800 is the plate's gradient (text
        // is measured on 700, its lightest stop), 400 the rivet highlight and
        // 950 the inside of the peep slot.
        steel: {
          950: "#07060a",
          800: "#262a31",
          700: "#3b4049",
          400: "#6b7280",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
