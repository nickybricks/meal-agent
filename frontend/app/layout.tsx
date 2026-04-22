import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppSettingsProvider } from "@/lib/app-context";
import { AuthProvider } from "@/components/auth/AuthProvider";
import AppShell from "@/components/AppShell";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Melagent",
  description: "Your personal AI chef assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakartaSans.variable} suppressHydrationWarning>
      <body className="bg-surface font-sans text-on-surface antialiased">
        <AuthProvider>
          <AppSettingsProvider>
            <AppShell>{children}</AppShell>
          </AppSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
