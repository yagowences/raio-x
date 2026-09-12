// netlify/functions/raiox-audit-background.ts
//
// Worker disparado por raiox.ts. Roda o Módulo B, a chamada de julgamento, o
// índice e o laudo, e grava tudo na linha da auditoria. Background function:
// não devolve resposta ao cliente, até 15 min de execução (tech-spec §6.1).

import type { Config } from "@netlify/functions";
import { getPool } from "./lib/db";
import { rodarModuloB } from "./lib/moduloB/orquestrador";
import { julgarConteudo } from "./lib/julgamento";
import { calcularIndice, type NotaPilar } from "../../src/dominio/indice";
import { montarLaudo } from "../../src/dominio/laudo";
import type { EixoConteudo, Nota, SiteResultado } from "../../src/api/tipos";

interface Corpo {
  auditoriaId: string;
}

/**
 * Notas 0-100 dos pilares que o Módulo B mede sozinho. Heurísticas simples e
 * documentadas aqui — não é o casamento do Módulo A, é o que dá para extrair
 * de checagens determinísticas mais o julgamento de conteúdo (LLM).
 *
 * Um pilar só entra na lista se houve dado suficiente para julgá-lo; ausência
 * de dado nunca vira nota 0 disfarçada — ela simplesmente sai da lista, e
 * calcularIndice() renormaliza sem ele (docs/03 §2).
 */
function notasDoModuloB(
  sr: SiteResultado,
  conteudo: Record<EixoConteudo, Nota> | null
): NotaPilar[] {
  const notas: NotaPilar[] = [];

  if (sr.tecnica) {
    const totalAcesso = sr.tecnica.acesso.length || 1;
    const bloqueados = sr.tecnica.acesso.filter((a) => a.bloqueado).length;
    let nota = 100 - (bloqueados / totalAcesso) * 70;
    if (sr.tecnica.html_estatico.suspeita_spa) nota -= 20;
    if (!sr.tecnica.sitemap.existe) nota -= 10;
    notas.push({ id: "tecnica", nota: Math.max(0, Math.min(100, Math.round(nota))), confianca: "alta" });
  }

  if (sr.nap) {
    const campos = [Boolean(sr.nap.nome), sr.nap.telefone !== null, sr.nap.endereco, sr.nap.horario];
    const presentes = campos.filter(Boolean).length;
    notas.push({ id: "local_nap", nota: Math.round((presentes / campos.length) * 100), confianca: "alta" });

    // autoria_onpage: só a página de autor — é o único sinal on-page que o
    // Módulo B mede sem julgamento de LLM.
    notas.push({ id: "autoria_onpage", nota: sr.nap.pagina_autor ? 100 : 20, confianca: "media" });
  }

  if (sr.dados_estruturados) {
    if (!sr.dados_estruturados.presente) {
      notas.push({ id: "dados_estruturados", nota: 5, confianca: "alta" });
    } else {
      const faltando = Object.values(sr.dados_estruturados.campos_faltando).flat().length;
      const nota = faltando === 0 ? 95 : Math.max(20, 95 - faltando * 15);
      notas.push({ id: "dados_estruturados", nota, confianca: "alta" });
    }
  }

  // estrutura: metade determinístico (títulos, alt text), metade julgamento de
  // conteúdo. Sem o julgamento (LLM falhou), o pilar sai da lista por completo
  // — não empurra uma "meia-nota" estrutural sozinha (docs/03 §2, §6.4).
  if (sr.estrutura && conteudo) {
    let notaEstrutural = 50;
    if (!sr.estrutura.salto_de_nivel) notaEstrutural += 20;
    notaEstrutural +=
      sr.estrutura.imagens > 0 ? Math.round((sr.estrutura.imagens_com_alt / sr.estrutura.imagens) * 20) : 10;
    notaEstrutural = Math.min(100, notaEstrutural);

    const notasConteudo = Object.values(conteudo)
      .map((n) => n.nota)
      .filter((n): n is number => typeof n === "number");
    const mediaConteudo =
      notasConteudo.length > 0 ? (notasConteudo.reduce((s, n) => s + n, 0) / notasConteudo.length) * 10 : notaEstrutural;

    notas.push({ id: "estrutura", nota: Math.round((notaEstrutural + mediaConteudo) / 2), confianca: "baixa" });
  }

  return notas;
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
        const roboBloqueado = siteResultadoFinal.tecnica?.acesso.find((a) => a.bloqueado);
        const robotsNegaCritico = siteResultadoFinal.tecnica?.robots.some(
          (r) => r.gravidade === "critica" && !r.permitido
        );
        const tetoAcionado = Boolean(siteResultadoFinal.tecnica?.bloqueio_silencioso || robotsNegaCritico);

        indiceCompleto = calcularIndice(notas, {
          tetoAcionado,
          motivoTeto: roboBloqueado ? `${roboBloqueado.ua} bloqueado por HTTP ${roboBloqueado.status}` : undefined,
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
