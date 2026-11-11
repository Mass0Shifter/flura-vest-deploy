import type { Metadata } from "next";
import localFont from "next/font/local";
import "@fluravest/ui/globals.css";

const jakarta = localFont({ src: "./PlusJakartaSans.ttf", variable: "--font-jakarta", weight: "300 800", display: "swap" });

export const metadata: Metadata = {
  title: { default: "FluraVest Operations", template: "%s · FluraVest Ops" },
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" data-theme="light" className={jakarta.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
