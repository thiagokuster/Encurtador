import bcrypt from "bcryptjs";
import crypto from "crypto";
import { DEFAULT_QR_BACKGROUND, DEFAULT_QR_COLOR } from "@/lib/constants";
import type { LinkDTO, LinksPage, LinkState } from "@/lib/types";
import { validatePublicUrl } from "@/lib/url-policy";
import {
  colorContrast,
  parseExpiresAt,
  parseTags,
  validateHexColor,
  validateLinkPassword,
  validateOptionalText,
  validateRedirect,
  validateSlug,
} from "@/lib/validators";
import { createId } from "@/server/crypto";
import { many, one, run, transaction } from "@/server/db";
import { ApiError } from "@/server/errors";
import { publicBase, requestHost } from "@/server/request";
import { logSecurity } from "@/server/security";
import { getSettings } from "@/server/settings";

type LinkRow = {
  id: string;
  user_id: string;
  slug: string;
  original_url: string;
  title: string | null;
  description: string | null;
  status: "active" | "inactive";
  redirect_type: number;
  expires_at: number | null;
  password_hash: string | null;
  click_count: number;
  qr_color: string;
  qr_background: string;
  created_at: number;
  updated_at: number;
  last_click_at?: number | null;
  tag_names?: string | null;
};

const LINK_COLUMNS = `
  l.id, l.user_id, l.slug, l.original_url, l.title, l.description, l.status, l.redirect_type,
  l.expires_at, l.password_hash, l.click_count, l.qr_color, l.qr_background, l.created_at, l.updated_at,
  (SELECT MAX(c.clicked_at) FROM click_events c WHERE c.link_id = l.id) AS last_click_at,
  (SELECT group_concat(t.name, ',') FROM link_tags lt JOIN tags t ON t.id = lt.tag_id WHERE lt.link_id = l.id) AS tag_names
`;

const ORDERS: Record<string, string> = {
  created_desc: "l.created_at DESC",
  created_asc: "l.created_at ASC",
  clicks_desc: "l.click_count DESC, l.created_at DESC",
  clicks_asc: "l.click_count ASC, l.created_at DESC",
  title_asc: "lower(coalesce(l.title, l.slug)) ASC",
  title_desc: "lower(coalesce(l.title, l.slug)) DESC",
  status_asc: "l.status ASC, l.created_at DESC",
  status_desc: "l.status DESC, l.created_at DESC",
};

function isUnique(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE");
}

function stateOf(row: Pick<LinkRow, "status" | "expires_at">): LinkState {
  if (row.expires_at && row.expires_at <= Date.now()) return "expired";
  return row.status === "active" ? "active" : "inactive";
}

export function toLinkDTO(row: LinkRow, base: string): LinkDTO {
  return {
    id: row.id,
    slug: row.slug,
    shortUrl: `${base.replace(/\/$/, "")}/${row.slug}`,
    originalUrl: row.original_url,
    title: row.title,
    description: row.description,
    status: row.status,
    state: stateOf(row),
    redirectType: row.redirect_type === 301 ? 301 : 302,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    hasPassword: Boolean(row.password_hash),
    tags: row.tag_names ? row.tag_names.split(",").filter(Boolean) : [],
    clickCount: Number(row.click_count) || 0,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    qrColor: row.qr_color,
    qrBackground: row.qr_background,
    lastClickAt: row.last_click_at ? new Date(row.last_click_at).toISOString() : null,
  };
}

function readLink(id: string, userId: string) {
  return one<LinkRow>(`SELECT ${LINK_COLUMNS} FROM links l WHERE l.id = ? AND l.user_id = ?`, id, userId);
}

export function getOwnedLink(userId: string, id: string, req: Request) {
  const row = readLink(id, userId);
  if (!row) return null;
  const settings = getSettings(userId);
  return toLinkDTO(row, publicBase(req, settings.domain));
}

export function getLinkBySlug(slug: string) {
  return one<LinkRow>("SELECT * FROM links WHERE slug = ?", slug);
}

