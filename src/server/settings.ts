import type { SettingsDTO, Theme } from "@/lib/types";
import {
  validateLinkLimit,
  validateName,
  validateRedirect,
  validateRetention,
} from "@/lib/validators";
import { changePassword } from "@/server/auth";
import { one, many, run } from "@/server/db";
import { ApiError } from "@/server/errors";
import { publicBase } from "@/server/request";
import { ensureAdmin, isRegistrationOpen, logSecurity, setRegistrationOpen, userIsAdmin } from "@/server/security";

export type SettingsRow = {
  user_id: string;
  theme: Theme;
  domain: string | null;
  analytics_enabled: number;
  retention_days: number;
  default_redirect: number;
  link_limit: number;
  updated_at: number;
};

type LogRow = { id: string; event: string; message: string; created_at: number };

const THEMES = new Set<Theme>(["light", "dark", "system"]);

export function getSettings(userId: string) {
  const existing = one<SettingsRow>("SELECT * FROM settings WHERE user_id = ?", userId);
  if (existing) return existing;
  const now = Date.now();
  run(
    `INSERT INTO settings (user_id, theme, domain, analytics_enabled, retention_days, default_redirect, link_limit, updated_at)
     VALUES (?, 'system', NULL, 1, 365, 302, 500, ?)`,
    userId,
    now,
  );
  const created = one<SettingsRow>("SELECT * FROM settings WHERE user_id = ?", userId);
  if (!created) throw new ApiError(500, "Não foi possível preparar as configurações.");
  return created;
}

function validateDomain(input: unknown) {
  if (input == null || input === "") return null;
  if (typeof input !== "string") throw new ApiError(400, "Domínio inválido.");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ApiError(400, "Informe uma origem válida, como https://meudominio.com.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError(400, "O domínio precisa usar http ou https.");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new ApiError(400, "Informe apenas a origem, sem caminho. Exemplo: https://meudominio.com.");
  }
  return url.origin;
}

export function settingsDTO(userId: string, req: Request): SettingsDTO {
  const settings = getSettings(userId);
  const account = one<{ name: string; email: string; created_at: number; is_admin: number }>(
    "SELECT name, email, created_at, is_admin FROM users WHERE id = ?",
    userId,
  );
  if (!account) throw new ApiError(401, "Sessão expirada. Entre novamente.");
  run("DELETE FROM security_logs WHERE created_at < ?", Date.now() - 180 * 24 * 60 * 60 * 1000);
  const logs = many<LogRow>(
    "SELECT id, event, message, created_at FROM security_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 12",
    userId,
  );
  return {
    theme: settings.theme,
    domain: settings.domain,
    analyticsEnabled: settings.analytics_enabled === 1,
    retentionDays: settings.retention_days,
    defaultRedirect: settings.default_redirect === 301 ? 301 : 302,
    linkLimit: settings.link_limit,
    registrationOpen: isRegistrationOpen(),
    isAdmin: account.is_admin === 1,
    baseUrl: publicBase(req, settings.domain),
    account: {
      name: account.name,
      email: account.email,
      createdAt: new Date(account.created_at).toISOString(),
    },
    logs: logs.map((log) => ({
      id: log.id,
      event: log.event,
      message: log.message,
      createdAt: new Date(log.created_at).toISOString(),
    })),
  };
}

