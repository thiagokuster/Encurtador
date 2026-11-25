"use client";

export async function apiSend<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
    if (!body) body = "{}";
  }
  let response: Response;
  try {
    response = await fetch(url, { ...init, method, headers, body, cache: "no-store" });
  } catch {
    throw new Error("Sem conexão com o servidor.");
  }
  const isLogin = url.startsWith("/api/auth/login") || url.startsWith("/api/auth/register") || url.startsWith("/api/unlock");
  if (response.status === 401 && !isLogin) {
    window.location.href = "/login";
    throw new Error("Sessão expirada.");
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
  return data as T;
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export async function downloadUrl(url: string, filename: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível baixar o arquivo.");
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function rangeQuery(range: string, from = "", to = "", extra?: Record<string, string>) {
  const params = new URLSearchParams();
  params.set("range", range);
  if (range === "custom") {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  return params.toString();
}
