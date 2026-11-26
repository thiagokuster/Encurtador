import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { contentSecurityPolicy, createNonce } from "@/csp";

const PRIVATE_PREFIXES = ["/dashboard", "/links", "/analytics", "/qr", "/settings"];

function isPrivate(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function withPolicy(response: NextResponse, policy: string) {
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export default function middleware(request: NextRequest) {
  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  if (isPrivate(request.nextUrl.pathname) && !request.cookies.get("enc_session")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return withPolicy(NextResponse.redirect(url), policy);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return withPolicy(response, policy);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
