"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, LayoutDashboard, Link2, LogOut, Menu, Moon, QrCode, Search, Settings, Sun } from "lucide-react";
import { apiSend } from "@/lib/client";
import { applyTheme, useToast } from "@/components/providers";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ITEMS = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/links", "Meus links", Link2],
  ["/analytics", "Analytics", BarChart3],
  ["/qr", "QR Codes", QrCode],
  ["/settings", "Configurações", Settings],
] as const;

function active(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const title = pathname.startsWith("/links/") ? "Detalhe do link" : ITEMS.find(([href]) => active(href, pathname))?.[1] || "Encurtador";

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  async function toggleTheme() {
    const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
    setDark(next === "dark");
    try {
      await apiSend("/api/settings", { method: "PATCH", body: JSON.stringify({ theme: next }) });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível salvar o tema.", "error");
    }
  }

  async function logout() {
    try {
      await apiSend("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível sair.", "error");
    }
  }

  return (
    <div className="shell">
      <a className="skip" href="#conteudo">Ir para o conteúdo</a>
      {open ? <button className="backdrop" type="button" aria-label="Fechar menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link className="brand" href="/dashboard" onClick={() => setOpen(false)}>
          <Mark />
          <span><strong>Encurtador</strong><span>Links e analytics</span></span>
        </Link>
        <nav className="nav" aria-label="Principal">
          {ITEMS.map(([href, label, Icon]) => (
            <Link key={href} href={href} aria-current={active(href, pathname) ? "page" : undefined} onClick={() => setOpen(false)}>
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <Button variant="outline" type="button" onClick={logout}><LogOut /> Sair</Button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Button className="menu-btn" variant="outline" size="icon" type="button" aria-label="Abrir menu" onClick={() => setOpen(true)}><Menu /></Button>
          <h1>{title}</h1>
          <form className="search" action="/links" method="get">
            <Search className="size-4" aria-hidden />
            <Input name="q" aria-label="Buscar links" placeholder="Buscar links" />
          </form>
          <Button variant="outline" size="icon" type="button" aria-label="Alternar tema" onClick={toggleTheme}>{dark ? <Sun /> : <Moon />}</Button>
        </header>
        <main id="conteudo" className="content">{children}</main>
      </div>
    </div>
  );
}
