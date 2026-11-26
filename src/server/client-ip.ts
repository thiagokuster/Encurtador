export const CLIENT_IP_HEADER = "x-encurtador-client-ip";

const FORWARDED_IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "forwarded",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "fastly-client-ip",
];

export function trustProxyEnabled() {
  return /^(1|true|yes)$/i.test(process.env.TRUST_PROXY?.trim() ?? "");
}

export function hop(value: string) {
  let ip = value.trim();
  if (!ip || ip.toLowerCase() === "unknown") return "";
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    ip = end > 1 ? ip.slice(1, end) : "";
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  return ip;
}

export function lastForwardedHop(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(",") : value || "";
  return raw.split(",").map((part) => hop(part)).filter(Boolean).at(-1) || "";
}

export function clientIpFromHeaders(headers: { get(name: string): string | null }) {
  return hop(headers.get(CLIENT_IP_HEADER) || "") || "unknown";
}

export function forwardedIpHeaderNames() {
  return FORWARDED_IP_HEADERS;
}
