import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/mark";
import { getSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="auth-screen">
      <div className="auth-grid">
        <section>
          <Link className="brand" href="/"><Mark /><span><strong>Encurtador</strong><span>Voltar ao início</span></span></Link>
          <h1 style={{ fontSize: "clamp(2.2rem, 4vw, 3.6rem)", letterSpacing: "-0.05em", lineHeight: 1 }}>Seus links, com o rastro que dá para explicar.</h1>
          <p className="hint">Conta protegida por senha, sessão em cookie httpOnly e estatísticas limitadas ao que o acesso realmente revela.</p>
        </section>
        <section className="card auth-card">{children}</section>
      </div>
    </div>
  );
}
