"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import OfflineBanner from "@/components/OfflineBanner";

const NO_CHROME = ["/login", "/register", "/onboarding"];

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect y="3" width="22" height="2.5" rx="1.25" fill="currentColor" />
      <rect y="9.75" width="22" height="2.5" rx="1.25" fill="currentColor" />
      <rect y="16.5" width="22" height="2.5" rx="1.25" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <line x1="3" y1="3" x2="19" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="19" y1="3" x2="3" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isInvite = pathname.startsWith("/invite/");
  const hideChrome = NO_CHROME.some((p) => pathname === p || pathname.startsWith(p + "/")) || isInvite;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (hideChrome) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen flex-col">
      <OfflineBanner />

      {/* Mobile header bar — hidden on md+ */}
      <header className="flex h-14 shrink-0 items-center bg-surface-container-low px-3 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] md:hidden">
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-on-surface transition hover:bg-surface-container-high"
        >
          {sidebarOpen ? <CloseIcon /> : <BurgerIcon />}
        </button>
        <span className="flex-1 text-center text-base font-semibold text-on-surface">Melagent</span>
        {/* right slot — empty, keeps title centered */}
        <div className="h-11 w-11" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Backdrop — mobile only, shown when sidebar open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar — always visible on md+; slide-in drawer on mobile */}
        <div
          className={[
            "fixed inset-y-0 left-0 z-40 transition-transform duration-300 md:static md:z-auto md:translate-x-0 md:transition-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <Sidebar />
        </div>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
