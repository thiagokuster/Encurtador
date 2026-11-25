import { linkAnalytics, rangeFromUrl } from "@/server/analytics";
import { json, requireUser, routeParam, withApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req, ctx) => {
  const { user } = await requireUser();
  return json(linkAnalytics(user.id, await routeParam(ctx, "id"), rangeFromUrl(new URL(req.url)), req));
});
