import { trustProxyEnabled } from "@/server/client-ip";

export function requestHost(req: Request) {
  const header = trustProxyEnabled() ? req.headers.get("x-forwarded-host") || req.headers.get("host") : req.headers.get("host");
  return (header || "").split(",")[0].trim();
}

export function publicBase(req: Request, domain: string | null) {
  if (domain) return domain.replace(/\/$/, "");
  const host = requestHost(req) || "localhost:3000";
  const forwarded = trustProxyEnabled() ? req.headers.get("x-forwarded-proto") : null;
  const proto = (forwarded || "http").split(",")[0].trim().toLowerCase();
  return `${proto === "https" ? "https" : "http"}://${host}`;
}
