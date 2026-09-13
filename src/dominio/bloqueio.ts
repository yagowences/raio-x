// src/dominio/bloqueio.ts
//
// Fonte única de "há bloqueio crítico, e de que tipo". Usada pelo teto do
// índice (background), pelo laudo e pelo BlocoBloqueio — antes cada um tinha a
// sua versão, e a tela chegou a exibir um "HTTP 403" que nunca aconteceu.
// Regras em docs/03-regras-de-negocio.md §2 (teto) e invariante 8 de docs/05.

import type { SiteResultado } from "../api/tipos";

export interface BloqueioCritico {
  ua: string;
  /** "http": robots.txt libera, servidor devolve 403/429. "robots": o próprio robots.txt nega. */
  via: "http" | "robots";
  /** status HTTP devolvido; null quando o bloqueio é só no robots.txt. */
  status: number | null;
}

/** Robô crítico liberado no robots.txt e barrado com 403/429 — o bloqueio silencioso. */
export function bloqueioCriticoHttp(sr: SiteResultado | null | undefined): BloqueioCritico | null {
  if (!sr?.tecnica) return null;
  for (const robo of sr.tecnica.robots) {
    if (robo.gravidade !== "critica" || !robo.permitido) continue;
    const acesso = sr.tecnica.acesso.find((a) => a.ua === robo.ua);
    if (acesso?.bloqueado) return { ua: robo.ua, via: "http", status: acesso.status };
  }
  return null;
}

/** Robô crítico negado pelo próprio robots.txt. */
export function bloqueioCriticoRobots(sr: SiteResultado | null | undefined): BloqueioCritico | null {
  const robo = sr?.tecnica?.robots.find((r) => r.gravidade === "critica" && !r.permitido);
  return robo ? { ua: robo.ua, via: "robots", status: null } : null;
}

/** O bloqueio silencioso vem primeiro: é o achado mais invisível para o dono do site. */
export function bloqueioCritico(sr: SiteResultado | null | undefined): BloqueioCritico | null {
  return bloqueioCriticoHttp(sr) ?? bloqueioCriticoRobots(sr);
}

/**
 * Robôs de IA sem acesso à raiz: negados no robots.txt OU barrados com 403/429.
 * Googlebot (gravidade baixa) é busca tradicional, fica de fora. Base da nota
 * técnica e da métrica "Robôs bloqueados" — gravidade alta entra aqui, mesmo sem
 * acionar o teto.
 */
export function robosSemAcesso(sr: SiteResultado | null | undefined): string[] {
  const tecnica = sr?.tecnica;
  if (!tecnica) return [];
  return tecnica.robots
    .filter((r) => r.gravidade !== "baixa")
    .filter((r) => !r.permitido || tecnica.acesso.some((a) => a.ua === r.ua && a.bloqueado))
    .map((r) => r.ua);
}

export function motivoTeto(b: BloqueioCritico): string {
  return b.via === "http" ? `${b.ua} bloqueado por HTTP ${b.status}` : `${b.ua} bloqueado no robots.txt`;
}
