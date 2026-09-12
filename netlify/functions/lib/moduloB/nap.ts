// netlify/functions/lib/moduloB/nap.ts

import * as cheerio from "cheerio";
import type { BlocoJsonLd } from "./jsonld";

export interface Nap {
  nome: boolean;
  telefone: string | null;
  endereco: boolean;
  cep: string | null;
  horario: boolean;
  pagina_autor: boolean;
}

const REGEX_TELEFONE_BR = /\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/;
const REGEX_CEP = /\d{5}-?\d{3}/;

function achaBlocoNegocio(blocos: BlocoJsonLd[]): BlocoJsonLd | undefined {
  return blocos.find((b) => {
    const t = Array.isArray(b["@type"]) ? b["@type"] : [b["@type"]];
    return t.some((x) => typeof x === "string" && /Business|Organization|Restaurant/.test(x));
  });
}

export function analisarNap(html: string, blocos: BlocoJsonLd[]): Nap {
  const $ = cheerio.load(html);
  const textoCompleto = $("body").text();
  const negocio = achaBlocoNegocio(blocos);

  const telefone =
    (typeof negocio?.telephone === "string" ? negocio.telephone : null) ??
    textoCompleto.match(REGEX_TELEFONE_BR)?.[0] ??
    null;
  const cep = textoCompleto.match(REGEX_CEP)?.[0] ?? null;
  const horario =
    Boolean(negocio?.openingHoursSpecification) ||
    /hor[aá]rio de (funcionamento|atendimento)/i.test(textoCompleto);
  const endereco = Boolean(negocio?.address) || cep !== null;

  const paginaAutor =
    $('a[href*="/sobre" i], a[href*="/autor" i], a[href*="/quem-somos" i]').length > 0 ||
    Boolean(negocio?.author);

  return {
    nome: Boolean(negocio?.name) || $("title").text().trim().length > 0,
    telefone,
    endereco,
    cep,
    horario,
    pagina_autor: paginaAutor,
  };
}
