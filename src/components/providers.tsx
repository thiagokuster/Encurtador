"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { toast as notify } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Theme } from "@/lib/types";

type PushToast = (message: string, tone?: "success" | "error" | "info") => void;

export function useToast(): PushToast {
  return (message, tone = "success") => {
    if (tone === "error") notify.error(message);
    else if (tone === "info") notify.message(message);
    else notify.success(message);
  };
}

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("encurtador-theme", theme);
}

export function ThemeBoot({ theme }: { theme: Theme }) {
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem("encurtador-theme") === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
    <Button
      variant={compact ? "outline" : "outline"}
      size={compact ? "icon" : "default"}
      type="button"
      aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => {
        const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
        applyTheme(next);
        setDark(next === "dark");
      }}
    >
      {dark ? <Sun /> : <Moon />}
      {compact ? null : dark ? "Claro" : "Escuro"}
    </Button>
  );
}