function like(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function replaceTags(linkId: string, userId: string, tags: string[]) {
  run("DELETE FROM link_tags WHERE link_id = ?", linkId);
  for (const name of tags) {
    let tag = one<{ id: string }>("SELECT id FROM tags WHERE user_id = ? AND name = ?", userId, name);
    if (!tag) {
      const id = createId();
      try {
        run("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)", id, userId, name);
        tag = { id };
      } catch (error) {
        if (!isUnique(error)) throw error;
        tag = one<{ id: string }>("SELECT id FROM tags WHERE user_id = ? AND name = ?", userId, name);
      }
    }
    if (tag) run("INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)", linkId, tag.id);
  }
  run("DELETE FROM tags WHERE user_id = ? AND id NOT IN (SELECT tag_id FROM link_tags)", userId);
}

function generateSlug() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ2345679";
  const bytes = crypto.randomBytes(7);
  let slug = "";
  for (const byte of bytes) slug += alphabet[byte % alphabet.length];
  if (validateSlug(slug)) return generateSlug();
  return slug;
}

export function slugAvailability(slug: string, exceptId?: string) {
  const error = validateSlug(slug);
  if (error) return { available: false, error };
  const row = one<{ id: string }>("SELECT id FROM links WHERE slug = ?", slug);
  if (row && row.id !== exceptId) return { available: false, error: "Esse endereço curto já está em uso." };
  return { available: true, error: null as string | null };
}

