"use client";

import { useEffect, useState } from "react";
import { apiSend } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/providers";
import type { LinkDTO } from "@/lib/types";
import { parseTags, validateOptionalText, validateSlug } from "@/lib/validators";
import { validatePublicUrl as checkUrl } from "@/lib/url-policy";

type Props = {
  mode?: "create" | "edit";
  initial?: LinkDTO;
  onSuccess: (link: LinkDTO) => void;
};

function localInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LinkForm({ mode = "create", initial, onSuccess }: Props) {
  const toast = useToast();
  const [originalUrl, setOriginalUrl] = useState(initial?.originalUrl || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [tags, setTags] = useState(initial?.tags.join(", ") || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [expiresAt, setExpiresAt] = useState(localInput(initial?.expiresAt || null));
  const [redirectType, setRedirectType] = useState<301 | 302>(initial?.redirectType || 302);
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [company, setCompany] = useState("");
  const [slugHint, setSlugHint] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = slug.trim();
    if (!value) {
      setSlugHint(mode === "create" ? "Deixe em branco para gerar um código automático." : "");
      return;
    }
    const formatError = validateSlug(value);
    if (formatError) {
      setSlugHint(formatError);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug: value });
        if (initial?.id) params.set("except", initial.id);
        const result = await apiSend<{ available: boolean; error: string | null }>(`/api/links/slug?${params}`);
        setSlugHint(result.available ? "Endereço disponível." : result.error || "Endereço indisponível.");
      } catch (err) {
        setSlugHint(err instanceof Error ? err.message : "Não foi possível verificar o endereço.");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [slug, initial?.id, mode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const urlCheck = checkUrl(originalUrl);
    if (!urlCheck.ok) {
      setError(urlCheck.error);
      return;
    }
    const titleCheck = validateOptionalText(title, 80, "O título");
    if (!titleCheck.ok) return setError(titleCheck.error);
    const descriptionCheck = validateOptionalText(description, 280, "A descrição");
    if (!descriptionCheck.ok) return setError(descriptionCheck.error);
    if (slug.trim()) {
      const slugError = validateSlug(slug.trim());
      if (slugError) return setError(slugError);
    }
    const tagCheck = parseTags(tags);
    if (!tagCheck.ok) return setError(tagCheck.error);

    const payload: Record<string, unknown> = {
      originalUrl,
      title,
      description,
      tags: tagCheck.tags,
      slug: slug.trim(),
      redirectType,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      company,
    };
    if (mode === "edit") {
      if (removePassword) payload.password = null;
      else if (password) payload.password = password;
    } else if (password) {
      payload.password = password;
    }

    setBusy(true);
    try {
      const path = mode === "edit" && initial ? `/api/links/${initial.id}` : "/api/links";
      const result = await apiSend<{ link: LinkDTO }>(path, {
        method: mode === "edit" ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast(mode === "edit" ? "Link atualizado." : "Link criado.");
      onSuccess(result.link);
      if (mode === "create") {
        setOriginalUrl("");
        setTitle("");
        setSlug("");
        setTags("");
        setDescription("");
        setExpiresAt("");
        setPassword("");
      } else {
        setPassword("");
        setRemovePassword(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível salvar o link.";
      setError(message);
      toast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="honeypot" aria-hidden="true">
        <label>Empresa<input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="original-url">URL original</Label>
        <Input id="original-url" className="h-10" required type="text" inputMode="url" placeholder="https://exemplo.com/pagina" value={originalUrl} onChange={(event) => setOriginalUrl(event.target.value)} />
      </div>
      <div className="form-2">
        <div className="grid gap-1.5">
          <Label htmlFor="link-title">Título</Label>
          <Input id="link-title" className="h-10" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Campanha de natal" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="link-slug">Endereço curto</Label>
          <Input id="link-slug" className="h-10 font-mono" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="oferta-natal" aria-describedby="slug-hint" />
        </div>
      </div>
      <p id="slug-hint" className="hint">{slugHint}</p>
      <details>
        <summary>Mais opções</summary>
        <div className="form-grid" style={{ marginTop: "0.8rem" }}>
          <label className="lbl">Tags
            <input className="field" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="natal, campanha" />
          </label>
          <label className="lbl">Descrição
            <textarea className="textarea" maxLength={280} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div className="form-2">
            <label className="lbl">Expira em
              <input className="field" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
            <label className="lbl">Redirecionamento
              <select className="select" value={redirectType} onChange={(event) => setRedirectType(event.target.value === "301" ? 301 : 302)}>
                <option value={302}>302 temporário, padrão</option>
                <option value={301}>301 permanente</option>
              </select>
            </label>
          </div>
          <p className="hint">Um 301 pode ser memorizado pelo navegador e deixar de contabilizar novos cliques.</p>
          <label className="lbl">{mode === "edit" ? "Nova senha do link" : "Senha do link, opcional"}
            <input className="field" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {mode === "edit" && initial?.hasPassword ? (
            <div className="checks">
              <Checkbox id="remove-password" checked={removePassword} onCheckedChange={(checked) => setRemovePassword(checked === true)} />
              <Label htmlFor="remove-password">Remover a senha atual</Label>
            </div>
          ) : null}
        </div>
      </details>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <div>
        <Button type="submit" disabled={busy}>{busy ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Encurtar URL"}</Button>
      </div>
    </form>
  );
}
