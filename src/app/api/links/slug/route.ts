import { slugAvailability } from "@/server/links";
import { json, requireUser, withApi } from "@/server/http";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const { user } = await requireUser();
  assertRate(clientKey(req, `slug:${user.id}`), 60, 60 * 1000, user.id);
  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  const except = url.searchParams.get("except") || undefined;
  return json(slugAvailability(slug, except));
});
