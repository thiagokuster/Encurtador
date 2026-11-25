export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatDecimal(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

export function formatGrowth(value: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatDecimal(value)}%`;
}

export function formatDateTime(value: string | number | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDayKey(isoDay: string) {
  const [year, month, day] = isoDay.split("-").map(Number);
  if (!year || !month || !day) return isoDay;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(year, month - 1, day));
}

export function timeAgo(value: string | null) {
  if (!value) return "Ainda não houve acessos";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} d`;
  return formatDateTime(value);
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
