import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const password = process.env.FAMILY_PASSWORD;
  if (!password || request.cookies.get(AUTH_COOKIE)?.value === await authToken(password)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next|covers|icon.svg|icon-192.png|icon-512.png|manifest.webmanifest|sw.js|login|api/login).*)"] };
