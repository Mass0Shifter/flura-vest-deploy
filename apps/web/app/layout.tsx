import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@fluravest/ui/globals.css";
import { SwRegister } from "@/components/sw-register";

const jakarta = localFont({ src: "./PlusJakartaSans.ttf", variable: "--font-jakarta", weight: "300 800", display: "swap" });

export const metadata: Metadata = {
  title: { default: "FluraVest", template: "%s · FluraVest" },
  description: "Save with discipline, then co-buy verified land with 4–5 others.",
  applicationName: "FluraVest",
  appleWebApp: { capable: true, title: "FluraVest", statusBarStyle: "default" },
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0A2A4A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" data-theme="light" className={jakarta.variable}>
      <body className="min-h-dvh">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
