"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Copy, LineChart, MoreHorizontal, Pause, Pencil, Play, QrCode, Trash2 } from "lucide-react";
import { LinkForm } from "@/components/link-form";
import { useToast } from "@/components/providers";
import { ConfirmDialog, Modal, PageSkeleton, Banner } from "@/components/widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRemote } from "@/components/use-remote";
import { apiSend, copyText } from "@/lib/client";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { LinkDTO, LinksPage } from "@/lib/types";

const STATUS: Record<string, string> = { active: "Ativo", inactive: "Inativo", expired: "Expirado" };

export function LinksManager() {
  const params = useSearchParams();
  const toast = useToast();
  const [q, setQ] = useState(params.get("q") || "");
  const [debounced, setDebounced] = useState(q);
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("created");
  const [dir, setDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LinkDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQ(params.get("q") || "");
  }, [params]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    setPage(1);
  }, [debounced, status, tag, sort, dir]);

  const url = useMemo(() => {
    const query = new URLSearchParams({ q: debounced, status, tag, sort, dir, page: String(page) });
    return `/api/links?${query}`;
  }, [debounced, status, tag, sort, dir, page]);
  const remote = useRemote<LinksPage>(url);

  function toggleSort(next: string) {
    if (sort === next) setDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(next);
      setDir(next === "title" ? "asc" : "desc");
    }
  }

  async function copy(value: string) {
    const ok = await copyText(value);
    toast(ok ? "Link copiado." : "Não foi possível copiar.", ok ? "success" : "error");
  }

  async function toggleStatus(link: LinkDTO) {
    try {
      await apiSend(`/api/links/${link.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: link.status === "active" ? "inactive" : "active" }),
      });
      toast(link.status === "active" ? "Link desativado." : "Link ativado.");
      await remote.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível alterar o status.", "error");
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await apiSend(`/api/links/${pendingDelete.id}`, { method: "DELETE" });
      toast("Link excluído.");
      setPendingDelete(null);
      await remote.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível excluir.", "error");
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil((remote.data?.total || 0) / 10));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Meus links</h2>
          <p>{remote.data ? `${formatNumber(remote.data.total)} links` : "Carregando os links da conta."}</p>
        </div>
        <Button type="button" onClick={() => setCreating(true)}>Novo link</Button>
      </div>
      <div className="filters">
        <Input className="h-9 max-w-xs" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por nome, URL, slug ou tag" aria-label="Buscar links" />
        <Select value={status} onValueChange={(value) => setStatus(value || "all")}>
          <SelectTrigger className="w-40" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tag || "all"} onValueChange={(value) => setTag(!value || value === "all" ? "" : value)}>
          <SelectTrigger className="w-44" aria-label="Filtrar por tag">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tags</SelectItem>
            {(remote.data?.tags || []).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {remote.loading && !remote.data ? <PageSkeleton /> : null}
      {remote.error && !remote.data ? <Banner tone="error">{remote.error}</Banner> : null}
      {remote.data && remote.data.links.length === 0 ? (
        <div className="card panel"><p className="hint">{debounced || status !== "all" || tag ? "Nenhum link encontrado para essa busca." : "Você ainda não criou links."}</p></div>
      ) : null}
      {remote.data && remote.data.links.length > 0 ? (
        <div className="card panel">
          <div className="table-wrap data-table">
            <table className="data">
              <thead>
                <tr>
                  <th><button type="button" onClick={() => toggleSort("title")}>Nome</button></th>
                  <th>Destino</th>
                  <th>Curto</th>
                  <th><button type="button" onClick={() => toggleSort("clicks")}>Cliques</button></th>
                  <th><button type="button" onClick={() => toggleSort("created")}>Criação</button></th>
                  <th><button type="button" onClick={() => toggleSort("status")}>Status</button></th>
                  <th>Tags</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {remote.data.links.map((link) => <Row key={link.id} link={link} onCopy={copy} onToggle={toggleStatus} onDelete={setPendingDelete} />)}
              </tbody>
            </table>
          </div>
          <div className="data-cards">
            {remote.data.links.map((link) => (
              <article key={link.id} className="card link-card">
                <strong>{link.title || link.slug}</strong>
                <span className="mono">{link.shortUrl}</span>
                <span className="hint">{link.originalUrl}</span>
                <span>{formatNumber(link.clickCount)} cliques · {STATUS[link.state]}</span>
                <Actions link={link} onCopy={copy} onToggle={toggleStatus} onDelete={setPendingDelete} />
              </article>
            ))}
          </div>
          <div className="pager" style={{ marginTop: "1rem" }}>
            <Button variant="outline" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
            <span>Página {page} de {pages}</span>
            <Button variant="outline" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
          </div>
        </div>
      ) : null}
      {creating ? (
        <Modal title="Novo link" onClose={() => setCreating(false)}>
          <LinkForm onSuccess={() => { setCreating(false); void remote.reload(); }} />
        </Modal>
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Excluir link"
          body={`Excluir ${pendingDelete.title || pendingDelete.slug} e os analytics dele? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          busy={busy}
          onConfirm={remove}
          onClose={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

function Row({ link, onCopy, onToggle, onDelete }: { link: LinkDTO; onCopy: (value: string) => void; onToggle: (link: LinkDTO) => void; onDelete: (link: LinkDTO) => void }) {
  return (
    <tr>
      <td><Link href={`/links/${link.id}`}>{link.title || link.slug}</Link>{link.hasPassword ? <div className="hint">Com senha</div> : null}</td>
      <td className="hint">{link.originalUrl}</td>
      <td className="mono">{link.slug}</td>
      <td>{formatNumber(link.clickCount)}</td>
      <td>{formatDateTime(link.createdAt)}</td>
      <td><Badge variant={link.state === "active" ? "default" : link.state === "expired" ? "outline" : "destructive"}>{STATUS[link.state]}</Badge></td>
      <td><div className="chips">{link.tags.map((item) => <span key={item} className="chip">{item}</span>)}</div></td>
      <td><Actions link={link} onCopy={onCopy} onToggle={onToggle} onDelete={onDelete} /></td>
    </tr>
  );
}

function Actions({ link, onCopy, onToggle, onDelete }: { link: LinkDTO; onCopy: (value: string) => void; onToggle: (link: LinkDTO) => void; onDelete: (link: LinkDTO) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Ações do link" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onCopy(link.shortUrl)}><Copy /> Copiar link</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/links/${link.id}#editar`} />}><Pencil /> Editar</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/links/${link.id}`} />}><LineChart /> Ver analytics</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/qr?link=${link.id}`} />}><QrCode /> Gerar QR Code</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggle(link)}>{link.status === "active" ? <Pause /> : <Play />} {link.status === "active" ? "Desativar" : "Ativar"}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(link)}><Trash2 /> Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
