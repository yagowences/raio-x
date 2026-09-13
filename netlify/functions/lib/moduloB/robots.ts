// netlify/functions/lib/moduloB/robots.ts
//
// Parser de robots.txt segundo a RFC 9309, restrito à pergunta que o achado
// principal precisa: "esse robô pode ler a raiz (/) do site?".
//
// - Grupo: uma ou mais linhas User-agent seguidas de regras. Um User-agent que
//   aparece depois de uma regra abre grupo novo. Linha em branco e comentário
//   NÃO separam grupo — tratar como separador fazia regras de um grupo vazarem
//   para o anterior (caso real: robots.txt padrão da Nuvemshop, em que o
//   `Disallow: /` do WBSearchBot ia parar no grupo `*`).
// - Nome do robô casa sem diferenciar maiúsculas; grupos repetidos se somam.
// - Regra mais longa que casa com "/" vence; em empate, Allow vence. Suporta
//   `*` e `$` no padrão.

import { fetchComLimites } from "../http";
import crawlersConfig from "../../../../config/crawlers.json";

interface CrawlerConfig {
  nome: string;
  string: string;
  familia: "busca" | "recuperacao" | "treinamento";
  gravidade: "critica" | "alta" | "baixa";
  fetch_direto: boolean;
}

const crawlers = (crawlersConfig as { criticos: CrawlerConfig[] }).criticos;

export interface RegraRobots {
  ua: string;
  familia: "busca" | "recuperacao" | "treinamento";
  gravidade: "critica" | "alta" | "baixa";
  permitido: boolean;
}

interface Regra {
  tipo: "allow" | "disallow";
  padrao: string;
}

/** Chave do mapa = nome do robô em minúsculas. */
function parseRobots(texto: string): Map<string, Regra[]> {
  const grupos = new Map<string, Regra[]>();
  let atuais: string[] = [];
  let ultimaFoiUserAgent = false;

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.split("#")[0].trim();
    if (!linha) continue;
    const i = linha.indexOf(":");
    if (i === -1) continue;
    const chave = linha.slice(0, i).trim().toLowerCase();
    const valor = linha.slice(i + 1).trim();

    if (chave === "user-agent") {
      if (!ultimaFoiUserAgent) atuais = [];
      const ua = valor.toLowerCase();
      if (!grupos.has(ua)) grupos.set(ua, []);
      atuais.push(ua);
      ultimaFoiUserAgent = true;
      continue;
    }

    // Sitemap é global, não pertence a grupo nenhum.
    if (chave === "sitemap") continue;

    // Qualquer outra diretiva (inclusive Crawl-delay) encerra a lista de User-agent.
    ultimaFoiUserAgent = false;
    if ((chave === "allow" || chave === "disallow") && valor !== "") {
      for (const ua of atuais) grupos.get(ua)!.push({ tipo: chave, padrao: valor });
    }
  }

  return grupos;
}

function casaComRaiz(padrao: string): boolean {
  const ancorado = padrao.endsWith("$");
  const corpo = (ancorado ? padrao.slice(0, -1) : padrao)
    .split("*")
    .map((parte) => parte.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${corpo}${ancorado ? "$" : ""}`).test("/");
}

function permiteRaiz(regras: Regra[] | undefined): boolean {
  if (!regras) return true; // nenhum grupo para esse UA = permitido
  let vencedora: Regra | null = null;
  for (const regra of regras) {
    if (!casaComRaiz(regra.padrao)) continue;
    if (
      !vencedora ||
      regra.padrao.length > vencedora.padrao.length ||
      (regra.padrao.length === vencedora.padrao.length && regra.tipo === "allow")
    ) {
      vencedora = regra;
    }
  }
  return vencedora?.tipo !== "disallow";
}

export interface ResultadoRobots {
  robots: RegraRobots[];
  textoBruto: string | null;
}

export async function checarRobots(
  baseUrl: string,
  validarSsrf: (url: string) => Promise<URL>
): Promise<ResultadoRobots> {
  let textoBruto: string | null = null;
  try {
    const resp = await fetchComLimites(new URL("/robots.txt", baseUrl).toString(), { validarSsrf });
    if (resp.ok) textoBruto = resp.texto;
  } catch {
    // sem robots.txt acessível = comportamento padrão, permitido para todos
  }

  const grupos = textoBruto ? parseRobots(textoBruto) : new Map<string, Regra[]>();

  const robots: RegraRobots[] = crawlers.map((c) => {
    const regras = grupos.get(c.string.toLowerCase()) ?? grupos.get("*");
    return { ua: c.nome, familia: c.familia, gravidade: c.gravidade, permitido: permiteRaiz(regras) };
  });

  return { robots, textoBruto };
}
