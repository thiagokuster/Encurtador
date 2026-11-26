import http from "node:http";
import https from "node:https";

const MARK = Symbol.for("encurtador.stripForwarded");

function trustProxyEnabled() {
  return /^(1|true|yes)$/i.test(process.env.TRUST_PROXY?.trim() ?? "");
}

function strip(req: http.IncomingMessage | undefined) {
  if (!req?.headers || trustProxyEnabled()) return;
  delete req.headers["x-forwarded-for"];
  delete req.headers["x-real-ip"];
}

function patch(Server: typeof http.Server) {
  const proto = Server.prototype;
  const current = proto.emit as typeof proto.emit & { [MARK]?: boolean };
  if (current[MARK]) return;
  const emit = function (this: http.Server, event: string | symbol, ...args: unknown[]) {
    if (event === "request" || event === "upgrade") strip(args[0] as http.IncomingMessage | undefined);
    return current.apply(this, [event, ...args] as Parameters<typeof current>);
  };
  emit[MARK] = true;
  proto.emit = emit as typeof proto.emit;
}

patch(http.Server);
patch(https.Server);
