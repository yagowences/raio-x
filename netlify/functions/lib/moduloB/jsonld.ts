// netlify/functions/lib/moduloB/jsonld.ts

import * as cheerio from "cheerio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BlocoJsonLd = Record<string, any>;

export interface DadosEstruturados {
  presente: boolean;
  tipos: string[];
  campos_faltando: Record<string, string[]>;
  risco_avaliacao: boolean;
}

const CAMPOS_OBRIGATORIOS: Record<string, string[]> = {
  LocalBusiness: ["address", "telephone", "openingHoursSpecification"],
  MedicalBusiness: ["address", "telephone"],
  HealthAndBeautyBusiness: ["address", "telephone"],
  FoodEstablishment: ["servesCuisine", "priceRange"],
  Organization: ["address", "telephone"],
};

/** Extrai todo bloco JSON-LD do HTML. JSON malformado é ignorado, não derruba a auditoria. */
export function extrairJsonLd(html: string): BlocoJsonLd[] {
  const $ = cheerio.load(html);
  const blocos: BlocoJsonLd[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const conteudo = JSON.parse($(el).text());
      const lista = Array.isArray(conteudo) ? conteudo : [conteudo];
      blocos.push(...lista);
    } catch {
      // ignora bloco malformado
    }
  });

  return blocos;
}

export function analisarDadosEstruturados(blocos: BlocoJsonLd[]): DadosEstruturados {
  if (blocos.length === 0) {
    return { presente: false, tipos: [], campos_faltando: {}, risco_avaliacao: false };
  }

  const tipos = [
    ...new Set(
      blocos
        .flatMap((b) => (Array.isArray(b["@type"]) ? b["@type"] : [b["@type"]]))
        .filter((t): t is string => typeof t === "string")
    ),
  ];

  const camposFaltando: Record<string, string[]> = {};
  for (const bloco of blocos) {
    const tiposDoBloco = Array.isArray(bloco["@type"]) ? bloco["@type"] : [bloco["@type"]];
    for (const t of tiposDoBloco) {
      const obrigatorios = CAMPOS_OBRIGATORIOS[t];
      if (!obrigatorios) continue;
      const faltando = obrigatorios.filter((campo) => bloco[campo] === undefined);
      if (faltando.length > 0) camposFaltando[t] = faltando;
    }
  }

  // risco: aggregateRating declarado sem review[] correspondente (fonte pública da nota).
  // Risco, nunca veredito — docs/03-regras-de-negocio.md §4.
  const riscoAvaliacao = blocos.some((b) => b.aggregateRating !== undefined && b.review === undefined);

  return { presente: true, tipos, campos_faltando: camposFaltando, risco_avaliacao: riscoAvaliacao };
}
