import { clearSessionCookie } from "@/server/auth";
import { deleteOwnAccount } from "@/server/settings";
import { json, readJson, requireUser, withApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApi(async (req) => {
  const { user } = await requireUser();
  const body = await readJson(req);
  const result = deleteOwnAccount(user.id, body.email);
  await clearSessionCookie();
  return json(result);
});
