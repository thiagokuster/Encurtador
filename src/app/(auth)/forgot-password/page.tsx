import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return (
    <>
      <h2>Recuperar senha</h2>
      <p className="hint">Sem servidor de e-mail, o link de redefinição só é mostrado neste ambiente local.</p>
      <div style={{ marginTop: "1rem" }}><ForgotForm /></div>
      <p className="hint"><Link href="/login">Voltar ao login</Link></p>
    </>
  );
}
