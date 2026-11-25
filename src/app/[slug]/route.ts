import { NextResponse } from "next/server";
import { RESERVED_SLUGS } from "@/lib/constants";
import { validatePublicUrl } from "@/lib/url-policy";
import { buildClickInput, recordClick, shouldCountClick } from "@/server/analytics";
import { hasUnlock } from "@/server/auth";
import { getLinkBySlug } from "@/server/links";
import { requestHost } from "@/server/request";
import { logError } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function aviso(req: Request, code: string, slug?: string) {
  const url = new URL(`/aviso/${code}`, req.url);
  if (slug) url.searchParams.set("slug", slug);
  return NextResponse.redirect(url, 302);
}

async function handle(req: Request, ctx: { params: Promise<{ slug: string }> }, count: boolean) {
  const { slug } = await ctx.params;
  if (!slug || slug.length > 32 || RESERVED_SLUGS.has(slug.toLowerCase())) {
    return aviso(req, "inexistente");
  }
  if (slug.includes(".")) return new NextResponse(null, { status: 404 });
  const link = getLinkBySlug(slug);
  if (!link) return aviso(req, "inexistente");
  if (link.status !== "active") return aviso(req, "inativo", link.slug);
  if (link.expires_at && link.expires_at <= Date.now()) return aviso(req, "expirado", link.slug);
  if (link.password_hash && !hasUnlock(req, link.slug)) {
    return NextResponse.redirect(new URL(`/unlock/${encodeURIComponent(link.slug)}`, req.url), 302);
  }
  const safe = validatePublicUrl(link.original_url, requestHost(req));
  if (!safe.ok) return aviso(req, "inativo", link.slug);
  if (count && shouldCountClick(req)) {
    try {
      recordClick(buildClickInput(req, link));
    } catch (error) {
      logError("click", error);
    }
  }
  const status = link.redirect_type === 301 ? 301 : 302;
  const response = NextResponse.redirect(safe.url, status);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(req, ctx, true);
}

export function HEAD(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  return handle(req, ctx, false);
}
