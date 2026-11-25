import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth";
import { ApiError } from "@/server/errors";
import { assertSameOrigin, logError } from "@/server/security";

type RouteContext = { params: Promise<Record<string, string>> };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJson(req: Request) {
  const text = await req.text();
  if (text.length > 30000) throw new ApiError(413, "Requisição muito grande.");
  if (!text.trim()) return {};
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("invalid");
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "JSON inválido.");
  }
}

export function withApi(handler: (req: Request, ctx: RouteContext) => Promise<Response> | Response) {
  return async (req: Request, ctx: RouteContext) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        assertSameOrigin(req);
        const type = req.headers.get("content-type") || "";
        if (!type.includes("application/json")) throw new ApiError(415, "Envie os dados em JSON.");
      }
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      logError("api", error);
      return json({ error: "Erro interno. Tente novamente." }, 500);
    }
  };
}

export async function requireUser() {
  return requireSession();
}

export async function routeParam(ctx: RouteContext, name: string) {
  const params = await ctx.params;
  return params[name] || "";
}
