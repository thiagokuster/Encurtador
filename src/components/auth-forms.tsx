"use client";

import Link from "next/link";
import { useState } from "react";
import { apiSend } from "@/lib/client";
import { safeNextPath, validateEmail, validateName, validatePassword } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Field({ label, id, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-10" {...props} />
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  if (!message) return null;
  return <p className="error-text" role="alert">{message}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return setError(emailCheck.error);
    if (!password) return setError("Informe a senha.");
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, company }) });
      window.location.href = safeNextPath(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="honeypot" aria-hidden="true"><label>Empresa<input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
      <Field id="login-email" label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Field id="login-password" label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <ErrorText message={error} />
      <Button type="submit" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</Button>
      <p className="hint"><Link href="/forgot-password">Esqueci a senha</Link></p>
    </form>
  );
}

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nameCheck = validateName(name);
    if (!nameCheck.ok) return setError(nameCheck.error);
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return setError(emailCheck.error);
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (!privacyAccepted) return setError("Confirme a leitura da política de privacidade.");
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, privacyAccepted, company }),
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="honeypot" aria-hidden="true"><label>Empresa<input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" /></label></div>
      <Field id="register-name" label="Nome" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
      <Field id="register-email" label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Field id="register-password" label="Senha" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <p className="hint">Mínimo de 10 caracteres, com letras e números.</p>
      <div className="checks">
        <Checkbox id="privacy" checked={privacyAccepted} onCheckedChange={(checked) => setPrivacyAccepted(checked === true)} />
        <Label htmlFor="privacy">Li a <Link href="/privacy">política de privacidade</Link></Label>
      </div>
      <ErrorText message={error} />
      <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar conta"}</Button>
    </form>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) return setError(emailCheck.error);
    setBusy(true);
    setError("");
    try {
      const result = await apiSend<{ message: string; resetUrl: string | null }>("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
      setResetUrl(result.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível preparar a redefinição.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field id="forgot-email" label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <ErrorText message={error} />
      <Button type="submit" disabled={busy}>{busy ? "Enviando..." : "Preparar redefinição"}</Button>
      {message ? <p className="hint">{message} Nesta instalação local, o link aparece aqui quando a conta existe. Em produção ele não é exibido na tela.</p> : null}
      {resetUrl ? <p><Link href={resetUrl.replace(/^https?:\/\/[^/]+/, "")}>Abrir redefinição de senha</Link></p> : null}
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field id="reset-password" label="Nova senha" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <ErrorText message={error} />
      <Button type="submit" disabled={busy || !token}>{busy ? "Salvando..." : "Salvar nova senha"}</Button>
      {!token ? <p className="error-text">O link de redefinição está incompleto.</p> : null}
    </form>
  );
}

export function UnlockForm({ slug, title }: { slug: string; title: string | null }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiSend<{ redirect: string }>("/api/unlock", {
        method: "POST",
        body: JSON.stringify({ slug, password }),
      });
      window.location.href = result.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o link.");
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <h1>{title || "Link protegido"}</h1>
      <p className="hint">Informe a senha para continuar. O destino não é mostrado antes da confirmação.</p>
      <Field id="unlock-password" label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      <ErrorText message={error} />
      <Button type="submit" disabled={busy}>{busy ? "Verificando..." : "Continuar"}</Button>
    </form>
  );
}
