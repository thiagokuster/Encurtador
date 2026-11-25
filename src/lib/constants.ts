export const RESERVED_SLUGS = new Set([
  "admin",
  "analytics",
  "api",
  "app",
  "assets",
  "auth",
  "aviso",
  "dashboard",
  "edit",
  "export",
  "favicon",
  "forgot-password",
  "help",
  "icon",
  "link",
  "links",
  "login",
  "logout",
  "manifest",
  "me",
  "new",
  "novo",
  "privacy",
  "privacidade",
  "public",
  "qr",
  "register",
  "reset-password",
  "robots",
  "settings",
  "signin",
  "signup",
  "sitemap",
  "static",
  "status",
  "support",
  "termos",
  "unlock",
  "www",
]);

export const DEFAULT_QR_COLOR = "1C1915";
export const DEFAULT_QR_BACKGROUND = "FFFCF8";

export const RETENTION_OPTIONS = [30, 90, 180, 365, 730] as const;

export const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Celular",
  tablet: "Tablet",
  unknown: "Não identificado",
};

export const BROWSER_LABELS: Record<string, string> = {
  chrome: "Chrome",
  firefox: "Firefox",
  safari: "Safari",
  edge: "Edge",
  other: "Outros",
  unknown: "Não identificado",
};

export const OS_LABELS: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  android: "Android",
  ios: "iOS",
  other: "Outros",
  unknown: "Não identificado",
};

export const REFERRER_LABELS: Record<string, string> = {
  direct: "Acesso direto",
  google: "Google",
  social: "Redes sociais",
  external: "Sites externos",
  other: "Outros",
};

export const REGION_ORDER = [
  "América do Norte",
  "América Central e Caribe",
  "América do Sul",
  "Europa",
  "África",
  "Ásia",
  "Oceania",
  "Não classificada",
] as const;
