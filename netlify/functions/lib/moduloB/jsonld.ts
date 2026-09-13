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

const CAMPOS_LOCAL_BUSINESS = ["address", "telephone", "openingHoursSpecification"];

const CAMPOS_OBRIGATORIOS: Record<string, string[]> = {
  LocalBusiness: CAMPOS_LOCAL_BUSINESS,
  MedicalBusiness: ["address", "telephone"],
  HealthAndBeautyBusiness: ["address", "telephone"],
  FoodEstablishment: ["servesCuisine", "priceRange"],
  Organization: ["address", "telephone"],
};

// Subtipos de LocalBusiness comuns em negócio local. Herdam os campos de
// LocalBusiness — sem isso, um BeautySalon passava sem checagem nenhuma.
const SUBTIPOS_LOCAL_BUSINESS = new Set([
  "BeautySalon",
  "HairSalon",
  "NailSalon",
  "DaySpa",
  "TattooParlor",
  "Store",
  "ClothingStore",
  "JewelryStore",
  "ShoeStore",
  "PetStore",
  "OpticianStore",
  "Optician",
  "Dentist",
  "Physician",
  "MedicalClinic",
  "Pharmacy",
  "VeterinaryCare",
  "ExerciseGym",
  "HealthClub",
  "ProfessionalService",
  "LegalService",
  "Attorney",
  "AccountingService",
  "RealEstateAgent",
  "AutoRepair",
  "ChildCare",
  "Hotel",
  "LodgingBusiness",
]);

/** Campo alternativo aceito no lugar do obrigatório (schema.org aceita os dois). */
const CAMPO_ALTERNATIVO: Record<string, string> = {
  openingHoursSpecification: "openingHours",
};

export function tiposDoBloco(bloco: BlocoJsonLd): string[] {
  const t = Array.isArray(bloco["@type"]) ? bloco["@type"] : [bloco["@type"]];
  return t.filter((x): x is string => typeof x === "string");
}

function camposObrigatorios(tipo: string): string[] | undefined {
  return CAMPOS_OBRIGATORIOS[tipo] ?? (SUBTIPOS_LOCAL_BUSINESS.has(tipo) ? CAMPOS_LOCAL_BUSINESS : undefined);
}

/** Tipo que representa o negócio em si (e não página, produto, pessoa...). */
export function ehTipoNegocio(tipo: string): boolean {
  return (
    tipo in CAMPOS_OBRIGATORIOS ||
    SUBTIPOS_LOCAL_BUSINESS.has(tipo) ||
    /Business|Organization|Restaurant|Store/.test(tipo)
  );
}

/**
 * Extrai todo bloco JSON-LD do HTML, abrindo `@graph` (formato do Yoast e do
 * Rank Math). JSON malformado é ignorado, não derruba a auditoria.
 */
export function extrairJsonLd(html: string): BlocoJsonLd[] {
  const $ = cheerio.load(html);
  const blocos: BlocoJsonLd[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const conteudo = JSON.parse($(el).text());
      const lista: BlocoJsonLd[] = Array.isArray(conteudo) ? conteudo : [conteudo];
      for (const item of lista) {
        if (Array.isArray(item?.["@graph"])) blocos.push(...item["@graph"]);
        if (item?.["@type"] !== undefined) blocos.push(item);
      }
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

  const tipos = [...new Set(blocos.flatMap(tiposDoBloco))];

  const camposFaltando: Record<string, string[]> = {};
  for (const bloco of blocos) {
    for (const t of tiposDoBloco(bloco)) {
      const obrigatorios = camposObrigatorios(t);
      if (!obrigatorios) continue;
      const faltando = obrigatorios.filter((campo) => {
        const alternativo = CAMPO_ALTERNATIVO[campo];
        return bloco[campo] === undefined && (!alternativo || bloco[alternativo] === undefined);
      });
      if (faltando.length > 0) camposFaltando[t] = faltando;
    }
  }

  // risco: aggregateRating declarado sem review[] correspondente (fonte pública da nota).
  // Risco, nunca veredito — docs/03-regras-de-negocio.md §4.
  const riscoAvaliacao = blocos.some((b) => b.aggregateRating !== undefined && b.review === undefined);

  return { presente: true, tipos, campos_faltando: camposFaltando, risco_avaliacao: riscoAvaliacao };
}
