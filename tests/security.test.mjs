import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

const dataDir = mkdtempSync(path.join(tmpdir(), "encurtador-"));
process.env.ENCURTADOR_DATA = dataDir;
process.env.BCRYPT_COST = "4";
process.env.EXPOSE_RESET_LINK = "true";
process.env.AUTH_SECRET = "teste-de-seguranca-com-32-caracteres";
delete process.env.TRUST_PROXY;

const { csvCell } = await import("../src/lib/csv.ts");
const { validatePublicUrl } = await import("../src/lib/url-policy.ts");
const { contentSecurityPolicy } = await import("../src/csp.ts");
const { baselineSecurityHeaders } = await import("../src/security-headers.ts");
const { CLIENT_IP_HEADER, clientIpFromHeaders } = await import("../src/server/client-ip.ts");
const { stampRequest } = await import("../src/server/strip-untrusted-ip.ts");
const { readGeo } = await import("../src/server/geo.ts");
const { acquireInstanceLock } = await import("../src/server/instance-lock.ts");
const { createBackup, restoreBackup } = await import("../src/server/backup.ts");
const { ApiError } = await import("../src/server/errors.ts");
const { run } = await import("../src/server/db.ts");
const {
  assertRate,
  assertSameOrigin,
  isRegistrationOpen,
  rateLimit,
  setRegistrationOpen,
  userIsAdmin,
} = await import("../src/server/security.ts");
const {
  findSession,
  loginAccount,
  loginWithGoogle,
  registerAccount,
  requestReset,
  completeReset,
} = await import("../src/server/auth.ts");
const { createLink, deleteLink, getOwnedLink } = await import("../src/server/links.ts");
const { updateSettings } = await import("../src/server/settings.ts");

const password = "SenhaForte19";
const req = new Request("http://localhost:3000/api/links", { headers: { host: "localhost:3000" } });

test("CSP de produção usa nonce e HSTS fica fora do desenvolvimento", () => {
  const dev = contentSecurityPolicy("abc", true);
  const prod = contentSecurityPolicy("abc", false);
  assert.match(prod, /nonce-abc/);
  assert.match(prod, /upgrade-insecure-requests/);
  assert.doesNotMatch(prod, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(prod, /unsafe-eval/);
  assert.match(dev, /unsafe-eval/);
  assert.doesNotMatch(dev, /upgrade-insecure-requests/);
  assert.match(prod, /style-src 'self' 'unsafe-inline'/);
  const productionHeaders = baselineSecurityHeaders(false);
  const developmentHeaders = baselineSecurityHeaders(true);
  assert.equal(productionHeaders.some((header) => header.key === "Strict-Transport-Security"), true);
  assert.equal(developmentHeaders.some((header) => header.key === "Strict-Transport-Security"), false);
  assert.equal(productionHeaders.some((header) => header.key === "Content-Security-Policy"), false);
});

test("URLs internas, mapeadas e perigosas são recusadas", () => {
  for (const input of [
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:a00:1]/",
    "http://127.0.0.1/",
    "http://10.1.1.1/",
    "javascript:alert(1)",
    "http://user:pass@example.com/",
    "http://169.254.169.254/",
  ]) {
    assert.equal(validatePublicUrl(input).ok, false, input);
  }
  assert.equal(validatePublicUrl("https://example.com/caminho").ok, true);
});

test("CSV não deixa fórmula solta", () => {
  assert.equal(csvCell("=cmd|' /C calc'!A0"), "'=cmd|' /C calc'!A0");
  assert.equal(csvCell('+1+1'), "'+1+1");
  assert.equal(csvCell("normal"), "normal");
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
});

test("IP do cliente ignora X-Forwarded-For e só aceita o carimbo da conexão", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.9", "x-real-ip": "198.51.100.8" });
  assert.equal(clientIpFromHeaders(headers), "unknown");
  headers.set(CLIENT_IP_HEADER, "127.0.0.1");
  assert.equal(clientIpFromHeaders(headers), "127.0.0.1");

  const direct = { headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.1" }, socket: { remoteAddress: "::ffff:127.0.0.1" } };
  stampRequest(direct);
  assert.equal(direct.headers[CLIENT_IP_HEADER], "::ffff:127.0.0.1");
  assert.equal(direct.headers["x-forwarded-for"], undefined);

  process.env.TRUST_PROXY = "1";
  const proxied = { headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.1", "x-real-ip": "203.0.113.9" }, socket: { remoteAddress: "10.0.0.2" } };
  stampRequest(proxied);
  assert.equal(proxied.headers[CLIENT_IP_HEADER], "198.51.100.1");
  delete process.env.TRUST_PROXY;
});

test("país só entra quando o proxy é confiável", () => {
  const headers = new Headers({ "cf-ipcountry": "BR", "x-vercel-ip-city": "Recife" });
  assert.equal(readGeo(headers, false).country, null);
  assert.equal(readGeo(headers, true).country, "BR");
});

test("origem forjada não passa na checagem", () => {
  const forged = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { origin: "https://evil.test", host: "localhost:3000", "x-forwarded-host": "evil.test" },
  });
  assert.throws(() => assertSameOrigin(forged), (error) => error instanceof ApiError && error.status === 403);
  const same = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000", "x-forwarded-host": "evil.test" },
  });
  assert.doesNotThrow(() => assertSameOrigin(same));
});

