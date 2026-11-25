import { sha256 } from "@/server/crypto";
import { loginAccount, writeSessionCookie } from "@/server/auth";
import { json, readJson, withApi } from "@/server/http";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req) => {
  assertRate(clientKey(req, "login"), 10, 15 * 60 * 1000);
  const body = await readJson(req);
  if (typeof body.company === "string" && body.company.trim()) {
    return json({ error: "E-mail ou senha incorretos." }, 401);
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  assertRate(`login-email:${sha256(email).slice(0, 24)}`, 10, 15 * 60 * 1000);
  const token = await loginAccount(email, String(body.password ?? ""));
  await writeSessionCookie(token);
  return json({ ok: true });
});
