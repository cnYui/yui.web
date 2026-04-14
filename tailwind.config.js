module.exports = {
  content: [
    "./*.html",
    "./blog/*.html",
    "./anime/*.html",
    "./music/*.html",
    "./projects/*.html",
    "./resume/*.html",
    "./travel/*.html",
    "./skill/*.html",
    "./js/*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#222222",
        "primary-hover": "#333333",
        secondary: "#E0D8D0",
        background: "#ffffff",
        "background-light": "#ffffff",
        "background-soft": "#f9fafb",
        surface: "#ffffff",
        "surface-light": "#FAFAFA",
        "text-main": "#222222",
        "text-muted": "#666666",
        "text-light": "#b0b0b0",
        "text-tertiary": "#9ca3af",
        "border-light": "#E5E5E5",
        "border-subtle": "#e5e5e5",
        "accent-soft": "#e5e7eb",
        "accent-gold": "#c9a227",
        "accent-silver": "#8a8a8a",
        "accent-bronze": "#b87333",
        cream: "#faf9f6",
        "dark-bg": "#0f0f0f",
        "dark-surface": "#1a1a1a",
        "dark-card": "#242424",
        "dark-border": "#333333",
        "dark-text": "#e5e5e5",
        "dark-text-muted": "#a0a0a0"
      },
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["Inter", "sans-serif"],
        display: ["Playfair Display", "serif"],
        body: ["Inter", "sans-serif"]
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0,0,0,0.03)",
        "soft-dark": "0 4px 20px rgba(0,0,0,0.3)"
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/line-clamp")
  ]
};
