import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const configured = process.env.FAMILY_PASSWORD;
  const body = await request.json().catch(() => ({}));
  if (configured && (typeof body.password !== "string" || await authToken(body.password) !== await authToken(configured))) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  if (configured) response.cookies.set(AUTH_COOKIE, await authToken(configured), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
