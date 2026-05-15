import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Caveat } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { HeaderNavSession } from "./header-nav-session";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Drunken Botanist — a cocktail field guide",
  description:
    "A personal cocktail companion that traces every drink back to its plant.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f4ecd8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 bg-parchment/95 backdrop-blur border-b border-paper-edge/70">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="flex items-baseline gap-3 min-w-0"
              aria-label="The Drunken Botanist home"
            >
              <span className="font-serif text-lg sm:text-2xl tracking-tight text-ink truncate">
                The Drunken Botanist
              </span>
              <span className="smallcaps text-[11px] text-ink-soft hidden lg:inline">
                a field guide for the home bar
              </span>
            </Link>
            <HeaderNavSession />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-paper-edge/70">
          <div className="mx-auto max-w-5xl px-6 py-8 text-xs text-ink-soft flex flex-wrap items-center justify-between gap-2">
            <span>
              Inspired by <em className="font-serif">The Drunken Botanist</em> by Amy Stewart.
            </span>
            <span className="smallcaps">For personal cultivation only</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
