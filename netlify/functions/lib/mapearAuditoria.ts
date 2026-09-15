// netlify/functions/lib/mapearAuditoria.ts
//
// Converte uma linha da tabela `auditorias` (colunas jsonb já desserializadas
// pelo driver `pg`) para o formato `Auditoria` que o front consome.

import type { Auditoria, Indice, LaudoResultado, SiteResultado, Status } from "../../../src/api/tipos";

export interface LinhaAuditoria {
  id: string;
  negocio: string;
  segmento: string;
  cidade: string;
  estado: string | null;
  site: string | null;
  status: string;
  site_resultado: SiteResultado | null;
  indice_completo: Indice | null;
  laudo: LaudoResultado | null;
}

export function mapearAuditoria(linha: LinhaAuditoria): Auditoria {
  return {
    auditoria_id: linha.id,
    status: linha.status as Status,
    negocio: {
      nome: linha.negocio,
      segmento: linha.segmento,
      cidade: linha.cidade,
      // Linhas gravadas antes da migration 0003 não têm estado — "" é o
      // valor de "não informado" aqui (não há sigla de UF vazia de verdade).
      estado: linha.estado ?? "",
      site: linha.site,
    },
    // Este backend implementa só a etapa gratuita — nunca há corpus. Ver
    // docs/03-regras-de-negocio.md, "Com site, sem corpus".
    corpus: { disponivel: false, previsao_horas: 24 },
    visibilidade: null,
    site_resultado: linha.site_resultado,
    indice: linha.indice_completo,
    laudo: linha.laudo,
  };
}