export async function updateSettings(userId: string, sessionId: string, body: Record<string, unknown>, req: Request) {
  const current = getSettings(userId);
  const patch: {
    theme?: Theme;
    domain?: string | null;
    analyticsEnabled?: boolean;
    retentionDays?: number;
    defaultRedirect?: 301 | 302;
    linkLimit?: number;
    registrationOpen?: boolean;
    name?: string;
  } = {};

  if ("theme" in body) {
    if (typeof body.theme !== "string" || !THEMES.has(body.theme as Theme)) {
      throw new ApiError(400, "Tema inválido.");
    }
    patch.theme = body.theme as Theme;
  }
  if ("domain" in body) patch.domain = validateDomain(body.domain);
  if ("analyticsEnabled" in body) {
    if (typeof body.analyticsEnabled !== "boolean") throw new ApiError(400, "Preferência de analytics inválida.");
    patch.analyticsEnabled = body.analyticsEnabled;
  }
  if ("retentionDays" in body) {
    const retention = validateRetention(body.retentionDays);
    if (!retention) throw new ApiError(400, "Retenção inválida. Escolha 30, 90, 180, 365 ou 730 dias.");
    patch.retentionDays = retention;
  }
  if ("defaultRedirect" in body) {
    const redirect = validateRedirect(body.defaultRedirect);
    if (!redirect) throw new ApiError(400, "Redirecionamento padrão inválido.");
    patch.defaultRedirect = redirect;
  }
  if ("linkLimit" in body) {
    const limit = validateLinkLimit(body.linkLimit);
    if (!limit) throw new ApiError(400, "O limite de links precisa ser um número entre 10 e 2000.");
    patch.linkLimit = limit;
  }
  if ("registrationOpen" in body) {
    if (!userIsAdmin(userId)) throw new ApiError(403, "Só o administrador pode alterar o cadastro.");
    if (typeof body.registrationOpen !== "boolean") throw new ApiError(400, "Configuração de cadastro inválida.");
    patch.registrationOpen = body.registrationOpen;
  }
  if ("name" in body) {
    const name = validateName(String(body.name ?? ""));
    if (!name.ok) throw new ApiError(400, name.error);
    patch.name = name.name;
  }

  const wantsPassword = typeof body.newPassword === "string" && body.newPassword.length > 0;
  if (wantsPassword) {
    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      throw new ApiError(400, "Informe a senha atual para definir uma nova.");
    }
    await changePassword(userId, sessionId, body.currentPassword, body.newPassword as string);
  }

  const now = Date.now();
  run(
    `UPDATE settings
     SET theme = ?, domain = ?, analytics_enabled = ?, retention_days = ?, default_redirect = ?, link_limit = ?, updated_at = ?
     WHERE user_id = ?`,
    patch.theme ?? current.theme,
    "domain" in patch ? patch.domain ?? null : current.domain,
    (patch.analyticsEnabled ?? current.analytics_enabled === 1) ? 1 : 0,
    patch.retentionDays ?? current.retention_days,
    patch.defaultRedirect ?? current.default_redirect,
    patch.linkLimit ?? current.link_limit,
    now,
    userId,
  );

  if (patch.name) run("UPDATE users SET name = ?, updated_at = ? WHERE id = ?", patch.name, now, userId);
  if ("registrationOpen" in patch) {
    setRegistrationOpen(Boolean(patch.registrationOpen));
    logSecurity(userId, "registration_toggled", patch.registrationOpen ? "Cadastro de contas aberto." : "Cadastro de contas fechado.");
  }
  if (patch.retentionDays) {
    run(
      "DELETE FROM click_events WHERE user_id = ? AND clicked_at < ?",
      userId,
      now - patch.retentionDays * 24 * 60 * 60 * 1000,
    );
  }
  const keys = Object.keys(patch);
  const onlyTheme = keys.length > 0 && keys.every((key) => key === "theme");
  if (!wantsPassword && keys.length > 0 && !onlyTheme) {
    logSecurity(userId, "settings_updated", "Configurações atualizadas.");
  }
  return settingsDTO(userId, req);
}

export function deleteOwnAccount(userId: string, confirmation: unknown) {
  if (typeof confirmation !== "string") {
    throw new ApiError(400, "Digite o e-mail da conta para confirmar a exclusão.");
  }
  const user = one<{ email: string }>("SELECT email FROM users WHERE id = ?", userId);
  if (!user || user.email !== confirmation.trim().toLowerCase()) {
    throw new ApiError(400, "Digite o e-mail da conta para confirmar a exclusão.");
  }
  logSecurity(userId, "account_deleted", "Conta excluída.");
  run("DELETE FROM users WHERE id = ?", userId);
  const remaining = one<{ n: number }>("SELECT COUNT(*) AS n FROM users");
  if (!remaining?.n) setRegistrationOpen(true);
  ensureAdmin();
  return { ok: true };
}
