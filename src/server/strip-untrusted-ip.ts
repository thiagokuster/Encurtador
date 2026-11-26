import http from "node:http";
import https from "node:https";
import {
  CLIENT_IP_HEADER,
  forwardedIpHeaderNames,
  hop,
  lastForwardedHop,
  trustProxyEnabled,
} from "@/server/client-ip";

const MARK = Symbol.for("encurtador.stripForwarded");

type HeaderBag = http.IncomingMessage["headers"];

export function stampRequest(req: { headers?: HeaderBag; socket?: { remoteAddress?: string | null } }) {
  if (!req.headers) return;
  const socketIp = hop(req.socket?.remoteAddress || "");
  const forwarded = lastForwardedHop(req.headers["x-forwarded-for"]);
  const realIp = hop(headerValue(req.headers["x-real-ip"]));
  req.headers[CLIENT_IP_HEADER] = trustProxyEnabled() ? forwarded || realIp || socketIp || "unknown" : socketIp || "unknown";
  for (const name of forwardedIpHeaderNames()) delete req.headers[name];
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function patch(Server: typeof http.Server) {
  const proto = Server.prototype;
  const current = proto.emit as typeof proto.emit & { [MARK]?: boolean };
  if (current[MARK]) return;
  const emit = function (this: http.Server, event: string | symbol, ...args: unknown[]) {
    if (event === "request" || event === "upgrade") {
      const incoming = args[0] as http.IncomingMessage | undefined;
      if (incoming) stampRequest(incoming);
    }
    return current.apply(this, [event, ...args] as Parameters<typeof current>);
  };
  emit[MARK] = true;
  proto.emit = emit as typeof proto.emit;
}

patch(http.Server);
patch(https.Server);
