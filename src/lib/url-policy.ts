export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

function ipv4Parts(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

function isBlockedIpv4(parts: number[]) {
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a === 255) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6Groups(host: string): number[] | null {
  let value = host.toLowerCase();
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (dotted) {
    const parts = ipv4Parts(dotted[2]);
    if (!parts) return null;
    const hi = ((parts[0] << 8) | parts[1]).toString(16);
    const lo = ((parts[2] << 8) | parts[3]).toString(16);
    value = `${dotted[1]}${hi}:${lo}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const parseSide = (side: string) => (side ? side.split(":") : []);
  const left = parseSide(halves[0]);
  const right = halves.length === 2 ? parseSide(halves[1]) : [];
  if ([...left, ...right].some((group) => !/^[0-9a-f]{0,4}$/.test(group))) return null;
  if (halves.length === 1) {
    if (left.length !== 8) return null;
  } else if (8 - left.length - right.length < 1 && left.length + right.length !== 8) {
    return null;
  }
  const missing = 8 - left.length - right.length;
  const groups = halves.length === 2 ? [...left, ...Array(missing).fill("0"), ...right] : left;
  if (groups.length !== 8) return null;
  const numbers = groups.map((group) => (group ? Number.parseInt(group, 16) : 0));
  if (numbers.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)) return null;
  return numbers;
}

export function embeddedIpv4(host: string): string | null {
  const name = host.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.+$/, "");
  if (!name.includes(":")) return null;
  const groups = ipv6Groups(name);
  if (!groups || groups[5] !== 0xffff || groups.slice(0, 5).some((group) => group !== 0)) return null;
  const parts = [(groups[6] >> 8) & 255, groups[6] & 255, (groups[7] >> 8) & 255, groups[7] & 255];
  return parts.join(".");
}

function isBlockedAddress(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!name || name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name === "metadata.google.internal" || name.endsWith(".internal")) return true;
  if (name === "0.0.0.0" || name === "::" || name === "::1") return true;
  if (/^\d+$/.test(name) || name.includes("0x")) return true;
  if (!name.includes(".") && !name.includes(":")) return true;

  const embedded = embeddedIpv4(name);
  if (embedded) return isBlockedAddress(embedded);

  const ipv4 = ipv4Parts(name);
  if (ipv4) return isBlockedIpv4(ipv4);

  if (name.includes(":")) {
    if (name === "::1" || name.startsWith("fc") || name.startsWith("fd") || name.startsWith("fe80")) return true;
  }

  return false;
}

export function validatePublicUrl(input: string, ownHost?: string | null): UrlResult {
  const original = input.trim();
  if (!original) return { ok: false, error: "Informe a URL de destino." };
  if (original.length > 2048) return { ok: false, error: "A URL é longa demais." };
  if (/[\u0000-\u0020<>\\]/.test(original)) {
    return { ok: false, error: "A URL contém caracteres inválidos." };
  }

  let raw = original;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "URL inválida." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Use apenas URLs http ou https." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "URLs com usuário e senha não são permitidas." };
  }
  if (isBlockedAddress(url.hostname)) {
    return { ok: false, error: "Esse endereço não pode ser encurtado." };
  }

  if (ownHost) {
    const own = ownHost.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
    const target = url.hostname.toLowerCase();
    if (own && (target === own || own.endsWith(`.${target}`) || target.endsWith(`.${own}`))) {
      return { ok: false, error: "Não é permitido encurtar um endereço deste próprio domínio." };
    }
  }

  return { ok: true, url: url.href };
}
