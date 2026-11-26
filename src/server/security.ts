import { anonymizeIp, createId, sha256, getSecret } from "@/server/crypto";
import { one, run } from "@/server/db";
import { ApiError } from "@/server/errors";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function trustProxyEnabled() {
  return /^(1|true|yes)$/i.test(process.env.TRUST_PROXY?.trim() ?? "");
}

function hop(value: string) {
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

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.trim() || "";
  if (trustProxyEnabled()) {
    const last = forwarded.split(",").map((part) => hop(part)).filter(Boolean).at(-1);
    if (last) return last;
    return hop(req.headers.get("x-real-ip") || "") || "unknown";
  }
  if (!forwarded || forwarded.includes(",")) return "unknown";
  return hop(forwarded) || "unknown";
}

export function clientKey(req: Request, scope: string) {
  const hashed = sha256(`${getSecret()}|${anonymizeIp(clientIp(req))}`).slice(0, 20);
  return `${scope}:${hashed}`;
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.reset <= now) buckets.delete(bucketKey);
    }
  }
  const current = buckets.get(key);
  if (!current || current.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function assertRate(key: string, limit: number, windowMs: number, userId: string | null = null) {
  if (rateLimit(key, limit, windowMs)) return;
  logSecurity(userId, "rate_limited", "Limite de tentativas atingido.");
  throw new ApiError(429, "Muitas tentativas. Aguarde um pouco e tente de novo.");
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (!origin || !host) throw new ApiError(403, "Origem da requisição não reconhecida.");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ApiError(403, "Origem da requisição não reconhecida.");
  }
  if (parsed.host !== host) throw new ApiError(403, "Origem da requisição não reconhecida.");
}

export function logSecurity(userId: string | null, event: string, message: string) {
  try {
    run(
      "INSERT INTO security_logs (id, user_id, event, message, created_at) VALUES (?, ?, ?, ?, ?)",
      createId(),
      userId,
      event.slice(0, 60),
      message.slice(0, 240),
      Date.now(),
    );
  } catch (error) {
    console.error("[encurtador] falha ao gravar log de segurança", error instanceof Error ? error.message : "erro");
  }
}

export function logError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : "erro desconhecido";
  console.error(`[encurtador] ${scope}: ${message}`);
  logSecurity(null, "internal_error", `Falha interna em ${scope}.`);
}

export function readCookie(req: Request, name: string) {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function isRegistrationOpen() {
  const count = one<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if (!count || count.n === 0) return true;
  const flag = one<{ value: string }>("SELECT value FROM app_flags WHERE key = 'registration_open'");
  return !flag || flag.value === "1";
}

export function ensureAdmin() {
  const admin = one<{ id: string }>("SELECT id FROM users WHERE is_admin = 1 LIMIT 1");
  if (admin) return;
  const oldest = one<{ id: string }>("SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1");
  if (!oldest) return;
  run("UPDATE users SET is_admin = 1 WHERE id = ?", oldest.id);
}

export function userIsAdmin(userId: string) {
  const row = one<{ is_admin: number }>("SELECT is_admin FROM users WHERE id = ?", userId);
  return row?.is_admin === 1;
}

export function setRegistrationOpen(open: boolean) {
  run(
    `INSERT INTO app_flags (key, value) VALUES ('registration_open', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    open ? "1" : "0",
  );
}
