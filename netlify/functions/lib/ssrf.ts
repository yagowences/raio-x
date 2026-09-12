// netlify/functions/lib/ssrf.ts
//
// Tech-spec §10: bloquear IP privado, localhost, 169.254.*, esquemas não-http(s),
// portas não padrão. Resolver DNS antes e validar o IP resolvido.
//
// LIMITAÇÃO CONHECIDA: valida no momento da chamada, mas não fixa (pin) o IP
// resolvido para o fetch real que vem em seguida — um DNS rebinding entre a
// validação e o fetch não é impedido por este código. Fechar isso exigiria um
// agente HTTP com `lookup` customizado forçando a mesma resolução. Registrado
// como dívida; aceitável para o v1, não para produção com tráfego adversarial.

import { lookup } from "node:dns/promises";

export class SsrfError extends Error {}

const PORTAS_PERMITIDAS = new Set([80, 443]);

function ipv4ParaNumero(ip: string): number {
  return ip.split(".").reduce((acc, octeto) => (acc << 8) + Number(octeto), 0) >>> 0;
}

function dentroDoCidrV4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mascara = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ParaNumero(ip) & mascara) === (ipv4ParaNumero(base) & mascara);
}

const CIDRS_PRIVADOS_V4 = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "0.0.0.0/8",
  "100.64.0.0/10", // CGNAT
];

function eIpPrivadoV4(ip: string): boolean {
  return CIDRS_PRIVADOS_V4.some((cidr) => dentroDoCidrV4(ip, cidr));
}

function eIpPrivadoV6(ip: string): boolean {
  const b = ip.toLowerCase();
  return (
    b === "::1" ||
    b === "::" ||
    b.startsWith("fe80:") || // link-local
    b.startsWith("fc") ||
    b.startsWith("fd") || // unique local, fc00::/7
    b.startsWith("::ffff:127.") ||
    b.startsWith("::ffff:10.")
  );
}

/**
 * Valida a URL informada pelo visitante antes de qualquer fetch. Resolve o DNS
 * e valida o(s) IP(s) RESOLVIDO(S), não só o hostname escrito.
 *
 * Não revela em qual regra específica a URL falhou — o chamador trata qualquer
 * SsrfError como `motivo: "inacessivel"` genérico, para não dar a quem ataca um
 * oráculo de "isso aqui parece IP interno".
 */
export async function validarUrlPublica(urlStr: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new SsrfError("URL inválida");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("esquema não permitido");
  }

  if (url.port && !PORTAS_PERMITIDAS.has(Number(url.port))) {
    throw new SsrfError("porta não permitida");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new SsrfError("localhost não permitido");
  }

  let enderecos;
  try {
    enderecos = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfError("não foi possível resolver o domínio");
  }

  for (const { address, family } of enderecos) {
    if (family === 4 && eIpPrivadoV4(address)) {
      throw new SsrfError(`IP privado resolvido: ${address}`);
    }
    if (family === 6 && eIpPrivadoV6(address)) {
      throw new SsrfError(`IP privado resolvido: ${address}`);
    }
  }

  return url;
}
