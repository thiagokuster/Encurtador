import { settingsDTO, updateSettings } from "@/server/settings";
import { json, readJson, requireUser, withApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const { user } = await requireUser();
  return json(settingsDTO(user.id, req));
});

export const PATCH = withApi(async (req) => {
  const session = await requireUser();
  const body = await readJson(req);
  return json(await updateSettings(session.user.id, session.sessionId, body, req));
});
