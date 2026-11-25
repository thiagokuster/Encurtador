import { purgeAnalytics } from "@/server/analytics";
import { json, readJson, requireUser, withApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = withApi(async (req) => {
  const { user } = await requireUser();
  const linkId = new URL(req.url).searchParams.get("linkId") || undefined;
  return json(purgeAnalytics(user.id, linkId));
});

export const POST = withApi(async (req) => {
  const { user } = await requireUser();
  const body = await readJson(req);
  const linkId = typeof body.linkId === "string" ? body.linkId : undefined;
  return json(purgeAnalytics(user.id, linkId));
});
