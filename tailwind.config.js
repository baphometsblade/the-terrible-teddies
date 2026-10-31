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
        // "Toy chest after dark" palette — plush nursery shapes, dive-bar light.
        night: {
          950: "#120c1c",
          900: "#1a1226",
          800: "#241a35",
          700: "#2f2344",
          600: "#3b2d54",
        },
        plush: {
          900: "#332944",
          800: "#413456",
          700: "#524368",
          400: "#9b8ab3",
          300: "#b6a8ca",
          200: "#d3c9e0",
          100: "#ece6f2",
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
        // contrast (15.99, 18.00, 17.28 and 13.20 to 1 on night-950), the glow
        // is the gas colour and is only ever the halo around it.
        neon: {
          pink: { core: "#FFE3F1", glow: "#FF4FA3" },
          teal: { core: "#DBFFFB", glow: "#2DE2D0" },
          amber: { core: "#FFF2D6", glow: "#FFB23F" },
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
