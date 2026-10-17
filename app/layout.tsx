import type { Metadata, Viewport } from "next";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/theme";
import { OfflineBanner } from "@/components/OfflineBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusRide — Same direction. Better together.",
  description:
    "CampusRide helps students at the Claremont Colleges find each other and choose an approved public place to meet.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[7px] focus:bg-ink focus:px-4 focus:py-3 focus:text-on-ink"
        >
          Skip to content
        </a>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
