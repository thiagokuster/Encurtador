import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/auth.config";

const authJsReady = Boolean(
  process.env.AUTH_SECRET &&
    process.env.AUTH_SECRET.trim().length >= 32 &&
    process.env.AUTH_GOOGLE_ID &&
    process.env.AUTH_GOOGLE_SECRET,
);

function redirectToLogin(request: NextRequest) {
  if (request.cookies.get("enc_session")?.value) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export default authJsReady ? NextAuth(authConfig).auth : redirectToLogin;

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/links",
    "/links/:path*",
    "/analytics",
    "/analytics/:path*",
    "/qr",
    "/qr/:path*",
    "/settings",
    "/settings/:path*",
  ],
};
