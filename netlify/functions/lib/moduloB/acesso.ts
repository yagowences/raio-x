// netlify/functions/lib/moduloB/acesso.ts
//
// Um GET na raiz por UA crítico — o achado principal do produto. Orçamento de
// 5 fetches (tech-spec §6.1), exatamente os crawlers com fetch_direto:true.

import { fetchComLimites } from "../http";
import crawlersConfig from "../../../../config/crawlers.json";

interface CrawlerConfig {
  nome: string;
  string: string;
  fetch_direto: boolean;
}

const crawlers = (crawlersConfig as { criticos: CrawlerConfig[] }).criticos.filter((c) => c.fetch_direto);

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
        const resp = await fetchComLimites(baseUrl, { userAgent: c.string, validarSsrf });
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

/** bloqueio_silencioso: robots.txt libera, mas o servidor devolve 403/429 na prática. */
export function temBloqueioSilencioso(
  robots: { ua: string; permitido: boolean }[],
  acesso: RegraAcesso[]
): boolean {
  return acesso.some((a) => {
    if (!a.bloqueado) return false;
    const regra = robots.find((r) => r.ua === a.ua);
    return regra?.permitido === true;
  });
}
