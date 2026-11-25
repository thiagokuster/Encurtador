export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

function ipv4Parts(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return null;
  return parts;
}

function isBlockedAddress(host: string): boolean {
  const name = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!name || name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name === "metadata.google.internal" || name.endsWith(".internal")) return true;
  if (name === "0.0.0.0" || name === "::" || name === "::1") return true;
  if (/^\d+$/.test(name) || name.includes("0x")) return true;
  if (!name.includes(".") && !name.includes(":")) return true;

  const ipv4 = ipv4Parts(name);
  if (ipv4) {
    const [a, b] = ipv4;
    if (a === 0 || a === 10 || a === 127 || a === 255) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (name.includes(":")) {
    const mapped = /::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(name);
    if (mapped) return isBlockedAddress(mapped[1]);
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
