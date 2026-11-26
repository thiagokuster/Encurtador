import { completeReset, writeSessionCookie } from "@/server/auth";
import { json, readJson, withApi } from "@/server/http";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req) => {
  assertRate(clientKey(req, "reset"), 8, 60 * 60 * 1000);
  const body = await readJson(req);
  const token = await completeReset(String(body.token ?? ""), String(body.password ?? ""));
  await writeSessionCookie(token);
  return json({ ok: true });
});
