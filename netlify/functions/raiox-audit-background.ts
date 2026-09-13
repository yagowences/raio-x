// netlify/functions/raiox-audit-background.ts
//
// Worker disparado por raiox.ts. Roda o Módulo B, a chamada de julgamento, o
// índice e o laudo, e grava tudo na linha da auditoria. Background function:
// não devolve resposta ao cliente, até 15 min de execução (tech-spec §6.1).

import type { Config } from "@netlify/functions";
import { getPool } from "./lib/db";
import { rodarModuloB } from "./lib/moduloB/orquestrador";
import { julgarConteudo } from "./lib/julgamento";
import { calcularIndice } from "../../src/dominio/indice";
import { notasDoModuloB } from "../../src/dominio/notas";
import { bloqueioCritico, motivoTeto } from "../../src/dominio/bloqueio";
import { montarLaudo } from "../../src/dominio/laudo";
import type { SiteResultado } from "../../src/api/tipos";

interface Corpo {
  auditoriaId: string;
}

export default async (req: Request) => {
  const { auditoriaId } = (await req.json()) as Corpo;
  const pool = getPool();

  const linha = await pool.query(
    `select negocio, segmento, cidade, site from auditorias where id = $1`,
    [auditoriaId]
  );
  if (linha.rows.length === 0) return; // nada a fazer — a linha sumiu

  const { negocio, segmento, cidade, site } = linha.rows[0] as {
    negocio: string;
    segmento: string;
    cidade: string;
    site: string;
  };

  try {
    const { siteResultado, textoParaJulgamento } = await rodarModuloB(site);

    let siteResultadoFinal: SiteResultado = siteResultado;
    let indiceCompleto = null;
    let laudo = null;

    if (siteResultado.avaliado) {
      const conteudo = await julgarConteudo(textoParaJulgamento);
      siteResultadoFinal = { ...siteResultado, conteudo };

      const notas = notasDoModuloB(siteResultadoFinal, conteudo);
      if (notas.length > 0) {
        // Teto só para robô de gravidade crítica (docs/03 §2, invariante 8 de docs/05).
        const bloqueio = bloqueioCritico(siteResultadoFinal);
        indiceCompleto = calcularIndice(notas, {
          tetoAcionado: bloqueio !== null,
          motivoTeto: bloqueio ? motivoTeto(bloqueio) : undefined,
        });

        laudo = montarLaudo({
          negocio: { nome: negocio, segmento, cidade },
          site_resultado: siteResultadoFinal,
          indice: indiceCompleto,
          visibilidade: null,
        });
      }
    }

    await pool.query(
      `update auditorias
       set status = 'na_fila',
           site_resultado = $2,
           indice = $3,
           indice_completo = $4,
           laudo = $5,
           versao_pesos = $6,
           concluido_em = now()
       where id = $1`,
      [
        auditoriaId,
        JSON.stringify(siteResultadoFinal),
        indiceCompleto?.valor ?? null,
        indiceCompleto ? JSON.stringify(indiceCompleto) : null,
        laudo ? JSON.stringify(laudo) : null,
        indiceCompleto?.versao_pesos ?? null,
      ]
    );
  } catch {
    // Falha inesperada em qualquer ponto do pipeline: fecha a auditoria como
    // erro do nosso lado, nunca deixa "parcial" para sempre nem inventa dado.
    await pool.query(
      `update auditorias
       set status = 'na_fila', site_resultado = $2, concluido_em = now()
       where id = $1`,
      [auditoriaId, JSON.stringify({ avaliado: false, motivo: "erro" })]
    );
  }
};

export const config: Config = {
  background: true,
};
