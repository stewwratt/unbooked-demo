module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#181818", // Dark background
        primary: "#222222", // Darker primary color for cards or containers
        secondary: "#444444", // Medium gray for secondary sections
        accent: "#aaaaaa", // Light gray for accents or success
        danger: "#ff5555", // Red for errors
        muted: "#777777", // Lighter gray for muted text
        text: "#f0f0f0", // Almost white for primary text
        darkCard: "#2B2B2B", // Adjust the value to make it lighter, for example.
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};
