import { exportCsv, rangeFromUrl } from "@/server/analytics";
import { requireUser, withApi } from "@/server/http";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  const { user } = await requireUser();
  assertRate(`export:${user.id}`, 10, 60 * 1000, user.id);
  assertRate(clientKey(req, "export"), 20, 60 * 1000, user.id);
  const url = new URL(req.url);
  const linkId = url.searchParams.get("linkId") || undefined;
  const csv = exportCsv(user.id, rangeFromUrl(url), linkId);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="encurtador-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
