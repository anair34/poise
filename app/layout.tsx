import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poise — Your daily speaking coach",
  description:
    "Build clarity, confidence, and presence through one daily speaking exercise and personalized AI feedback.",
};

/**
 * Deliberately free of any session lookup. Reading cookies here would opt every
 * route into dynamic rendering, including the landing page, which needs no
 * identity at all. Auth context lives in the (app) group layout instead.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
