import { RESERVED_SLUGS, RETENTION_OPTIONS } from "@/lib/constants";

export function cleanText(input: string) {
  return input.replace(/[\u0000-\u001F<>]/g, "").trim();
}

export function validateEmail(input: string) {
  const email = input.trim().toLowerCase();
  if (email.length < 6 || email.length > 180) return { ok: false as const, error: "E-mail inválido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "E-mail inválido." };
  return { ok: true as const, email };
}

export function validateName(input: string) {
  const name = cleanText(input).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    return { ok: false as const, error: "Informe um nome entre 2 e 80 caracteres." };
  }
  return { ok: true as const, name };
}

export function validateLinkPassword(password: string) {
  if (password.length < 4) return "A senha do link precisa ter pelo menos 4 caracteres.";
  if (password.length > 72) return "A senha do link pode ter no máximo 72 caracteres.";
  if (/[\u0000-\u001F]/.test(password)) return "A senha do link contém caracteres inválidos.";
  return null;
}

export function validatePassword(password: string) {
  if (password.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  return null;
}

export function validateSlug(slug: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,30}[a-zA-Z0-9]$/.test(slug)) {
    return "Use de 3 a 32 caracteres: letras, números, hífen e underscore. Não comece nem termine com símbolo.";
  }
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return "Esse endereço é reservado.";
  return null;
}

export function parseTags(input: string[] | string | undefined) {
  if (input == null) return { ok: true as const, tags: [] as string[] };
  const source = Array.isArray(input) ? input : input.split(",");
  const tags: string[] = [];
  for (const item of source) {
    const name = cleanText(item).toLowerCase().replace(/\s+/g, "-");
    if (!name) continue;
    if (!/^[a-z0-9à-ÿ](?:[a-z0-9à-ÿ-]{0,23})$/i.test(name)) {
      return { ok: false as const, error: `Tag inválida: ${cleanText(item).slice(0, 40)}` };
    }
    if (!tags.includes(name)) tags.push(name);
  }
  if (tags.length > 8) return { ok: false as const, error: "Use no máximo 8 tags." };
  return { ok: true as const, tags };
}

export function validateOptionalText(input: unknown, max: number, label: string) {
  if (input == null) return { ok: true as const, value: null as string | null };
  if (typeof input !== "string") return { ok: false as const, error: `${label} inválido.` };
  const value = cleanText(input);
  if (!value) return { ok: true as const, value: null };
  if (value.length > max) return { ok: false as const, error: `${label} pode ter no máximo ${max} caracteres.` };
  return { ok: true as const, value };
}

export function validateHexColor(input: string) {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return hex.toUpperCase();
}

export function colorContrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const value = Number.parseInt(hex, 16);
    const channel = (shift: number) => {
      const raw = ((value >> shift) & 255) / 255;
      return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  };
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

export function validateRedirect(input: unknown, fallback: 301 | 302 = 302): 301 | 302 | null {
  if (input == null) return fallback;
  if (input === 301 || input === "301") return 301;
  if (input === 302 || input === "302") return 302;
  return null;
}

export function validateRetention(input: unknown) {
  const value = Number(input);
  return (RETENTION_OPTIONS as readonly number[]).includes(value) ? value : null;
}

export function validateLinkLimit(input: unknown) {
  const value = Number(input);
  if (!Number.isInteger(value) || value < 10 || value > 2000) return null;
  return value;
}

export function safeNextPath(value: string | null | undefined) {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return "/dashboard";
  }
  if (value.startsWith("/login") || value.startsWith("/register") || value.startsWith("/api")) return "/dashboard";
  return value;
}

export function parseExpiresAt(input: unknown) {
  if (input == null || input === "") return { ok: true as const, value: null as number | null };
  if (typeof input !== "string") return { ok: false as const, error: "Data de expiração inválida." };
  const time = new Date(input).getTime();
  if (Number.isNaN(time)) return { ok: false as const, error: "Data de expiração inválida." };
  if (time <= Date.now()) return { ok: false as const, error: "A expiração precisa estar no futuro." };
  if (time > Date.now() + 5 * 365 * 24 * 60 * 60 * 1000) {
    return { ok: false as const, error: "A expiração máxima é de 5 anos." };
  }
  return { ok: true as const, value: time };
}
