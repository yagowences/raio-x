// netlify/functions/lib/moduloB/texto.ts
//
// Texto da página para a chamada de julgamento (julgamento.ts). Três cuidados,
// todos vindos de auditorias reais:
//
// 1. Tirar o que não é conteúdo — cabeçalho, menu, carrinho, aviso de cookies,
//    rodapé. Em loja virtual isso ocupava o começo inteiro do trecho enviado.
// 2. Manter a estrutura: título vira linha com "#", item de lista vira "- ".
//    Sem isso o modelo julgava escaneabilidade e perguntas nos títulos de um
//    texto com títulos e listas apagados.
// 3. Cobrir a página inteira: acima do limite, cada seção (de título a título)
//    entra com uma fatia igual, em vez de só os primeiros caracteres da página.

import * as cheerio from "cheerio";
import { CAMINHOS_AUTOR } from "./nap";

const LIMITE_PADRAO = 12000;

/**
 * Página interna para o julgamento (spec §6.4: home + uma interna). A escolhida é a
 * do responsável — sobre, quem somos, equipe —, porque é onde o site declara
 * autoria, e a home de loja virtual quase nunca diz quem é a marca.
 * Só mesmo domínio; âncora (#sobre) não conta, já está na home.
 */
export function acharPaginaInterna(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  for (const el of $("a[href]").toArray()) {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("#")) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname !== base.hostname) continue;
    url.hash = "";
    if (CAMINHOS_AUTOR.some((c) => url.pathname.toLowerCase().startsWith(c))) return url.toString();
  }
  return null;
}

export function juntarComPaginaInterna(textoHome: string, caminho: string, textoInterna: string): string {
  return textoInterna ? `${textoHome}\n\n=== Página interna: ${caminho} ===\n${textoInterna}` : textoHome;
}

// Sempre ruído, onde quer que esteja. Conteúdo recolhido ([hidden], aria-hidden)
// NÃO entra aqui: resposta de FAQ em acordeão está no HTML e o robô a lê.
const SEMPRE_REMOVER = "script, style, noscript, template, svg, iframe, nav, [role='navigation']";
// Moldura da página. Sai inteira, exceto o h1 que estiver dentro (logo em h1 no
// cabeçalho é comum em loja virtual). Se contiver o <main>, fica.
// <form> não entra: Nuvemshop põe cada card de produto num formulário.
const MOLDURA = "header, footer, aside, [role='banner'], [role='contentinfo']";
const CLASSE_RUIDO =
  /(^|[\s_-])(cart|carrinho|minicart|cookie|cookies|lgpd|consent|newsletter|modal|popup|drawer|offcanvas)([\s_-]|$)/i;
// Em linha: quando dois ficam colados, recebem um espaço entre si.
const EM_LINHA = "span, a, strong, em, b, i, button, label, small, td, th";

const CORTE = " […]";

function ehPeriferico($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): boolean {
  return $(el).find("main, h1").length === 0 && !$(el).is("html, body, main");
}

function amostrarPorSecao(texto: string, limite: number): string {
  const secoes: string[] = [];
  for (const linha of texto.split("\n")) {
    if (linha.startsWith("#") || secoes.length === 0) secoes.push(linha);
    else secoes[secoes.length - 1] += "\n" + linha;
  }
  // Seção que cabe na fatia igual entra inteira; o que ela não usou é redividido
  // entre as maiores, até todas caberem ou o limite acabar.
  const cotas = new Array<number>(secoes.length).fill(0);
  let restante = limite - (secoes.length - 1); // descontados os "\n" entre seções
  let pendentes = secoes.map((_, i) => i);
  while (pendentes.length > 0) {
    const fatia = Math.floor(restante / pendentes.length);
    const cabem = pendentes.filter((i) => secoes[i].length <= fatia);
    if (cabem.length === 0) {
      for (const i of pendentes) cotas[i] = fatia;
      break;
    }
    for (const i of cabem) {
      cotas[i] = secoes[i].length;
      restante -= secoes[i].length;
    }
    pendentes = pendentes.filter((i) => secoes[i].length > fatia);
  }
  return secoes
    .map((s, i) => (s.length <= cotas[i] ? s : s.slice(0, Math.max(0, cotas[i] - CORTE.length)).trimEnd() + CORTE))
    .join("\n");
}

export function extrairTextoParaJulgamento(html: string, limite = LIMITE_PADRAO): string {
  const $ = cheerio.load(html);

  $(SEMPRE_REMOVER).remove();
  $(MOLDURA).each((_, el) => {
    if ($(el).find("main").length > 0 || $(el).is("html, body, main")) return;
    const h1s = $(el).find("h1");
    if (h1s.length > 0) $(el).replaceWith(h1s);
    else $(el).remove();
  });
  $("[class], [id]")
    .filter((_, el) => CLASSE_RUIDO.test(`${$(el).attr("class") ?? ""} ${$(el).attr("id") ?? ""}`) && ehPeriferico($, el))
    .remove();

  $(EM_LINHA).each((_, el) => {
    if ((el.nextSibling as { type?: string } | null)?.type === "tag") $(el).append(" ");
  });

  const limpo = (s: string) => s.replace(/\s+/g, " ").trim();
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const nivel = Number((el as { tagName: string }).tagName.slice(1));
    const titulo = limpo($(el).text());
    $(el).replaceWith(titulo ? `\n${"#".repeat(nivel)} ${titulo}\n` : "\n");
  });
  $("li").each((_, el) => {
    $(el).replaceWith(`\n- ${limpo($(el).text())}\n`);
  });
  $("br").replaceWith("\n");
  $("p, div, section, article, blockquote, tr, dt, dd").append("\n");

  const texto = $("body")
    .text()
    .split("\n")
    .map((linha) => linha.replace(/[ \t ]+/g, " ").trim())
    .filter((linha) => linha.length > 0)
    .join("\n");

  return texto.length <= limite ? texto : amostrarPorSecao(texto, limite);
}