export function listLinks(userId: string, url: URL, req: Request): LinksPage {
  const page = Math.min(10000, Math.max(1, Number(url.searchParams.get("page")) || 1));
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const status = url.searchParams.get("status") || "all";
  const tag = (url.searchParams.get("tag") || "").trim().toLowerCase();
  const sort = url.searchParams.get("sort") || "created";
  const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  const order = ORDERS[`${sort}_${dir}`] || ORDERS.created_desc;
  const where = ["l.user_id = ?"];
  const params: Array<string | number> = [userId];
  const now = Date.now();

  if (status === "active") {
    where.push("l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > ?)");
    params.push(now);
  } else if (status === "inactive") {
    where.push("l.status = 'inactive'");
  } else if (status === "expired") {
    where.push("l.expires_at IS NOT NULL AND l.expires_at <= ?");
    params.push(now);
  } else if (status !== "all") {
    throw new ApiError(400, "Filtro de status inválido.");
  }

  if (tag) {
    const parsed = parseTags([tag]);
    if (!parsed.ok) throw new ApiError(400, parsed.error);
    where.push(
      "EXISTS (SELECT 1 FROM link_tags lt JOIN tags t ON t.id = lt.tag_id WHERE lt.link_id = l.id AND t.user_id = ? AND t.name = ?)",
    );
    params.push(userId, parsed.tags[0]);
  }

  if (q) {
    const pattern = like(q);
    where.push(`(
      l.slug LIKE ? ESCAPE '\\' OR
      l.original_url LIKE ? ESCAPE '\\' OR
      IFNULL(l.title, '') LIKE ? ESCAPE '\\' OR
      IFNULL(l.description, '') LIKE ? ESCAPE '\\' OR
      EXISTS (
        SELECT 1 FROM link_tags lt JOIN tags t ON t.id = lt.tag_id
        WHERE lt.link_id = l.id AND t.name LIKE ? ESCAPE '\\'
      )
    )`);
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  const whereSql = where.join(" AND ");
  const totalRow = one<{ n: number }>(`SELECT COUNT(*) AS n FROM links l WHERE ${whereSql}`, ...params);
  const rows = many<LinkRow>(
    `SELECT ${LINK_COLUMNS} FROM links l WHERE ${whereSql} ORDER BY ${order} LIMIT 10 OFFSET ?`,
    ...params,
    (page - 1) * 10,
  );
  const settings = getSettings(userId);
  const base = publicBase(req, settings.domain);
  const tags = many<{ name: string }>("SELECT name FROM tags WHERE user_id = ? ORDER BY name", userId).map((tagRow) => tagRow.name);

  return {
    links: rows.map((row) => toLinkDTO(row, base)),
    total: Number(totalRow?.n) || 0,
    page,
    pageSize: 10,
    tags,
  };
}

export function createLink(userId: string, body: Record<string, unknown>, req: Request) {
  const settings = getSettings(userId);
  const limit = Math.min(Number(settings.link_limit) || 500, 2000);
  const existing = one<{ n: number }>("SELECT COUNT(*) AS n FROM links WHERE user_id = ?", userId);
  if ((existing?.n || 0) >= limit) {
    throw new ApiError(429, `Você atingiu o limite de ${limit} links. Ajuste o limite nas configurações ou exclua um link.`);
  }

  const checked = validatePublicUrl(String(body.originalUrl ?? ""), requestHost(req));
  if (!checked.ok) {
    logSecurity(userId, "suspicious_url", "URL recusada na criação do link.");
    throw new ApiError(400, checked.error);
  }

  const title = validateOptionalText(body.title, 80, "O título");
  if (!title.ok) throw new ApiError(400, title.error);
  const description = validateOptionalText(body.description, 280, "A descrição");
  if (!description.ok) throw new ApiError(400, description.error);
  const tags = parseTags(Array.isArray(body.tags) ? (body.tags as string[]) : typeof body.tags === "string" ? body.tags : []);
  if (!tags.ok) throw new ApiError(400, tags.error);
  const redirect = validateRedirect(body.redirectType, settings.default_redirect === 301 ? 301 : 302);
  if (!redirect) throw new ApiError(400, "Tipo de redirecionamento inválido.");
  const expires = parseExpiresAt(body.expiresAt);
  if (!expires.ok) throw new ApiError(400, expires.error);

  let passwordHash: string | null = null;
  if (typeof body.password === "string" && body.password.length > 0) {
    const passwordError = validateLinkPassword(body.password);
    if (passwordError) throw new ApiError(400, passwordError);
    passwordHash = bcrypt.hashSync(body.password, 12);
  }

  const requested = typeof body.slug === "string" ? body.slug.trim() : "";
  if (requested) {
    const formatError = validateSlug(requested);
    if (formatError) throw new ApiError(400, formatError);
    const availability = slugAvailability(requested);
    if (!availability.available) throw new ApiError(409, availability.error || "Esse endereço curto já está em uso.");
  }

  const now = Date.now();
  let slug = requested;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!slug) slug = generateSlug();
    const id = createId();
    try {
      transaction(() => {
        run(
          `INSERT INTO links (
            id, user_id, slug, original_url, title, description, status, redirect_type, expires_at,
            password_hash, click_count, qr_color, qr_background, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, 0, ?, ?, ?, ?)`,
          id,
          userId,
          slug,
          checked.url,
          title.value,
          description.value,
          redirect,
          expires.value,
          passwordHash,
          DEFAULT_QR_COLOR,
          DEFAULT_QR_BACKGROUND,
          now,
          now,
        );
        replaceTags(id, userId, tags.tags);
      });
      logSecurity(userId, "link_created", "Link criado.");
      const created = readLink(id, userId);
      if (!created) throw new ApiError(500, "Não foi possível carregar o link criado.");
      return { link: toLinkDTO(created, publicBase(req, settings.domain)) };
    } catch (error) {
      if (!isUnique(error)) throw error;
      if (requested) throw new ApiError(409, "Esse endereço curto já está em uso.");
      slug = "";
    }
  }
  throw new ApiError(500, "Não foi possível gerar um endereço curto. Tente novamente.");
}

