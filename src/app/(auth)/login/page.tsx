import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth-forms";
import { GoogleSignIn, googleLoginEnabled } from "@/components/google-sign-in";
import { safeNextPath } from "@/lib/validators";

export const metadata: Metadata = { title: "Entrar" };

const googleErrors: Record<string, string> = {
  PasswordAccount: "Este e-mail já tem uma conta com senha. Entre com a senha. O Google não é vinculado a essa conta.",
  AccessDenied: "Não foi possível entrar com o Google. Confirme se o e-mail está verificado e se o cadastro de contas novas está aberto.",
  Configuration: "O login com Google não está configurado neste servidor.",
  OAuthSignin: "O Google não iniciou o login. Tente de novo.",
  OAuthCallback: "O Google não concluiu o login. Tente de novo.",
};

function nextPath(next?: string, callbackUrl?: string) {
  const raw = next || callbackUrl;
  if (!raw) return "/dashboard";
  if (raw.startsWith("/") && !raw.startsWith("//")) return safeNextPath(raw);
  try {
    return safeNextPath(new URL(raw).pathname);
  } catch {
    return "/dashboard";
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = nextPath(params.next, params.callbackUrl);
  const google = googleLoginEnabled();
  const message = params.error ? googleErrors[params.error] ?? "Não foi possível entrar. Tente de novo." : "";
  return (
    <>
      <h2>Entrar</h2>
      <p className="hint">{google ? "Use o e-mail e a senha ou entre com o Google." : "Use o e-mail e a senha da sua conta."}</p>
      {message ? <p className="error-text" role="alert" style={{ marginTop: "0.75rem" }}>{message}</p> : null}
      {google ? (
        <div style={{ marginTop: "1rem" }}>
          <GoogleSignIn next={next} />
          <p className="hint" style={{ margin: "0.85rem 0", textAlign: "center" }}>ou</p>
        </div>
      ) : null}
      <div style={{ marginTop: google ? 0 : "1rem" }}><LoginForm next={next} /></div>
      <p className="hint">Não tem conta? <Link href="/register">Criar conta</Link></p>
    </>
  );
}
