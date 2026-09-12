// netlify/functions/lib/moduloB/html.ts

import * as cheerio from "cheerio";

export interface HtmlEstatico {
  chars_bruto: number;
  suspeita_spa: boolean;
}

export interface Estrutura {
  h1: number;
  h2: number;
  h3: number;
  salto_de_nivel: boolean;
  tabelas: number;
  listas: number;
  imagens: number;
  imagens_com_alt: number;
  video_com_transcricao: boolean | null;
}

export function analisarHtml(html: string): { estatico: HtmlEstatico; estrutura: Estrutura } {
  const $ = cheerio.load(html);

  const textoVisivel = $("body").text().replace(/\s+/g, " ").trim();
  const charsBruto = textoVisivel.length;

  const raizApp = $("#root, #app, #__next");
  const raizVazia = raizApp.length > 0 && raizApp.text().trim().length < 20;
  const suspeitaSpa = charsBruto < 500 && ($("script").length > 3 || raizVazia);

  const h1 = $("h1").length;
  const h2 = $("h2").length;
  const h3 = $("h3").length;
  const saltoDeNivel = (h3 > 0 && h2 === 0) || (h2 > 0 && h1 === 0);

  const imagens = $("img").length;
  const imagensComAlt = $("img[alt]").filter((_, el) => ($(el).attr("alt") ?? "").trim().length > 0).length;

  const temVideo = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;
  const temLegenda = $('track[kind="captions"]').length > 0;
  const temTranscricaoTexto = $('[class*="transcri"], [id*="transcri"]').length > 0;
  const videoComTranscricao = temVideo ? temLegenda || temTranscricaoTexto : null;

  return {
    estatico: { chars_bruto: charsBruto, suspeita_spa: suspeitaSpa },
    estrutura: {
      h1,
      h2,
      h3,
      salto_de_nivel: saltoDeNivel,
      tabelas: $("table").length,
      listas: $("ul, ol").length,
      imagens,
      imagens_com_alt: imagensComAlt,
      video_com_transcricao: videoComTranscricao,
    },
  };
}
