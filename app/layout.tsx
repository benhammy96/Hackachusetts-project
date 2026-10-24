import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atlas — Massachusetts data centre site screening",
  description:
    "Screen any location in Massachusetts for data centre suitability against grid, water, climate, land and community evidence, with sources and unresolved questions shown alongside every score.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0F14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body>
        <a
          href="#site-inspector"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[6px] focus:border focus:border-accent focus:bg-panel focus:px-3 focus:py-2 focus:text-fg"
        >
          Skip to site inspector
        </a>
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#17212B",
              border: "1px solid #283541",
              color: "#F0F3F5",
              fontSize: "12px",
              borderRadius: "8px",
            },
          }}
        />
      </body>
    </html>
  );
}