test("limite de tentativas bloqueia a chave seguinte", () => {
  const key = `teste:${Date.now()}`;
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), true);
  assert.equal(rateLimit(key, 2, 60_000), false);
  assert.throws(() => assertRate(key, 2, 60_000), (error) => error instanceof ApiError && error.status === 429);
});

test("cadastro, sessão, autorização e recuperação de senha", async () => {
  assert.equal(isRegistrationOpen(), true);
  const adminToken = await registerAccount({ name: "Admin", email: "admin@example.com", password, privacyAccepted: true });
  const admin = findSession(adminToken);
  assert.ok(admin);
  assert.equal(userIsAdmin(admin.user.id), true);

  const otherToken = await registerAccount({ name: "Outra", email: "outra@example.com", password, privacyAccepted: true });
  const other = findSession(otherToken);
  assert.ok(other);
  assert.equal(userIsAdmin(other.user.id), false);

  const created = await createLink(admin.user.id, { originalUrl: "https://example.com/pagina", slug: "pagina-segura" }, req);
  assert.equal(getOwnedLink(other.user.id, created.link.id, req), null);
  assert.throws(() => deleteLink(other.user.id, created.link.id), (error) => error instanceof ApiError && error.status === 404);
  assert.ok(getOwnedLink(admin.user.id, created.link.id, req));

  await updateSettings(admin.user.id, admin.sessionId, { registrationOpen: false }, req);
  assert.equal(isRegistrationOpen(), false);
  await assert.rejects(
    () => registerAccount({ name: "Terceira", email: "terceira@example.com", password, privacyAccepted: true }),
    (error) => error instanceof ApiError && error.status === 403,
  );
  await assert.rejects(
    () => updateSettings(other.user.id, other.sessionId, { registrationOpen: true }, req),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(isRegistrationOpen(), false);
  await assert.rejects(
    () => loginWithGoogle("nova@example.com", "Nova"),
    (error) => error instanceof ApiError && error.status === 403,
  );
  await assert.rejects(
    () => loginWithGoogle("admin@example.com", "Admin"),
    (error) => error instanceof ApiError && error.status === 409,
  );

  assert.equal(requestReset("ninguem@example.com", "http://localhost:3000").resetUrl, null);
  const reset = requestReset("outra@example.com", "http://localhost:3000");
  const token = new URL(reset.resetUrl).searchParams.get("token");
  await completeReset(token, "SenhaNova19");
  await loginAccount("outra@example.com", "SenhaNova19");
  await assert.rejects(() => loginAccount("outra@example.com", password), (error) => error instanceof ApiError && error.status === 401);
  await assert.rejects(() => completeReset(token, "SenhaNova20"), (error) => error instanceof ApiError && error.status === 400);

  assert.equal(findSession(adminToken)?.user.email, "admin@example.com");
  run("UPDATE sessions SET expires_at = ? WHERE id = ?", Date.now() - 1000, admin.sessionId);
  assert.equal(findSession(adminToken), null);
  setRegistrationOpen(true);
});

test("backup restaura o valor anterior e uma segunda instância é recusada", async () => {
  run("UPDATE users SET name = ? WHERE email = ?", "Antes", "admin@example.com");
  const copy = await createBackup(path.join(dataDir, "backups"));
  run("UPDATE users SET name = ? WHERE email = ?", "Depois", "admin@example.com");
  const restored = path.join(dataDir, "restaurado.sqlite");
  await restoreBackup(copy, restored);
  const db = new DatabaseSync(restored, { readOnly: true });
  const row = db.prepare("SELECT name FROM users WHERE email = ?").get("admin@example.com");
  db.close();
  assert.equal(row.name, "Antes");

  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const lock = path.join(dataDir, "trava", "encurtador.lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, JSON.stringify({ pid: child.pid }));
  try {
    assert.throws(() => acquireInstanceLock(lock));
  } finally {
    child.kill();
  }
});
