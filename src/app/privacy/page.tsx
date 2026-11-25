import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/mark";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <div className="public-page">
      <header className="public-nav">
        <Link className="brand" href="/"><Mark /><strong>Encurtador</strong></Link>
        <Link className="btn btn-ghost" href="/login">Entrar</Link>
      </header>
      <article className="card panel" style={{ display: "grid", gap: "0.9rem" }}>
        <h1>Política de privacidade</h1>
        <p>Esta instalação do Encurtador é operada por quem a hospeda. O texto descreve o que o software faz, para que a coleta possa ser avaliada à luz da LGPD e de regras equivalentes.</p>
        <h2>Conta</h2>
        <p>Guardamos nome, e-mail e a senha apenas como hash. A sessão fica em um cookie httpOnly. Tokens de redefinição são guardados como hash e expiram em 30 minutos. No login com Google, a aplicação recebe o nome e o e-mail verificado. O token de acesso do Google não é armazenado.</p>
        <h2>Acessos aos links</h2>
        <p>Quando a coleta está ligada, um clique pode registrar data e hora, tipo de dispositivo, navegador, sistema operacional, categoria e domínio de origem. País, região e cidade só são gravados se o proxy enviar esses dados. Não estimamos localização.</p>
        <h2>O que não fazemos</h2>
        <p>Não armazenamos o IP completo, coordenadas, identificador persistente entre dias nem a URL completa do referenciador. O identificador usado para estimar unicidade muda todo dia, é salgado com um segredo do servidor e não permite reconstruir o IP. Não há fingerprint de canvas, áudio ou fontes.</p>
        <h2>Retenção e direitos</h2>
        <p>Os eventos seguem o prazo escolhido nas configurações, entre 30 e 730 dias. Dá para exportar um CSV, apagar os analytics de um link ou de toda a conta e excluir a conta com os links. O total acumulado só zera quando os analytics são excluídos de propósito. A limpeza por retenção remove eventos antigos e preserva esse total.</p>
        <h2>Segurança</h2>
        <p>As consultas ao banco usam parâmetros, as URLs aceitas são apenas http e https, e endereços internos são recusados. Há limite de tentativas em login, cadastro, criação de links e senha de link.</p>
        <p className="hint">A autenticação em duas etapas não está disponível nesta versão.</p>
      </article>
    </div>
  );
}
