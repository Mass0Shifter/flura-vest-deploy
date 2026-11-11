import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FluraVest",
    short_name: "FluraVest",
    description: "Save with discipline, then co-buy verified land.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F4F8F7",
    theme_color: "#0A2A4A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-432.png", sizes: "432x432", type: "image/png", purpose: "maskable" },
    ],
  };
}
