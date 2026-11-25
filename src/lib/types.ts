export type Theme = "light" | "dark" | "system";
export type LinkStatus = "active" | "inactive";
export type LinkState = "active" | "inactive" | "expired";
export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";

export type LinkDTO = {
  id: string;
  slug: string;
  shortUrl: string;
  originalUrl: string;
  title: string | null;
  description: string | null;
  status: LinkStatus;
  state: LinkState;
  redirectType: 301 | 302;
  expiresAt: string | null;
  hasPassword: boolean;
  tags: string[];
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  qrColor: string;
  qrBackground: string;
  lastClickAt: string | null;
};

export type TimePoint = { key: string; label: string; clicks: number };
export type CountPoint = { key: string; label: string; clicks: number };

export type RangeInfo = {
  key: RangeKey;
  label: string;
  from: string;
  to: string;
};

export type OverviewTotals = {
  links: number;
  clicks: number;
  clicks7d: number;
  clicks30d: number;
  clicksInRange: number;
  uniqueInRange: number;
  avgPerLink: number | null;
  growth: number | null;
  previousClicks: number | null;
  lastClickAt: string | null;
};

export type Overview = {
  generatedAt: string;
  range: RangeInfo;
  retentionDays: number;
  analyticsEnabled: boolean;
  truncatedByRetention: boolean;
  totals: OverviewTotals;
  series: TimePoint[];
  devices: CountPoint[];
  browsers: CountPoint[];
  operatingSystems: CountPoint[];
  countries: CountPoint[];
  continents: CountPoint[];
  subdivisions: CountPoint[];
  referrers: CountPoint[];
  referrerHosts: CountPoint[];
  topLinks: Array<{
    id: string;
    slug: string;
    title: string | null;
    shortUrl: string;
    clicks: number;
  }>;
  recentLinks: Array<{
    id: string;
    slug: string;
    title: string | null;
    shortUrl: string;
    originalUrl: string;
    clicks: number;
    createdAt: string;
  }>;
};

export type LinkAnalytics = {
  generatedAt: string;
  link: LinkDTO;
  range: RangeInfo;
  retentionDays: number;
  analyticsEnabled: boolean;
  truncatedByRetention: boolean;
  totals: {
    clicks: number;
    clicksInRange: number;
    uniqueInRange: number;
    growth: number | null;
    previousClicks: number | null;
    lastClickAt: string | null;
  };
  series: TimePoint[];
  hours: TimePoint[];
  devices: CountPoint[];
  browsers: CountPoint[];
  operatingSystems: CountPoint[];
  countries: CountPoint[];
  continents: CountPoint[];
  subdivisions: CountPoint[];
  cities: CountPoint[];
  referrers: CountPoint[];
  referrerHosts: CountPoint[];
};

export type LinksPage = {
  links: LinkDTO[];
  total: number;
  page: number;
  pageSize: number;
  tags: string[];
};

export type SecurityLogDTO = {
  id: string;
  event: string;
  message: string;
  createdAt: string;
};

export type SettingsDTO = {
  theme: Theme;
  domain: string | null;
  analyticsEnabled: boolean;
  retentionDays: number;
  defaultRedirect: 301 | 302;
  linkLimit: number;
  registrationOpen: boolean;
  baseUrl: string;
  account: { name: string; email: string; createdAt: string };
  logs: SecurityLogDTO[];
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};
