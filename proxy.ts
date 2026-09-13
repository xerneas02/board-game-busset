import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const password = process.env.FAMILY_PASSWORD;
  if (!password) return NextResponse.next();

  const token = request.headers.get("authorization")?.split(" ")[1];
  try {
    if (token && atob(token) === `famille:${password}`) return NextResponse.next();
  } catch {
    // An invalid Basic token simply requires a new login.
  }

  return new NextResponse("Accès familial", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sous lescalier"' },
  });
}

export const config = { matcher: ["/((?!_next|icon.svg|manifest.webmanifest).*)"] };
