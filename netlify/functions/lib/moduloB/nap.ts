// netlify/functions/lib/moduloB/nap.ts

import * as cheerio from "cheerio";
import { ehTipoNegocio, tiposDoBloco, type BlocoJsonLd } from "./jsonld";

export interface Nap {
  nome: boolean;
  telefone: string | null;
  endereco: boolean;
  cep: string | null;
  horario: boolean;
  pagina_autor: boolean;
}

// DDD + 8 ou 9 dígitos, isolado: não pode estar grudado em letra, dígito ou hífen
// (evita casar trecho de ID, hash ou nome de arquivo).
const REGEX_TELEFONE_BR = /(?<![\w-])(?:\+?55[\s.-]?)?\(?[1-9]\d\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?![\w-])/;
// CEP só com hífen ou com o rótulo "CEP" — 8 dígitos soltos são quase sempre outra coisa.
const REGEX_CEP = /(?<![\w-])\d{5}-\d{3}(?![\w-])|CEP[:\s]*\d{5}-?\d{3}/i;
const REGEX_HORARIO = /hor[aá]rios? de (funcionamento|atendimento)/i;

export const CAMINHOS_AUTOR =["/sobre", "/autor", "/quem-somos", "/equipe", "/nossa-equipe", "/about"];
const REGEX_SECAO_AUTOR = /^(sobre|sobre-nos|autor|quem-somos|equipe|nossa-equipe|about)$/i;

function achaBlocoNegocio(blocos: BlocoJsonLd[]): BlocoJsonLd | undefined {
  const negocios = blocos.filter((b) => tiposDoBloco(b).some(ehTipoNegocio));
  // Organization genérica (comum em loja virtual) só se não houver tipo mais específico.
  return negocios.find((b) => !tiposDoBloco(b).includes("Organization")) ?? negocios[0];
}

export function analisarNap(html: string, blocos: BlocoJsonLd[]): Nap {
  const $ = cheerio.load(html);
  const negocio = achaBlocoNegocio(blocos);

  const telLink = $('a[href^="tel:" i]').first().attr("href")?.replace(/^tel:/i, "").trim() || null;

  // Só o texto que uma pessoa vê: <script>, <style> etc. carregam IDs e nomes de
  // arquivo que casam com os regexes de telefone e CEP.
  $("script, style, noscript, template").remove();
  const textoVisivel = $("body").text();

  const telefone =
    (typeof negocio?.telephone === "string" ? negocio.telephone : null) ??
    telLink ??
    textoVisivel.match(REGEX_TELEFONE_BR)?.[0] ??
    null;
  const cep = textoVisivel.match(REGEX_CEP)?.[0] ?? null;
  const horario =
    Boolean(negocio?.openingHoursSpecification) || Boolean(negocio?.openingHours) || REGEX_HORARIO.test(textoVisivel);
  const endereco = Boolean(negocio?.address) || cep !== null;

  const linkAutor = $("a[href]")
    .toArray()
    .some((el) => {
      const href = ($(el).attr("href") ?? "").toLowerCase();
      return CAMINHOS_AUTOR.some((c) => href.includes(c));
    });
  // Site de página única: a seção "sobre" é o equivalente à página.
  const secaoAutor = $("[id]")
    .toArray()
    .some((el) => REGEX_SECAO_AUTOR.test($(el).attr("id") ?? ""));
  // Pessoa identificável declarada no schema — nome é o mínimo.
  const pessoaNoSchema =
    Boolean(negocio?.author || negocio?.founder || negocio?.employee) ||
    blocos.some((b) => tiposDoBloco(b).includes("Person") && typeof b.name === "string" && b.name.trim() !== "");

  return {
    nome: Boolean(negocio?.name) || $("title").text().trim().length > 0,
    telefone,
    endereco,
    cep,
    horario,
    pagina_autor: linkAutor || secaoAutor || pessoaNoSchema,
  };
}
