// netlify/functions/lib/moduloB/orquestrador.ts
//
// Roda todas as checagens determinísticas do Módulo B e devolve o SiteResultado
// pronto — exceto `conteudo`, que exige a chamada de LLM feita à parte em
// julgamento.ts (é a única saída não-determinística da consulta).

import { validarUrlPublica, SsrfError } from "../ssrf";
import { fetchComLimites } from "../http";
import { checarRobots } from "./robots";
import { checarAcesso, temBloqueioSilencioso } from "./acesso";
import { checarSitemap } from "./sitemap";
import { analisarHtml } from "./html";
import { extrairJsonLd, analisarDadosEstruturados } from "./jsonld";
import { analisarNap } from "./nap";
import { extrairTextoParaJulgamento, acharPaginaInterna, juntarComPaginaInterna } from "./texto";

const LIMITE_PAGINA_INTERNA = 3000;

/** Texto da página interna do responsável, ou "" se não houver ou falhar — nunca derruba a auditoria. */
async function textoDaPaginaInterna(url: string | null, validarSsrf: (u: string) => Promise<URL>): Promise<string> {
  if (!url) return "";
  try {
    const resp = await fetchComLimites(url, { validarSsrf });
    return resp.ok ? extrairTextoParaJulgamento(resp.texto, LIMITE_PAGINA_INTERNA) : "";
  } catch {
    return "";
  }
}
import type { SiteResultado } from "../../../../src/api/tipos";

export interface ResultadoModuloB {
  siteResultado: SiteResultado;
  /** Texto limpo da home, pronto para a chamada de julgamento. Vazio se avaliado=false. */
  textoParaJulgamento: string;
}

export async function rodarModuloB(siteInformado: string): Promise<ResultadoModuloB> {
  let urlValida: URL;
  try {
    urlValida = await validarUrlPublica(siteInformado);
  } catch (err) {
    // Nunca revela QUAL regra de SSRF barrou — motivo genérico só.
    void err;
    return { siteResultado: { avaliado: false, motivo: "inacessivel" }, textoParaJulgamento: "" };
  }

  const validarSsrf = (u: string) => validarUrlPublica(u);
  const base = urlValida.origin;

  let home;
  try {
    home = await fetchComLimites(base + "/", { validarSsrf });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "AbortError";
    return {
      siteResultado: { avaliado: false, motivo: timeout ? "timeout" : "inacessivel" },
      textoParaJulgamento: "",
    };
  }

  if (!home.ok) {
    return { siteResultado: { avaliado: false, motivo: "inacessivel" }, textoParaJulgamento: "" };
  }

  const urlInterna = acharPaginaInterna(home.texto, home.url);
  const [robotsResultado, acesso, sitemap, textoInterna] = await Promise.all([
    checarRobots(base, validarSsrf),
    checarAcesso(base, validarSsrf),
    checarSitemap(base, validarSsrf),
    textoDaPaginaInterna(urlInterna, validarSsrf),
  ]);

  const { estatico, estrutura } = analisarHtml(home.texto);
  const blocosJsonLd = extrairJsonLd(home.texto);
  const dadosEstruturados = analisarDadosEstruturados(blocosJsonLd);
  const nap = analisarNap(home.texto, blocosJsonLd);
  const bloqueioSilencioso = temBloqueioSilencioso(robotsResultado.robots, acesso);

  return {
    siteResultado: {
      avaliado: true,
      url_final: home.url,
      tecnica: {
        robots: robotsResultado.robots,
        acesso,
        bloqueio_silencioso: bloqueioSilencioso,
        sitemap,
        html_estatico: estatico,
        psi_mobile: null, // PageSpeed fora do v1 — ver docs/README.md
      },
      estrutura,
      dados_estruturados: dadosEstruturados,
      nap,
      conteudo: null, // preenchido depois por julgamento.ts, se a chamada não falhar
    },
    textoParaJulgamento: juntarComPaginaInterna(
      extrairTextoParaJulgamento(home.texto),
      urlInterna ? new URL(urlInterna).pathname : "",
      textoInterna
    ),
  };
}

export { SsrfError };
