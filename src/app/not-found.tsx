import Link from "next/link";

export default function NotFound() {
  return (
    <div className="public-page">
      <section className="card panel">
        <h1>Página não encontrada</h1>
        <p className="hint">O endereço não corresponde a uma página desta instalação.</p>
        <Link className="btn btn-primary" href="/">Voltar ao início</Link>
      </section>
    </div>
  );
}
