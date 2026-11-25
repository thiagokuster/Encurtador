import type { RangeKey } from "@/lib/types";

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  from: number;
  to: number;
};

const DAY = 24 * 60 * 60 * 1000;

function success(key: RangeKey, label: string, from: number, to: number) {
  return { ok: true as const, range: { key, label, from, to } };
}

export function resolveRange(
  input: { range?: string | null; from?: string | null; to?: string | null },
  now = new Date(),
) {
  const key = input.range || "7d";
  const end = now.getTime() + 1;

  if (key === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return success("today", "Hoje", start.getTime(), end);
  }

  const presets: Record<string, { days: number; label: string }> = {
    "7d": { days: 7, label: "Últimos 7 dias" },
    "30d": { days: 30, label: "Últimos 30 dias" },
    "90d": { days: 90, label: "Últimos 90 dias" },
  };

  if (presets[key]) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (presets[key].days - 1));
    return success(key as RangeKey, presets[key].label, start.getTime(), end);
  }

  if (key !== "custom") return { ok: false as const, error: "Período inválido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.to || "")) {
    return { ok: false as const, error: "Informe as duas datas do período." };
  }

  const [fromYear, fromMonth, fromDay] = input.from!.split("-").map(Number);
  const [toYear, toMonth, toDay] = input.to!.split("-").map(Number);
  const from = new Date(fromYear, fromMonth - 1, fromDay, 0, 0, 0, 0).getTime();
  const toDate = new Date(toYear, toMonth - 1, toDay, 0, 0, 0, 0);
  toDate.setDate(toDate.getDate() + 1);
  const to = Math.min(toDate.getTime(), end);

  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return { ok: false as const, error: "Período inválido." };
  }
  if (toDate.getTime() - from > 366 * DAY) {
    return { ok: false as const, error: "O período máximo é de 366 dias." };
  }

  const label = `${input.from!.split("-").reverse().join("/")} – ${input.to!.split("-").reverse().join("/")}`;
  return success("custom", label, from, to);
}

export function eachLocalDay(from: number, toExclusive: number) {
  const days: string[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const last = toExclusive - 1;
  while (cursor.getTime() <= last && days.length < 400) {
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    days.push(`${cursor.getFullYear()}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
