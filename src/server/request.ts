export function requestHost(req: Request) {
  return (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
}

export function publicBase(req: Request, domain: string | null) {
  if (domain) return domain.replace(/\/$/, "");
  const host = requestHost(req) || "localhost:3000";
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  return `${proto}://${host}`;
}
