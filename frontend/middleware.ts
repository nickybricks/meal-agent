import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "./lib/supabase-server";

const PUBLIC_PATHS = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname, search } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/invite/");
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  const supabase = createMiddlewareClient(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated → /login (except for public paths)
  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  // Authenticated but not yet onboarded → /onboarding
  // (skip redirect when already on /onboarding, /login, /register, /invite/*)
  const onboarded = Boolean(user?.user_metadata?.onboarded);
  if (user && !onboarded && !isOnboarding && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
