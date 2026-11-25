import QRCode from "qrcode";
import { getOwnedLink } from "@/server/links";
import { ApiError } from "@/server/errors";
import { requireUser, routeParam, withApi } from "@/server/http";
import { colorContrast, validateHexColor } from "@/lib/validators";
import { assertRate, clientKey } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async (req, ctx) => {
  const { user } = await requireUser();
  assertRate(clientKey(req, `qr:${user.id}`), 120, 60 * 1000, user.id);
  const link = getOwnedLink(user.id, await routeParam(ctx, "id"), req);
  if (!link) throw new ApiError(404, "Link não encontrado.");
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";
  const foreground = validateHexColor(url.searchParams.get("fg") || link.qrColor);
  const background = validateHexColor(url.searchParams.get("bg") || link.qrBackground);
  if (!foreground || !background) throw new ApiError(400, "Cor do QR Code inválida.");
  if (colorContrast(foreground, background) < 3) {
    throw new ApiError(400, "As cores do QR Code precisam de mais contraste para a leitura.");
  }

  const filename = `qr-${link.slug}.${format}`;
  if (format === "svg") {
    const svg = await QRCode.toString(link.shortUrl, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: `#${foreground}`, light: `#${background}` },
    });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const png = await QRCode.toBuffer(link.shortUrl, {
    type: "png",
    width: 768,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: `#${foreground}`, light: `#${background}` },
  });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
