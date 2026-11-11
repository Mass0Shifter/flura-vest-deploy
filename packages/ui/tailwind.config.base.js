// Shared Tailwind config: the Brand Kit v2 preset plus the paths each app must scan.
const path = require("node:path");
module.exports = {
  presets: [require("@fluravest/tokens/tailwind.preset.js")],
  content: [path.join(__dirname, "src/**/*.{ts,tsx}")],
  theme: { extend: { fontFamily: { sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "system-ui", "sans-serif"] } } },
};
