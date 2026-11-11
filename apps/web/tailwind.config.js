const base = require("@fluravest/ui/tailwind");
/** @type {import('tailwindcss').Config} */
module.exports = { ...base, content: [...base.content, "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"] };
