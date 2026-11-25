import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

const PRIVATE_PREFIXES = ["/dashboard", "/links", "/analytics", "/qr", "/settings"];

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const googleReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: googleReady ? [Google] : [],
  callbacks: {
    authorized({ request, auth }) {
      if (!isPrivatePath(request.nextUrl.pathname)) return true;
      if (auth?.user || request.cookies.get("enc_session")?.value) return true;
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    },
  },
} satisfies NextAuthConfig;
