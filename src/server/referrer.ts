const SOCIAL = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "l.instagram.com",
  "twitter.com",
  "x.com",
  "t.co",
  "linkedin.com",
  "lnkd.in",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "whatsapp.com",
  "wa.me",
  "telegram.org",
  "t.me",
  "reddit.com",
  "pinterest.com",
  "threads.net",
  "snapchat.com",
];

function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function classifyReferrer(referrer: string | null, requestHost: string) {
  if (!referrer) return { host: null as string | null, category: "direct" };
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return { host: null, category: "other" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { host: null, category: "other" };

  const host = url.hostname.toLowerCase().replace(/^www\./, "").slice(0, 253);
  const own = requestHost.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  if (!host || host === own || host.endsWith(`.${own}`) || own.endsWith(`.${host}`)) {
    return { host: null, category: "direct" };
  }
  if (/(^|\.)google\./.test(host) || host === "google.com") return { host, category: "google" };
  if (SOCIAL.some((domain) => hostMatches(host, domain))) return { host, category: "social" };
  return { host, category: "external" };
}
