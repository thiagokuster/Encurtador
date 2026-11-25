const BOT =
  /bot|spider|crawler|slurp|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp\/\d|embedly|pinterestbot|applebot|bingbot|googlebot|yandex|duckduckbot|baiduspider|semrush|ahrefs|petalbot|wget|curl\/|python-requests|go-http-client|headlesschrome|phantomjs/i;

export function isBot(userAgent: string) {
  return BOT.test(userAgent);
}

export function parseUserAgent(userAgent: string | null) {
  const raw = userAgent || "";
  const value = raw.toLowerCase();

  let os = "other";
  if (!raw) os = "unknown";
  else if (value.includes("android")) os = "android";
  else if (/iphone|ipad|ipod/.test(value)) os = "ios";
  else if (value.includes("windows nt")) os = "windows";
  else if (/mac os x|macintosh/.test(value)) os = "macos";
  else if (value.includes("linux")) os = "linux";

  let device = "desktop";
  if (!raw) device = "unknown";
  else if (/ipad|tablet|playbook|silk/.test(value) || (value.includes("android") && !value.includes("mobile"))) device = "tablet";
  else if (/mobi|iphone|ipod|android/.test(value)) device = "mobile";

  let browser = "other";
  if (!raw) browser = "unknown";
  else if (value.includes("edg/")) browser = "edge";
  else if (/firefox\/|fxios/.test(value)) browser = "firefox";
  else if (/chrome\/|crios\/|chromium/.test(value) && !value.includes("edg/")) browser = "chrome";
  else if (value.includes("safari")) browser = "safari";

  return {
    device,
    browser,
    os,
    family: `${device}|${browser}|${os}`,
  };
}
