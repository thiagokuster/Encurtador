"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="public-page">
      <section className="card panel">
        <h1>Não foi possível abrir esta página</h1>
        <p className="hint">Tente de novo. Se o problema continuar, recarregue a aplicação.</p>
        <button className="btn btn-primary" type="button" onClick={reset}>Tentar de novo</button>
      </section>
    </div>
  );
}
