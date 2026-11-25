import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { signUnlock, UNLOCK_COOKIE, unlockCookieOptions } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { json, readJson, withApi } from "@/server/http";
import { getLinkBySlug } from "@/server/links";
import { assertRate, clientKey, logSecurity } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req) => {
  const body = await readJson(req);
  const slug = String(body.slug ?? "").trim();
  const password = String(body.password ?? "");
  assertRate(clientKey(req, `unlock:${slug.slice(0, 40)}`), 8, 15 * 60 * 1000);
  const link = getLinkBySlug(slug);
  if (!link || !link.password_hash) throw new ApiError(400, "Este link não pede senha.");
  if (link.status !== "active") throw new ApiError(400, "Este link está desativado.");
  if (link.expires_at && link.expires_at <= Date.now()) throw new ApiError(400, "Este link expirou.");
  if (!bcrypt.compareSync(password, link.password_hash)) {
    logSecurity(link.user_id, "unlock_failed", "Senha de link recusada.");
    throw new ApiError(401, "Senha incorreta.");
  }
  const jar = await cookies();
  jar.set(UNLOCK_COOKIE, signUnlock(link.slug), unlockCookieOptions());
  return json({ redirect: `/${link.slug}` });
});
