/**
 * layout.tsx — Root layout shared by all pages.
 *
 * Responsibilities:
 * - Import globals.css (Tailwind base styles)
 * - Set <html lang="en"> and default <body> font/background classes
 * - Wrap children in any global providers needed (e.g. a React context for
 *   selected user, selected model, and settings state)
 * - Render the persistent <Sidebar> component alongside {children}
 *
 * The sidebar is always visible on desktop; on mobile it collapses to an icon.
 */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe Agent",
  description: "Your personal AI chef assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // TODO: implement in Phase 3
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
