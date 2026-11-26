"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";
import { Banner, ConfirmDialog, PageSkeleton, Panel } from "@/components/widgets";
import { useRemote } from "@/components/use-remote";
import { apiSend, downloadUrl, rangeQuery } from "@/lib/client";
import { applyTheme } from "@/components/providers";
import { RETENTION_OPTIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { SettingsDTO, Theme } from "@/lib/types";

export function SettingsPanel() {
  const toast = useToast();
  const router = useRouter();
  const remote = useRemote<SettingsDTO>("/api/settings");
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(365);
  const [defaultRedirect, setDefaultRedirect] = useState<301 | 302>(302);
  const [linkLimit, setLinkLimit] = useState(500);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!remote.data || ready) return;
    setTheme(remote.data.theme);
    setName(remote.data.account.name);
    setDomain(remote.data.domain || "");
    setAnalyticsEnabled(remote.data.analyticsEnabled);
    setRetentionDays(remote.data.retentionDays);
    setDefaultRedirect(remote.data.defaultRedirect);
    setLinkLimit(remote.data.linkLimit);
    setRegistrationOpen(remote.data.registrationOpen);
    setReady(true);
  }, [remote.data, ready]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await apiSend<SettingsDTO>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          theme,
          name,
          domain,
          analyticsEnabled,
          retentionDays,
          defaultRedirect,
          linkLimit,
          ...(remote.data?.isAdmin ? { registrationOpen } : {}),
          currentPassword,
          newPassword,
        }),
      });
      applyTheme(saved.theme);
      setTheme(saved.theme);
      setName(saved.account.name);
      setDomain(saved.domain || "");
      setAnalyticsEnabled(saved.analyticsEnabled);
      setRetentionDays(saved.retentionDays);
      setDefaultRedirect(saved.defaultRedirect);
      setLinkLimit(saved.linkLimit);
      setRegistrationOpen(saved.registrationOpen);
      setCurrentPassword("");
      setNewPassword("");
      toast("Configurações salvas.");
      await remote.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível salvar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    if (!exportFrom || !exportTo || exportFrom > exportTo) {
      toast("Informe um período válido para exportar.", "error");
      return;
    }
    try {
      await downloadUrl(`/api/export?${rangeQuery("custom", exportFrom, exportTo)}`, "encurtador-periodo.csv");
      toast("Relatório exportado.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível exportar.", "error");
    }
  }

  async function purge() {
    setBusy(true);
    try {
      await apiSend("/api/analytics", { method: "DELETE" });
      toast("Analytics excluídos.");
      setPurgeOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível excluir os analytics.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount() {
    setBusy(true);
    try {
      await apiSend("/api/account", { method: "DELETE", body: JSON.stringify({ email: confirmation }) });
      router.push("/");
      window.location.href = "/";
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível excluir a conta.", "error");
      setBusy(false);
    }
  }

  if (remote.loading && !remote.data) return <PageSkeleton />;
  if (remote.error && !remote.data) return <Banner tone="error">{remote.error}</Banner>;
  if (!remote.data) return null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Configurações</h2>
          <p>Conta criada em {formatDateTime(remote.data.account.createdAt)}. Endereço atual dos links: <span className="mono">{remote.data.baseUrl}</span></p>
        </div>
      </div>
      <form className="stack" onSubmit={save}>
        <Panel title="Conta e tema">
          <div className="form-grid">
            <label className="lbl">Nome<input className="field" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="lbl">E-mail<input className="field" value={remote.data.account.email} disabled /></label>
            <label className="lbl">Tema
              <select className="select" value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
                <option value="system">Sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
            </label>
          </div>
        </Panel>
        <Panel title="Domínio e links">
          <div className="form-grid">
            <label className="lbl">Domínio público
              <input className="field" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="https://meudominio.com" />
            </label>
            <p className="hint">Usado para exibir e gerar QR Codes. Deixe vazio para usar o endereço desta instalação.</p>
            <div className="form-2">
              <label className="lbl">Redirecionamento padrão
                <select className="select" value={defaultRedirect} onChange={(event) => setDefaultRedirect(event.target.value === "301" ? 301 : 302)}>
                  <option value={302}>302 temporário</option>
                  <option value={301}>301 permanente</option>
                </select>
              </label>
              <label className="lbl">Limite de links
                <input className="field" type="number" min={10} max={2000} value={linkLimit} onChange={(event) => setLinkLimit(Number(event.target.value))} />
              </label>
            </div>
            {remote.data.isAdmin ? (
              <>
                <label className="checks"><input type="checkbox" checked={registrationOpen} onChange={(event) => setRegistrationOpen(event.target.checked)} /> Permitir cadastro de novas contas</label>
                <p className="hint">Só o administrador altera isso. A primeira conta da instalação é a administradora, e uma conta nova sempre pode ser criada quando não houver nenhuma.</p>
              </>
            ) : (
              <p className="hint">O cadastro de novas contas é controlado pelo administrador da instalação.</p>
            )}
          </div>
        </Panel>
        <Panel title="Analytics e retenção">
          <div className="form-grid">
            <label className="checks"><input type="checkbox" checked={analyticsEnabled} onChange={(event) => setAnalyticsEnabled(event.target.checked)} /> Registrar acessos</label>
            <label className="lbl">Retenção dos eventos
              <select className="select" value={retentionDays} onChange={(event) => setRetentionDays(Number(event.target.value))}>
                {RETENTION_OPTIONS.map((days) => <option key={days} value={days}>{days} dias</option>)}
              </select>
            </label>
            <p className="hint">Eventos mais antigos são apagados. O total acumulado do link permanece até você excluir os analytics. O IP completo não é guardado.</p>
            <div className="filters">
              <button className="btn btn-danger" type="button" onClick={() => setPurgeOpen(true)}>Excluir todos os analytics</button>
            </div>
          </div>
        </Panel>
        <Panel title="Senha">
          <div className="form-2">
            <label className="lbl">Senha atual<input className="field" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
            <label className="lbl">Nova senha<input className="field" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          </div>
        </Panel>
        <div><button className="btn btn-primary" disabled={busy} type="submit">{busy ? "Salvando..." : "Salvar configurações"}</button></div>
      </form>
      <Panel title="Exportar por período">
        <div className="filters">
          <input className="field" style={{ width: 170 }} type="date" aria-label="Início da exportação" value={exportFrom} onChange={(event) => setExportFrom(event.target.value)} />
          <input className="field" style={{ width: 170 }} type="date" aria-label="Fim da exportação" value={exportTo} onChange={(event) => setExportTo(event.target.value)} />
          <button className="btn btn-ghost" type="button" onClick={exportCsv}>Exportar CSV</button>
        </div>
        <p className="hint">O arquivo usa ponto e vírgula para abrir corretamente no Excel em português. O relatório de um link específico fica na página dele.</p>
      </Panel>
      <Panel title="Atividade de segurança">
        {remote.data.logs.length === 0 ? <p className="hint">Nenhum evento recente.</p> : (
          <ul className="legend">
            {remote.data.logs.map((log) => (
              <li key={log.id}>
                <span>{log.message}</span>
                <span className="hint">{formatDateTime(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Autenticação em duas etapas não faz parte desta versão. A sessão usa cookie httpOnly e pode ser encerrada em Sair.</p>
      </Panel>
      <Panel title="Excluir conta">
        <p className="hint">Apaga a conta, os links e os eventos. Digite o e-mail para confirmar.</p>
        <div className="filters">
          <input className="field" style={{ maxWidth: 320 }} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={remote.data.account.email} aria-label="E-mail de confirmação" />
          <button className="btn btn-danger" type="button" onClick={() => setDeleteOpen(true)}>Excluir conta</button>
        </div>
      </Panel>
      <p className="hint"><Link href="/privacy">Ler a política de privacidade</Link></p>
      {purgeOpen ? <ConfirmDialog title="Excluir analytics" body="Todos os eventos de clique serão apagados e os totais voltam a zero." confirmLabel="Apagar dados" danger busy={busy} onConfirm={purge} onClose={() => setPurgeOpen(false)} /> : null}
      {deleteOpen ? <ConfirmDialog title="Excluir conta" body="Essa ação remove a conta e todos os links." confirmLabel="Excluir conta" danger busy={busy} onConfirm={removeAccount} onClose={() => setDeleteOpen(false)} /> : null}
    </div>
  );
}
