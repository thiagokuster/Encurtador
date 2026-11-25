import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createId, hmac, randomToken, safeEqual, sha256 } from "@/server/crypto";
import { one, run } from "@/server/db";
import { ApiError } from "@/server/errors";
import { isRegistrationOpen, logSecurity, readCookie } from "@/server/security";
import type { SessionUser } from "@/lib/types";
import { validateEmail, validateName, validatePassword } from "@/lib/validators";

const SESSION_COOKIE = "enc_session";
const UNLOCK_COOKIE = "enc_unlock";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const RESET_MS = 30 * 60 * 1000;
const UNLOCK_MS = 12 * 60 * 60 * 1000;

let dummyHash: string | null = null;

function placeholderHash() {
  if (!dummyHash) dummyHash = bcrypt.hashSync("encurtador-placeholder-password", 12);
  return dummyHash;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: number;
};

function cleanupAuth(now = Date.now()) {
  run("DELETE FROM sessions WHERE expires_at <= ?", now);
  run("DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL", now);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MS / 1000,
  };
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const row = one<UserRow & { session_id: string; expires_at: number }>(
    `SELECT u.id, u.email, u.name, u.password_hash, u.created_at, s.id AS session_id, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    sha256(token),
  );
  if (!row || row.expires_at <= Date.now()) {
    if (row) run("DELETE FROM sessions WHERE id = ?", row.session_id);
    return null;
  }
  const user: SessionUser = { id: row.id, email: row.email, name: row.name };
  return { user, sessionId: row.session_id };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Sessão expirada. Entre novamente.");
  return session;
}

function createSession(userId: string) {
  const token = randomToken();
  const now = Date.now();
  run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    createId(),
    userId,
    sha256(token),
    now + SESSION_MS,
    now,
  );
  return token;
}

export async function registerAccount(input: { name: string; email: string; password: string; privacyAccepted: boolean }) {
  if (!isRegistrationOpen()) throw new ApiError(403, "O cadastro de novas contas está fechado.");
  if (input.privacyAccepted !== true) throw new ApiError(400, "Confirme a leitura da política de privacidade.");
  const email = validateEmail(input.email);
  if (!email.ok) throw new ApiError(400, email.error);
  const name = validateName(input.name);
  if (!name.ok) throw new ApiError(400, name.error);
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new ApiError(400, passwordError);
  if (one("SELECT id FROM users WHERE email = ?", email.email)) {
    throw new ApiError(409, "Já existe uma conta com esse e-mail.");
  }

  const now = Date.now();
  const userId = createId();
  const passwordHash = bcrypt.hashSync(input.password, 12);
  run(
    "INSERT INTO users (id, email, name, password_hash, provider, created_at, updated_at) VALUES (?, ?, ?, ?, 'password', ?, ?)",
    userId,
    email.email,
    name.name,
    passwordHash,
    now,
    now,
  );
  run(
    `INSERT INTO settings (user_id, theme, domain, analytics_enabled, retention_days, default_redirect, link_limit, updated_at)
     VALUES (?, 'system', NULL, 1, 365, 302, 500, ?)`,
    userId,
    now,
  );
  logSecurity(userId, "register", "Conta criada.");
  return createSession(userId);
}

function googleDisplayName(raw: string, email: string) {
  const cleaned = raw.normalize("NFKC").replace(/[^\p{L}\p{M}\p{N} .'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (cleaned.length >= 2) return cleaned;
  const local = email.split("@")[0].replace(/[^\p{L}\p{N}._-]/gu, "").slice(0, 80);
  return local.length >= 2 ? local : "Conta Google";
}

export function loginWithGoogle(emailInput: string, nameInput: string) {
  const email = validateEmail(emailInput);
  if (!email.ok) throw new ApiError(400, email.error);
  const existing = one<{ id: string }>("SELECT id FROM users WHERE email = ?", email.email);
  const now = Date.now();
  if (!existing) {
    if (!isRegistrationOpen()) throw new ApiError(403, "O cadastro de novas contas está fechado.");
    const userId = createId();
    run(
      "INSERT INTO users (id, email, name, password_hash, provider, created_at, updated_at) VALUES (?, ?, ?, ?, 'google', ?, ?)",
      userId,
      email.email,
      googleDisplayName(nameInput, email.email),
      bcrypt.hashSync(randomToken(), 12),
      now,
      now,
    );
    run(
      `INSERT INTO settings (user_id, theme, domain, analytics_enabled, retention_days, default_redirect, link_limit, updated_at)
       VALUES (?, 'system', NULL, 1, 365, 302, 500, ?)`,
      userId,
      now,
    );
    logSecurity(userId, "register", "Conta criada com o Google.");
    return createSession(userId);
  }
  logSecurity(existing.id, "google_login", "Entrada com o Google.");
  return createSession(existing.id);
}

export async function loginAccount(emailInput: string, password: string) {
  cleanupAuth();
  const email = validateEmail(emailInput);
  const user = email.ok
    ? one<UserRow>("SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?", email.email)
    : undefined;
  const matches = bcrypt.compareSync(password, user?.password_hash || placeholderHash());
  if (!email.ok || !user || !matches) {
    if (user) logSecurity(user.id, "login_failed", "Tentativa de login recusada.");
    throw new ApiError(401, "E-mail ou senha incorretos.");
  }
  logSecurity(user.id, "login_success", "Login realizado.");
  return createSession(user.id);
}

export async function logoutAccount() {
  const session = await getSession();
  if (!session) return;
  run("DELETE FROM sessions WHERE id = ?", session.sessionId);
  logSecurity(session.user.id, "logout", "Sessão encerrada.");
}

export function exposeResetLink() {
  return process.env.NODE_ENV !== "production" && process.env.EXPOSE_RESET_LINK !== "false";
}

export function requestReset(emailInput: string, origin: string) {
  cleanupAuth();
  const email = validateEmail(emailInput);
  const user = email.ok ? one<{ id: string }>("SELECT id FROM users WHERE email = ?", email.email) : undefined;
  if (!user) return { resetUrl: null as string | null };
  run("DELETE FROM password_resets WHERE user_id = ?", user.id);
  const token = randomToken();
  const now = Date.now();
  run(
    "INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    createId(),
    user.id,
    sha256(token),
    now + RESET_MS,
    now,
  );
  logSecurity(user.id, "password_reset_requested", "Redefinição de senha solicitada.");
  const resetUrl = `${origin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  return { resetUrl: exposeResetLink() ? resetUrl : null };
}

export function completeReset(token: string, password: string) {
  const passwordError = validatePassword(password);
  if (passwordError) throw new ApiError(400, passwordError);
  if (!token || token.length < 20) throw new ApiError(400, "Link de redefinição inválido ou expirado.");
  const row = one<{ id: string; user_id: string; expires_at: number; used_at: number | null }>(
    "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?",
    sha256(token),
  );
  if (!row || row.used_at || row.expires_at <= Date.now()) {
    throw new ApiError(400, "Link de redefinição inválido ou expirado.");
  }
  const now = Date.now();
  run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", bcrypt.hashSync(password, 12), now, row.user_id);
  run("UPDATE password_resets SET used_at = ? WHERE id = ?", now, row.id);
  run("DELETE FROM sessions WHERE user_id = ?", row.user_id);
  logSecurity(row.user_id, "password_reset_completed", "Senha redefinida.");
  return createSession(row.user_id);
}

export function changePassword(userId: string, sessionId: string, currentPassword: string, nextPassword: string) {
  const user = one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    throw new ApiError(400, "A senha atual está incorreta.");
  }
  const passwordError = validatePassword(nextPassword);
  if (passwordError) throw new ApiError(400, passwordError);
  run("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", bcrypt.hashSync(nextPassword, 12), Date.now(), userId);
  run("DELETE FROM sessions WHERE user_id = ? AND id != ?", userId, sessionId);
  logSecurity(userId, "password_changed", "Senha da conta alterada.");
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export async function writeSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function signUnlock(slug: string) {
  const expires = Date.now() + UNLOCK_MS;
  const payload = `${slug}.${expires}`;
  return `${payload}.${hmac(payload)}`;
}

export function unlockCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: UNLOCK_MS / 1000,
  };
}

export function hasUnlock(req: Request, slug: string) {
  const value = readCookie(req, UNLOCK_COOKIE);
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [cookieSlug, expiresRaw, signature] = parts;
  const expires = Number(expiresRaw);
  if (cookieSlug !== slug || !Number.isFinite(expires) || expires <= Date.now()) return false;
  const payload = `${cookieSlug}.${expiresRaw}`;
  return safeEqual(signature, hmac(payload));
}

export { SESSION_COOKIE, UNLOCK_COOKIE };
