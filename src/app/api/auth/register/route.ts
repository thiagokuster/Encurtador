import { registerAccount, writeSessionCookie } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { json, readJson, withApi } from "@/server/http";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req) => {
  assertRate(clientKey(req, "register"), 5, 60 * 60 * 1000);
  const body = await readJson(req);
  if (typeof body.company === "string" && body.company.trim()) {
    throw new ApiError(400, "Não foi possível criar a conta.");
  }
  const token = await registerAccount({
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
    privacyAccepted: body.privacyAccepted === true,
  });
  await writeSessionCookie(token);
  return json({ ok: true }, 201);
});
