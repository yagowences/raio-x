// tests/servidorLocal.ts
//
// Servidor HTTP em 127.0.0.1 que faz o papel do site auditado. Os testes do
// Módulo B passam pelo fetch de verdade (fetchComLimites), sem mock de rede.

import http from "node:http";
import type { AddressInfo } from "node:net";

export type Responder = (req: http.IncomingMessage) => { status: number; corpo?: string };

export async function subirServidor(responder: Responder): Promise<{ base: string; fechar: () => Promise<void> }> {
  const servidor = http.createServer((req, res) => {
    const { status, corpo = "" } = responder(req);
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(corpo);
  });
  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const { port } = servidor.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    fechar: () => new Promise<void>((resolve) => servidor.close(() => resolve())),
  };
}

/** Os testes rodam contra localhost, que o guard de SSRF real barraria. */
export const semSsrf = async (url: string) => new URL(url);
