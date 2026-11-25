import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth-forms";
import { GoogleSignIn, googleLoginEnabled } from "@/components/google-sign-in";
import { isRegistrationOpen } from "@/server/security";

export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const open = isRegistrationOpen();
  return (
    <>
      <h2>Criar conta</h2>
      {open ? (
        <>
          <p className="hint">A primeira conta abre a instalação. Depois, o cadastro pode ser fechado nas configurações.</p>
          {googleLoginEnabled() ? (
            <div style={{ marginTop: "1rem" }}>
              <GoogleSignIn />
              <p className="hint" style={{ margin: "0.85rem 0", textAlign: "center" }}>ou</p>
            </div>
          ) : null}
          <div style={{ marginTop: googleLoginEnabled() ? 0 : "1rem" }}><RegisterForm /></div>
        </>
      ) : (
        <p>O cadastro de novas contas está fechado nesta instalação.</p>
      )}
      <p className="hint">Já tem conta? <Link href="/login">Entrar</Link></p>
    </>
  );
}
