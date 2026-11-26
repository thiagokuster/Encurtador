import {
  BROWSER_LABELS,
  DEVICE_LABELS,
  OS_LABELS,
  REFERRER_LABELS,
} from "@/lib/constants";
import { formatDateTime, formatDayKey } from "@/lib/format";
import { eachLocalDay, resolveRange, type ResolvedRange } from "@/lib/ranges";
import type { CountPoint, LinkAnalytics, Overview, TimePoint } from "@/lib/types";
import { anonymizeIp, createId, getSecret, sha256 } from "@/server/crypto";
import { many, one, run, transaction } from "@/server/db";
import { ApiError } from "@/server/errors";
import { csvCell } from "@/lib/csv";
import { trustProxyEnabled } from "@/server/client-ip";
import { continentOf, countryName, readGeo } from "@/server/geo";
import { getOwnedLink } from "@/server/links";
import { publicBase, requestHost } from "@/server/request";
import { classifyReferrer } from "@/server/referrer";
import { clientIp, logSecurity } from "@/server/security";
import { getSettings } from "@/server/settings";
import { isBot, parseUserAgent } from "@/server/ua";

const DAY = 24 * 60 * 60 * 1000;
const GROUP_COLUMNS = new Set(["device", "browser", "os", "country", "region", "city", "referrer_category", "referrer_host"]);
const prunedAt = new Map<string, number>();

type Filter = { userId: string; from: number; to: number; linkId?: string };
type ClickInput = {
  linkId: string;
  userId: string;
  device: string;
  browser: string;
  os: string;
  country: string | null;
  region: string | null;
  city: string | null;
  referrerHost: string | null;
  referrerCategory: string;
  visitorHash: string;
};

export function shouldCountClick(req: Request) {
  const purpose = [req.headers.get("purpose"), req.headers.get("sec-purpose"), req.headers.get("x-purpose")]
    .filter(Boolean)
    .join(" ");
  if (/prefetch/i.test(purpose)) return false;
  if (req.headers.get("next-router-prefetch") === "1" || req.headers.get("x-middleware-prefetch") === "1") return false;
  return !isBot(req.headers.get("user-agent") || "");
}

export function buildClickInput(req: Request, link: { id: string; user_id: string }): ClickInput {
  const agent = parseUserAgent(req.headers.get("user-agent"));
  const geo = readGeo(req.headers, trustProxyEnabled());
  const referrer = classifyReferrer(req.headers.get("referer"), requestHost(req));
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const visitorHash = sha256(
    `${getSecret()}|${link.id}|${anonymizeIp(clientIp(req))}|${agent.family}|${day}`,
  ).slice(0, 32);

  return {
    linkId: link.id,
    userId: link.user_id,
    device: agent.device,
    browser: agent.browser,
    os: agent.os,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    referrerHost: referrer.host,
    referrerCategory: referrer.category,
    visitorHash,
  };
}

