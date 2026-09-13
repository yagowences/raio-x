// netlify/functions/lib/moduloB/acesso.ts
//
// Um GET na raiz por UA crítico — o achado principal do produto. Orçamento de
// até 5 fetches (tech-spec §6.1), exatamente os crawlers com fetch_direto:true.
// Envia o User-Agent completo do robô real: firewall e CDN casam pelo formato
// real, e o token puro passa por regras que barram o robô de verdade.

import { fetchComLimites } from "../http";
import crawlersConfig from "../../../../config/crawlers.json";

interface CrawlerConfig {
  nome: string;
  ua_completo?: string;
  fetch_direto: boolean;
}

const crawlers = (crawlersConfig as { criticos: CrawlerConfig[] }).criticos.filter(
  (c): c is CrawlerConfig & { ua_completo: string } => c.fetch_direto && typeof c.ua_completo === "string"
);

export interface RegraAcesso {
  ua: string;
  status: number;
  bloqueado: boolean;
}

export async function checarAcesso(
  baseUrl: string,
  validarSsrf: (url: string) => Promise<URL>
): Promise<RegraAcesso[]> {
  return Promise.all(
    crawlers.map(async (c): Promise<RegraAcesso> => {
      try {
        const resp = await fetchComLimites(baseUrl, { userAgent: c.ua_completo, validarSsrf });
        return { ua: c.nome, status: resp.status, bloqueado: resp.status === 403 || resp.status === 429 };
      } catch {
        // falha de rede não é "bloqueio" no sentido do achado (robots libera, 403/429
        // reais) — status -1 sinaliza inacessibilidade sem inventar um achado que
        // não foi medido.
        return { ua: c.nome, status: -1, bloqueado: false };
      }
    })
  );
}

/**
 * bloqueio_silencioso: um robô de gravidade CRÍTICA é liberado pelo robots.txt,
 * mas o servidor devolve 403/429 na prática. Robô de gravidade alta barrado
 * continua contando em "robôs bloqueados" e na nota técnica, mas não aciona o
 * teto — docs/03 §2 e invariante 8 de docs/05.
 */
export function temBloqueioSilencioso(
  robots: { ua: string; gravidade: "critica" | "alta" | "baixa"; permitido: boolean }[],
  acesso: RegraAcesso[]
): boolean {
  return acesso.some((a) => {
    if (!a.bloqueado) return false;
    const regra = robots.find((r) => r.ua === a.ua);
    return regra?.gravidade === "critica" && regra.permitido === true;
  });
}
