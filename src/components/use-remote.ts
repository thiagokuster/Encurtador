"use client";

import { useCallback, useEffect, useState } from "react";
import { apiSend } from "@/lib/client";

export function useRemote<T>(url: string | null, refreshMs = 0) {
  const [slot, setSlot] = useState<{ url: string | null; data: T | null }>({ url, data: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));

  if (slot.url !== url) {
    setSlot({ url, data: null });
    setError(null);
    setLoading(Boolean(url));
  }

  const load = useCallback(
    async (silent: boolean) => {
      if (!url) return;
      if (!silent) setLoading(true);
      try {
        const next = await apiSend<T>(url);
        setSlot({ url, data: next });
        if (!silent) setError(null);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : "Não foi possível carregar.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!refreshMs || !url) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [load, refreshMs, url]);

  return {
    data: slot.url === url ? slot.data : null,
    error,
    loading: Boolean(url) && (loading || slot.url !== url),
    reload: () => load(false),
  };
}
