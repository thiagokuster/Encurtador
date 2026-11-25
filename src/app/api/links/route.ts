import { createLink, listLinks } from "@/server/links";
import { ApiError } from "@/server/errors";
import { json, readJson, requireUser, withApi } from "@/server/http";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const { user } = await requireUser();
  return json(listLinks(user.id, new URL(req.url), req));
});

export const POST = withApi(async (req) => {
  const { user } = await requireUser();
  assertRate(`create:${user.id}`, 30, 60 * 60 * 1000, user.id);
  assertRate(clientKey(req, "create"), 60, 60 * 60 * 1000, user.id);
  const body = await readJson(req);
  if (typeof body.company === "string" && body.company.trim()) {
    throw new ApiError(400, "Não foi possível criar o link.");
  }
  return json(createLink(user.id, body, req), 201);
});
