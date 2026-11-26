import { deleteLink, getOwnedLink, updateLink } from "@/server/links";
import { ApiError } from "@/server/errors";
import { json, readJson, requireUser, routeParam, withApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req, ctx) => {
  const { user } = await requireUser();
  const link = getOwnedLink(user.id, await routeParam(ctx, "id"), req);
  if (!link) throw new ApiError(404, "Link não encontrado.");
  return json({ link });
});

export const PATCH = withApi(async (req, ctx) => {
  const { user } = await requireUser();
  const body = await readJson(req);
  return json(await updateLink(user.id, await routeParam(ctx, "id"), body, req));
});

export const DELETE = withApi(async (_req, ctx) => {
  const { user } = await requireUser();
  return json(deleteLink(user.id, await routeParam(ctx, "id")));
});