export function updateLink(userId: string, id: string, body: Record<string, unknown>, req: Request) {
  const current = one<LinkRow>("SELECT * FROM links WHERE id = ? AND user_id = ?", id, userId);
  if (!current) throw new ApiError(404, "Link não encontrado.");

  const sets: string[] = [];
  const params: Array<string | number | null> = [];
  let nextTags: string[] | null = null;

  if ("originalUrl" in body) {
    const checked = validatePublicUrl(String(body.originalUrl ?? ""), requestHost(req));
    if (!checked.ok) {
      logSecurity(userId, "suspicious_url", "URL recusada na edição do link.");
      throw new ApiError(400, checked.error);
    }
    sets.push("original_url = ?");
    params.push(checked.url);
  }

  if ("slug" in body) {
    const slug = String(body.slug ?? "").trim();
    if (slug.toLowerCase() !== current.slug.toLowerCase()) {
      const formatError = validateSlug(slug);
      if (formatError) throw new ApiError(400, formatError);
      const availability = slugAvailability(slug, id);
      if (!availability.available) throw new ApiError(409, availability.error || "Esse endereço curto já está em uso.");
      sets.push("slug = ?");
      params.push(slug);
    }
  }

  if ("title" in body) {
    const title = validateOptionalText(body.title, 80, "O título");
    if (!title.ok) throw new ApiError(400, title.error);
    sets.push("title = ?");
    params.push(title.value);
  }

  if ("description" in body) {
    const description = validateOptionalText(body.description, 280, "A descrição");
    if (!description.ok) throw new ApiError(400, description.error);
    sets.push("description = ?");
    params.push(description.value);
  }

  if ("tags" in body) {
    const tags = parseTags(Array.isArray(body.tags) ? (body.tags as string[]) : typeof body.tags === "string" ? body.tags : []);
    if (!tags.ok) throw new ApiError(400, tags.error);
    nextTags = tags.tags;
  }

  if ("redirectType" in body) {
    const redirect = validateRedirect(body.redirectType, 302);
    if (!redirect) throw new ApiError(400, "Tipo de redirecionamento inválido.");
    sets.push("redirect_type = ?");
    params.push(redirect);
  }

  if ("expiresAt" in body) {
    const expires = parseExpiresAt(body.expiresAt);
    if (!expires.ok) throw new ApiError(400, expires.error);
    sets.push("expires_at = ?");
    params.push(expires.value);
  }

  if ("status" in body) {
    if (body.status !== "active" && body.status !== "inactive") throw new ApiError(400, "Status inválido.");
    sets.push("status = ?");
    params.push(body.status);
  }

  if ("password" in body) {
    if (body.password == null || body.password === "") {
      sets.push("password_hash = ?");
      params.push(null);
    } else if (typeof body.password === "string") {
      const passwordError = validateLinkPassword(body.password);
      if (passwordError) throw new ApiError(400, passwordError);
      sets.push("password_hash = ?");
      params.push(bcrypt.hashSync(body.password, 12));
    } else {
      throw new ApiError(400, "Senha do link inválida.");
    }
  }

  let qrColor = current.qr_color;
  let qrBackground = current.qr_background;
  if ("qrColor" in body) {
    const color = validateHexColor(String(body.qrColor ?? ""));
    if (!color) throw new ApiError(400, "Cor do QR Code inválida.");
    qrColor = color;
  }
  if ("qrBackground" in body) {
    const color = validateHexColor(String(body.qrBackground ?? ""));
    if (!color) throw new ApiError(400, "Fundo do QR Code inválido.");
    qrBackground = color;
  }
  if (qrColor !== current.qr_color || qrBackground !== current.qr_background) {
    if (colorContrast(qrColor, qrBackground) < 3) {
      throw new ApiError(400, "As cores do QR Code precisam de mais contraste para a leitura.");
    }
    sets.push("qr_color = ?", "qr_background = ?");
    params.push(qrColor, qrBackground);
  }

  sets.push("updated_at = ?");
  params.push(Date.now());

  try {
    transaction(() => {
      run(`UPDATE links SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, ...params, id, userId);
      if (nextTags) replaceTags(id, userId, nextTags);
    });
  } catch (error) {
    if (isUnique(error)) throw new ApiError(409, "Esse endereço curto já está em uso.");
    throw error;
  }

  const link = getOwnedLink(userId, id, req);
  if (!link) throw new ApiError(404, "Link não encontrado.");
  return { link };
}

export function deleteLink(userId: string, id: string) {
  const info = run("DELETE FROM links WHERE id = ? AND user_id = ?", id, userId);
  if (!Number(info.changes)) throw new ApiError(404, "Link não encontrado.");
  run("DELETE FROM tags WHERE user_id = ? AND id NOT IN (SELECT tag_id FROM link_tags)", userId);
  logSecurity(userId, "link_deleted", "Link excluído.");
  return { ok: true };
}
