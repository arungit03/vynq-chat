/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Vynq-chat light-blue identity
        brand: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe1fe",
          300: "#93cdfd",
          400: "#60b0fa",
          500: "#3b91f6",
          600: "#2272eb",
          700: "#1b5cd8",
          800: "#1d4caf",
          900: "#1e428a",
          950: "#172a54",
        },
        ink: {
          DEFAULT: "#0f1d2e",
          soft: "#3b4d63",
          muted: "#6b7c91",
        },
        success: "#16a34a",
        danger: "#dc2626",
        warning: "#d97706",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,29,46,0.04), 0 8px 24px rgba(15,29,46,0.06)",
        soft: "0 1px 3px rgba(15,29,46,0.06)",
        nav: "0 -1px 0 rgba(15,29,46,0.05), 0 4px 20px rgba(15,29,46,0.04)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "message-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
        "scale-in": "scale-in 0.18s ease-out",
        "message-in": "message-in 0.18s ease-out",
      },
    },
  },
  plugins: [],
};
