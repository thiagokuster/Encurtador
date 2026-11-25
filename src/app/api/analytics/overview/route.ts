import { overview, rangeFromUrl } from "@/server/analytics";
import { json, requireUser, withApi } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const { user } = await requireUser();
  return json(overview(user.id, rangeFromUrl(new URL(req.url)), req));
});
