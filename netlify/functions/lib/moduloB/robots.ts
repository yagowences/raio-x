// netlify/functions/lib/moduloB/robots.ts
//
// Parser mínimo de robots.txt: agrupa por User-agent, olha Disallow/Allow para
// a raiz ("/"). Não implementa wildcard nem "$" — suficiente para responder
// "esse robô pode ler a home do site", que é o que o achado principal precisa.

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

interface GrupoRegras {
  disallow: string[];
  allow: string[];
}

function parseRobots(texto: string): Map<string, GrupoRegras> {
  const grupos = new Map<string, GrupoRegras>();
  let atuais: string[] = [];
  let colecionandoUseragents = true;

  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.split("#")[0].trim();
    if (!linha) {
      colecionandoUseragents = true;
      continue;
    }
    const i = linha.indexOf(":");
    if (i === -1) continue;
    const chave = linha.slice(0, i).trim().toLowerCase();
    const valor = linha.slice(i + 1).trim();

    if (chave === "user-agent") {
      if (!colecionandoUseragents) atuais = []; // fecha o record anterior, abre um novo
      if (!grupos.has(valor)) grupos.set(valor, { disallow: [], allow: [] });
      atuais.push(valor);
      colecionandoUseragents = true;
      continue;
    }

    if (chave === "disallow" || chave === "allow") {
      colecionandoUseragents = false;
      for (const ua of atuais.length > 0 ? atuais : ["*"]) {
        const g = grupos.get(ua) ?? { disallow: [], allow: [] };
        g[chave].push(valor);
        grupos.set(ua, g);
      }
    }
  }

  return grupos;
}

function permiteRaiz(grupo: GrupoRegras | undefined): boolean {
  if (!grupo) return true; // nenhuma regra para esse UA = permitido
  const bloqueiaRaiz = grupo.disallow.includes("/");
  if (!bloqueiaRaiz) return true;
  return grupo.allow.includes("/"); // Allow explícito de mesma especificidade vence
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

  const grupos = textoBruto ? parseRobots(textoBruto) : new Map<string, GrupoRegras>();

  const robots: RegraRobots[] = crawlers.map((c) => {
    const grupo = grupos.get(c.string) ?? grupos.get("*");
    return { ua: c.nome, familia: c.familia, gravidade: c.gravidade, permitido: permiteRaiz(grupo) };
  });

  return { robots, textoBruto };
}
