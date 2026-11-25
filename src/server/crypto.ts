import crypto from "crypto";
import fs from "fs";
import path from "path";

let secretCache: string | null = null;

export function getSecret() {
  if (secretCache) return secretCache;
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < 32) {
      throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
    }
    secretCache = fromEnv;
    return secretCache;
  }

  const file = path.join(process.cwd(), "data", "auth-secret");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const stored = fs.readFileSync(file, "utf8").trim();
    if (stored.length >= 32) {
      secretCache = stored;
      return secretCache;
    }
  }

  const generated = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, `${generated}\n`, { encoding: "utf8", mode: 0o600 });
  secretCache = generated;
  return secretCache;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function createId() {
  return crypto.randomUUID();
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function anonymizeIp(ip: string) {
  const cleaned = ip.trim().replace(/^::ffff:/i, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleaned)) {
    const parts = cleaned.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (cleaned.includes(":")) {
    const groups = cleaned.split(":").filter(Boolean);
    return `${groups.slice(0, 3).join(":")}::/48`;
  }
  return "unknown";
}