export function recordClick(input: ClickInput) {
  const settings = getSettings(input.userId);
  if (settings.analytics_enabled !== 1) return;
  const recent = one(
    "SELECT 1 AS hit FROM click_events WHERE link_id = ? AND visitor_hash = ? AND clicked_at > ? LIMIT 1",
    input.linkId,
    input.visitorHash,
    Date.now() - 3000,
  );
  if (recent) return;

  const now = Date.now();
  transaction(() => {
    run(
      `INSERT INTO click_events (
        id, link_id, user_id, clicked_at, device, browser, os, country, region, city, referrer_host, referrer_category, visitor_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      createId(),
      input.linkId,
      input.userId,
      now,
      input.device,
      input.browser,
      input.os,
      input.country,
      input.region,
      input.city,
      input.referrerHost,
      input.referrerCategory,
      input.visitorHash,
    );
    run("UPDATE links SET click_count = click_count + 1 WHERE id = ?", input.linkId);
  });
}

export function pruneRetainedEvents(userId: string, retentionDays: number, force = false) {
  const now = Date.now();
  if (!force && now - (prunedAt.get(userId) || 0) < 60 * 60 * 1000) return 0;
  prunedAt.set(userId, now);
  const info = run(
    "DELETE FROM click_events WHERE user_id = ? AND clicked_at < ?",
    userId,
    now - retentionDays * DAY,
  );
  return Number(info.changes || 0);
}

export function rangeFromUrl(url: URL) {
  const resolved = resolveRange({
    range: url.searchParams.get("range"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!resolved.ok) throw new ApiError(400, resolved.error);
  return resolved.range;
}

function clickWhere(filter: Filter) {
  const clauses = ["user_id = ?", "clicked_at >= ?", "clicked_at < ?"];
  const params: Array<string | number> = [filter.userId, filter.from, filter.to];
  if (filter.linkId) {
    clauses.push("link_id = ?");
    params.push(filter.linkId);
  }
  return { where: clauses.join(" AND "), params };
}

function countClicks(filter: Filter) {
  const { where, params } = clickWhere(filter);
  const row = one<{ n: number }>(`SELECT COUNT(*) AS n FROM click_events WHERE ${where}`, ...params);
  return Number(row?.n) || 0;
}

function countUnique(filter: Filter) {
  const { where, params } = clickWhere(filter);
  const row = one<{ n: number }>(
    `SELECT COUNT(DISTINCT visitor_hash) AS n FROM click_events WHERE ${where} AND visitor_hash IS NOT NULL`,
    ...params,
  );
  return Number(row?.n) || 0;
}

function grouped(filter: Filter, column: string, limit: number) {
  if (!GROUP_COLUMNS.has(column)) throw new Error("Coluna de analytics inválida.");
  const { where, params } = clickWhere(filter);
  return many<{ key: string; clicks: number }>(
    `SELECT ${column} AS key, COUNT(*) AS clicks
     FROM click_events
     WHERE ${where} AND ${column} IS NOT NULL AND ${column} != ''
     GROUP BY ${column}
     ORDER BY clicks DESC
     LIMIT ?`,
    ...params,
    limit,
  );
}

function withLabels(rows: Array<{ key: string; clicks: number }>, labels: Record<string, string>): CountPoint[] {
  return rows
    .filter((row) => Number(row.clicks) > 0)
    .map((row) => ({
      key: String(row.key),
      label: labels[String(row.key)] || String(row.key),
      clicks: Number(row.clicks),
    }));
}

function timeline(filter: Filter, range: ResolvedRange): TimePoint[] {
  const { where, params } = clickWhere(filter);
  if (range.to - range.from <= 36 * 60 * 60 * 1000) {
    const rows = many<{ key: string; clicks: number }>(
      `SELECT strftime('%H', clicked_at / 1000, 'unixepoch', 'localtime') AS key, COUNT(*) AS clicks
       FROM click_events WHERE ${where} GROUP BY key`,
      ...params,
    );
    const map = new Map(rows.map((row) => [Number(row.key), Number(row.clicks)]));
    const start = new Date(filter.from);
    const end = new Date(Math.max(filter.from, filter.to - 1));
    const first = start.toDateString() === end.toDateString() ? start.getHours() : 0;
    const points: TimePoint[] = [];
    for (let hour = first; hour <= end.getHours(); hour += 1) {
      points.push({
        key: String(hour),
        label: `${String(hour).padStart(2, "0")}h`,
        clicks: map.get(hour) || 0,
      });
    }
    return points;
  }

  const rows = many<{ key: string; clicks: number }>(
    `SELECT date(clicked_at / 1000, 'unixepoch', 'localtime') AS key, COUNT(*) AS clicks
     FROM click_events WHERE ${where} GROUP BY key`,
    ...params,
  );
  const map = new Map(rows.map((row) => [String(row.key), Number(row.clicks)]));
  return eachLocalDay(filter.from, filter.to).map((day) => ({
    key: day,
    label: formatDayKey(day),
    clicks: map.get(day) || 0,
  }));
}

function hourHistogram(filter: Filter): TimePoint[] {
  const { where, params } = clickWhere(filter);
  const rows = many<{ key: string; clicks: number }>(
    `SELECT strftime('%H', clicked_at / 1000, 'unixepoch', 'localtime') AS key, COUNT(*) AS clicks
     FROM click_events WHERE ${where} GROUP BY key`,
    ...params,
  );
  const map = new Map(rows.map((row) => [Number(row.key), Number(row.clicks)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour),
    label: `${String(hour).padStart(2, "0")}h`,
    clicks: map.get(hour) || 0,
  }));
}

function breakdown(filter: Filter) {
  const countries = grouped(filter, "country", 250).map((row) => ({
    key: String(row.key),
    label: countryName(String(row.key)) || String(row.key),
    clicks: Number(row.clicks),
  }));
  const continents = new Map<string, number>();
  for (const country of countries) {
    const name = continentOf(country.key) || "Não classificada";
    continents.set(name, (continents.get(name) || 0) + country.clicks);
  }
  return {
    devices: withLabels(grouped(filter, "device", 10), DEVICE_LABELS),
    browsers: withLabels(grouped(filter, "browser", 10), BROWSER_LABELS),
    operatingSystems: withLabels(grouped(filter, "os", 10), OS_LABELS),
    countries: countries.slice(0, 12),
    continents: [...continents.entries()]
      .map(([key, clicks]) => ({ key, label: key, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
    subdivisions: grouped(filter, "region", 12).map((row) => ({
      key: String(row.key),
      label: String(row.key),
      clicks: Number(row.clicks),
    })),
    referrers: withLabels(grouped(filter, "referrer_category", 10), REFERRER_LABELS),
    referrerHosts: grouped(filter, "referrer_host", 8).map((row) => ({
      key: String(row.key),
      label: String(row.key),
      clicks: Number(row.clicks),
    })),
    cities: grouped(filter, "city", 12).map((row) => ({
      key: String(row.key),
      label: String(row.key),
      clicks: Number(row.clicks),
    })),
  };
}

function scope(userId: string, range: ResolvedRange, linkId?: string) {
  const settings = getSettings(userId);
  pruneRetainedEvents(userId, settings.retention_days);
  const retentionStart = Date.now() - settings.retention_days * DAY;
  const truncated = range.from < retentionStart;
  const length = range.to - range.from;
  const comparable = !truncated && range.from - length >= retentionStart;
  return {
    settings,
    truncated,
    filter: { userId, from: Math.max(range.from, retentionStart), to: range.to, linkId },
    previous: comparable
      ? { userId, from: range.from - length, to: range.from, linkId }
      : null,
  };
}

function rangeInfo(range: ResolvedRange) {
  return {
    key: range.key,
    label: range.label,
    from: new Date(range.from).toISOString(),
    to: new Date(range.to).toISOString(),
  };
}

export function overview(userId: string, range: ResolvedRange, req: Request): Overview {
  const scoped = scope(userId, range);
  const base = publicBase(req, scoped.settings.domain);
  const lifetime = one<{ links: number; clicks: number }>(
    "SELECT COUNT(*) AS links, COALESCE(SUM(click_count), 0) AS clicks FROM links WHERE user_id = ?",
    userId,
  );
  const linkCount = Number(lifetime?.links) || 0;
  const clickTotal = Number(lifetime?.clicks) || 0;
  const week = resolveRange({ range: "7d" });
  const month = resolveRange({ range: "30d" });
  const retentionStart = Date.now() - scoped.settings.retention_days * DAY;
  const clicksInRange = countClicks(scoped.filter);
  const previousClicks = scoped.previous ? countClicks(scoped.previous) : null;
  const last = one<{ last: number | null }>("SELECT MAX(clicked_at) AS last FROM click_events WHERE user_id = ?", userId);
  const parts = breakdown(scoped.filter);
  const recent = many<{
    id: string;
    slug: string;
    title: string | null;
    original_url: string;
    click_count: number;
    created_at: number;
  }>(
    "SELECT id, slug, title, original_url, click_count, created_at FROM links WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
    userId,
  );
  const top = many<{ id: string; slug: string; title: string | null; clicks: number }>(
    `SELECT l.id, l.slug, l.title, COUNT(c.id) AS clicks
     FROM links l
     JOIN click_events c ON c.link_id = l.id AND c.clicked_at >= ? AND c.clicked_at < ?
     WHERE l.user_id = ?
     GROUP BY l.id
     ORDER BY clicks DESC
     LIMIT 8`,
    scoped.filter.from,
    scoped.filter.to,
    userId,
  );

  return {
    generatedAt: new Date().toISOString(),
    range: rangeInfo(range),
    retentionDays: scoped.settings.retention_days,
    analyticsEnabled: scoped.settings.analytics_enabled === 1,
    truncatedByRetention: scoped.truncated,
    totals: {
      links: linkCount,
      clicks: clickTotal,
      clicks7d: week.ok ? countClicks({ userId, from: Math.max(week.range.from, retentionStart), to: week.range.to }) : 0,
      clicks30d: month.ok ? countClicks({ userId, from: Math.max(month.range.from, retentionStart), to: month.range.to }) : 0,
      clicksInRange,
      uniqueInRange: countUnique(scoped.filter),
      avgPerLink: linkCount === 0 ? null : clickTotal / linkCount,
      growth: growth(clicksInRange, previousClicks),
      previousClicks,
      lastClickAt: last?.last ? new Date(last.last).toISOString() : null,
    },
    series: timeline(scoped.filter, { ...range, from: scoped.filter.from }),
    devices: parts.devices,
    browsers: parts.browsers,
    operatingSystems: parts.operatingSystems,
    countries: parts.countries,
    continents: parts.continents,
    subdivisions: parts.subdivisions,
    referrers: parts.referrers,
    referrerHosts: parts.referrerHosts,
    topLinks: top.map((link) => ({
      id: link.id,
      slug: link.slug,
      title: link.title,
      shortUrl: `${base}/${link.slug}`,
      clicks: Number(link.clicks) || 0,
    })),
    recentLinks: recent.map((link) => ({
      id: link.id,
      slug: link.slug,
      title: link.title,
      shortUrl: `${base}/${link.slug}`,
      originalUrl: link.original_url,
      clicks: Number(link.click_count) || 0,
      createdAt: new Date(link.created_at).toISOString(),
    })),
  };
}

export function linkAnalytics(userId: string, linkId: string, range: ResolvedRange, req: Request): LinkAnalytics {
  const link = getOwnedLink(userId, linkId, req);
  if (!link) throw new ApiError(404, "Link não encontrado.");
  const scoped = scope(userId, range, linkId);
  const clicksInRange = countClicks(scoped.filter);
  const previousClicks = scoped.previous ? countClicks(scoped.previous) : null;
  const parts = breakdown(scoped.filter);
  return {
    generatedAt: new Date().toISOString(),
    link,
    range: rangeInfo(range),
    retentionDays: scoped.settings.retention_days,
    analyticsEnabled: scoped.settings.analytics_enabled === 1,
    truncatedByRetention: scoped.truncated,
    totals: {
      clicks: link.clickCount,
      clicksInRange,
      uniqueInRange: countUnique(scoped.filter),
      growth: growth(clicksInRange, previousClicks),
      previousClicks,
      lastClickAt: link.lastClickAt,
    },
    series: timeline(scoped.filter, { ...range, from: scoped.filter.from }),
    hours: hourHistogram(scoped.filter),
    devices: parts.devices,
    browsers: parts.browsers,
    operatingSystems: parts.operatingSystems,
    countries: parts.countries,
    continents: parts.continents,
    subdivisions: parts.subdivisions,
    cities: parts.cities,
    referrers: parts.referrers,
    referrerHosts: parts.referrerHosts,
  };
}

function growth(current: number, previous: number | null) {
  if (previous == null || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function purgeAnalytics(userId: string, linkId?: string) {
  if (linkId) {
    const link = one("SELECT id FROM links WHERE id = ? AND user_id = ?", linkId, userId);
    if (!link) throw new ApiError(404, "Link não encontrado.");
    run("DELETE FROM click_events WHERE link_id = ? AND user_id = ?", linkId, userId);
    run("UPDATE links SET click_count = 0, updated_at = ? WHERE id = ? AND user_id = ?", Date.now(), linkId, userId);
    logSecurity(userId, "analytics_purged", "Analytics de um link excluídos.");
  } else {
    run("DELETE FROM click_events WHERE user_id = ?", userId);
    run("UPDATE links SET click_count = 0, updated_at = ? WHERE user_id = ?", Date.now(), userId);
    logSecurity(userId, "analytics_purged", "Analytics de todos os links excluídos.");
  }
  return { ok: true };
}

export function exportCsv(userId: string, range: ResolvedRange, linkId?: string) {
  if (linkId) {
    const link = one("SELECT id FROM links WHERE id = ? AND user_id = ?", linkId, userId);
    if (!link) throw new ApiError(404, "Link não encontrado.");
  }
  const settings = getSettings(userId);
  const from = Math.max(range.from, Date.now() - settings.retention_days * DAY);
  const params: Array<string | number> = [userId, from, range.to];
  let linkClause = "";
  if (linkId) {
    linkClause = " AND c.link_id = ?";
    params.push(linkId);
  }
  const count = one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM click_events c WHERE c.user_id = ? AND c.clicked_at >= ? AND c.clicked_at < ?${linkClause}`,
    ...params,
  );
  if ((Number(count?.n) || 0) > 10000) {
    throw new ApiError(400, "Há eventos demais nesse período. Reduza o intervalo para exportar.");
  }
  const rows = many<{
    clicked_at: number;
    slug: string;
    title: string | null;
    original_url: string;
    device: string | null;
    browser: string | null;
    os: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    referrer_host: string | null;
    referrer_category: string | null;
  }>(
    `SELECT c.clicked_at, l.slug, l.title, l.original_url, c.device, c.browser, c.os, c.country, c.region, c.city, c.referrer_host, c.referrer_category
     FROM click_events c JOIN links l ON l.id = c.link_id
     WHERE c.user_id = ? AND c.clicked_at >= ? AND c.clicked_at < ?${linkClause}
     ORDER BY c.clicked_at DESC`,
    ...params,
  );
  const header = [
    "data_iso",
    "data_local",
    "slug",
    "titulo",
    "url_original",
    "dispositivo",
    "navegador",
    "sistema",
    "pais",
    "regiao",
    "cidade",
    "origem",
    "categoria",
  ];
  const lines = rows.map((row) =>
    [
      new Date(row.clicked_at).toISOString(),
      formatDateTime(row.clicked_at),
      row.slug,
      row.title || "",
      row.original_url,
      DEVICE_LABELS[row.device || ""] || "",
      BROWSER_LABELS[row.browser || ""] || "",
      OS_LABELS[row.os || ""] || "",
      countryName(row.country) || "",
      row.region || "",
      row.city || "",
      row.referrer_host || "",
      REFERRER_LABELS[row.referrer_category || ""] || "",
    ]
      .map(csvCell)
      .join(";"),
  );
  return `\uFEFF${header.join(";")}\n${lines.join("\n")}`;
}
