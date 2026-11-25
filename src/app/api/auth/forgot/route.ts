import { requestReset } from "@/server/auth";
import { json, readJson, withApi } from "@/server/http";
import { publicBase } from "@/server/request";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async (req) => {
  assertRate(clientKey(req, "forgot"), 5, 60 * 60 * 1000);
  const body = await readJson(req);
  const result = requestReset(String(body.email ?? ""), publicBase(req, null));
  return json({
    message: "Se existir uma conta com esse e-mail, preparamos o link de redefinição.",
    resetUrl: result.resetUrl,
  });
});
