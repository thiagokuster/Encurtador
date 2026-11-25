import Link from "next/link";
import { redirect } from "next/navigation";
import { Mark } from "@/components/mark";
import { ThemeToggle } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="public-page">
      <header className="public-nav">
        <Link className="brand" href="/"><Mark /><strong>Encurtador</strong></Link>
        <div className="filters">
          <ThemeToggle />
          <Button variant="outline" render={<Link href="/login" />}>Entrar</Button>
          <Button render={<Link href="/register" />}>Criar conta</Button>
        </div>
      </header>
      <section className="public-hero">
        <p className="hint">Links curtos com leitura honesta dos acessos</p>
        <h1>O caminho curto entre um clique e o que importa.</h1>
        <p className="hint" style={{ maxWidth: 640, fontSize: "1.1rem" }}>
          Encurte URLs, escolha o endereço, acompanhe dispositivo, navegador e origem. Os gráficos só mostram o que foi registrado. O IP completo não fica salvo.
        </p>
        <div className="filters" style={{ marginTop: "1.2rem" }}>
          <Button size="lg" render={<Link href="/register" />}>Começar</Button>
          <Button variant="outline" size="lg" render={<Link href="/privacy" />}>Política de privacidade</Button>
        </div>
      </section>
      <section className="feature-grid">
        <Card><CardHeader><CardTitle>Links sob controle</CardTitle><CardDescription>Slug próprio, tags, expiração, senha, ativação e redirecionamento 301 ou 302.</CardDescription></CardHeader></Card>
        <Card><CardHeader><CardTitle>Analytics sem invenção</CardTitle><CardDescription>País, estado e cidade só aparecem quando a infraestrutura realmente os informa.</CardDescription></CardHeader></Card>
        <Card><CardHeader><CardTitle>QR para o link curto</CardTitle><CardDescription>Baixe PNG ou SVG, ajuste as cores e aponte sempre para o endereço encurtado.</CardDescription></CardHeader></Card>
      </section>
    </div>
  );
}
