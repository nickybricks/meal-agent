/**
 * layout.tsx — Root layout shared by all pages.
 */

import type { Metadata } from "next";
import "./globals.css";
import { AppSettingsProvider } from "@/lib/app-context";
import Sidebar from "@/components/sidebar/Sidebar";

export const metadata: Metadata = {
  title: "Recipe Agent",
  description: "Your personal AI chef assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-100 text-neutral-900 antialiased">
        <AppSettingsProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </AppSettingsProvider>
      </body>
    </html>
  );
}
