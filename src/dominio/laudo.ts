// src/dominio/laudo.ts
//
// Módulo C — laudo por template, zero LLM. Regras em docs/03-regras-de-negocio.md §4.
// Liga config/gatilhos.json ao índice e à visibilidade (quando houver).

import gatilhosConfig from "../../config/gatilhos.json";
import { pesoMedido } from "./indice";
import { bloqueioCriticoHttp, bloqueioCriticoRobots } from "./bloqueio";
import { descreverCidade, descreverSegmento } from "./segmento";
import type { Dominio, EixoConteudo, Indice, LaudoResultado, SiteResultado, Visibilidade } from "../api/tipos";

interface Gatilho {
  id: string;
  condicao: string;
  requer_corpus: boolean;
  pilar: string;
  prioridade_forcada?: number;
  titulo: string;
  texto: string;
  dado: string;
}

const gatilhos: Gatilho[] = (gatilhosConfig as { gatilhos: Gatilho[] }).gatilhos;

export interface ContextoLaudo {
  negocio: { nome: string; segmento: string; cidade: string };
  site_resultado: SiteResultado | null;
  indice: Indice;
  /** null quando não há corpus (etapa gratuita) — invariantes 16-18 de docs/05. */
  visibilidade: Visibilidade | null;
}

/**
 * `gatilhos.json` é arquivo nosso, versionado — nunca entrada de usuário.
 * `new Function` aqui é o interpretador de uma DSL de condição pequena, não
 * execução de código externo. Qualquer erro de avaliação vira `false`: um
 * gatilho que falha ao avaliar simplesmente não dispara, nunca derruba o laudo.
 */
function avaliarCondicao(
  condicao: string,
  site_resultado: SiteResultado | null,
  dominio: Dominio | undefined,
  visibilidade: Visibilidade | null
): boolean {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "site_resultado",
      "dominio",
      "visibilidade",
      `"use strict"; return Boolean(${condicao});`
    );
    return fn(site_resultado, dominio, visibilidade);
  } catch {
    return false;
  }
}

// Gatilhos de conteúdo → eixo do julgamento cuja nota vira o `dado`.
const EIXO_DO_GATILHO: Record<string, EixoConteudo> = {
  conteudo_resposta_indireta: "resposta_direta",
  conteudo_titulos_sem_pergunta: "perguntas_reais",
  conteudo_generico: "ganho_informacional",
  conteudo_sem_prova_social: "prova_social",
};

function rotuloNapFaltando(nap: NonNullable<SiteResultado["nap"]>): string {
  const faltando: string[] = [];
  if (nap.telefone === null) faltando.push("telefone");
  if (!nap.endereco) faltando.push("endereço");
  if (!nap.horario) faltando.push("horário");
  return faltando.length > 0 ? `faltando: ${faltando.join(", ")}` : "completo";
}

function rotuloCamposFaltando(campos: Record<string, string[]>): string {
  return Object.entries(campos)
    .map(([tipo, lista]) => `${tipo}: ${lista.join(", ")}`)
    .join("; ");
}

function resolverValores(id: string, ctx: ContextoLaudo, dominio: Dominio | undefined): Record<string, string> {
  const { negocio, site_resultado: sr, visibilidade: v } = ctx;
  const base: Record<string, string> = {
    negocio: negocio.nome,
    segmento: negocio.segmento,
    cidade: negocio.cidade,
    url: sr?.url_final ?? "seu site",
  };

  switch (id) {
    case "bot_critico_bloqueado": {
      const r = bloqueioCriticoHttp(sr);
      return { ...base, ua: r?.ua ?? "robô crítico", status: String(r?.status ?? "—") };
    }
    case "bot_bloqueado_http": {
      const t = sr?.tecnica;
      const a = t?.acesso.find((x) => x.bloqueado && t.robots.some((r) => r.ua === x.ua && r.permitido));
      return { ...base, ua: a?.ua ?? "robô de IA", status: String(a?.status ?? "—") };
    }
    case "robots_bloqueia_critico": {
      const r = bloqueioCriticoRobots(sr);
      return { ...base, ua: r?.ua ?? "robô crítico" };
    }
    case "ausente_no_dominio_dominante":
      return {
        ...base,
        dominio: dominio?.dominio ?? "",
        freq: String(dominio?.frequencia ?? ""),
        validas: String(ctx.visibilidade?.execucoes_validas ?? ""),
      };
    case "nenhuma_mencao":
      return { ...base, validas: String(ctx.visibilidade?.execucoes_validas ?? "") };
    case "schema_incompleto":
      return {
        ...base,
        campos_faltando: sr?.dados_estruturados ? rotuloCamposFaltando(sr.dados_estruturados.campos_faltando) : "",
      };
    case "nap_incompleto":
      return { ...base, nap_faltando: sr?.nap ? rotuloNapFaltando(sr.nap) : "" };
    case "conteudo_resposta_indireta":
    case "conteudo_titulos_sem_pergunta":
    case "conteudo_generico":
    case "conteudo_sem_prova_social":
      return { ...base, nota: String(sr?.conteudo?.[EIXO_DO_GATILHO[id]]?.nota ?? "") };
    case "suspeita_spa":
      return { ...base, chars: String(sr?.tecnica?.html_estatico.chars_bruto ?? "") };
    case "psi_mobile_baixo":
      return { ...base, psi: String(sr?.tecnica?.psi_mobile ?? "") };
    case "imagens_sem_alt":
      return {
        ...base,
        com_alt: String(sr?.estrutura?.imagens_com_alt ?? ""),
        imagens: String(sr?.estrutura?.imagens ?? ""),
      };
    default:
      return base;
  }
}

function substituir(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (m, chave: string) => (chave in valores ? valores[chave] : m));
}

function montarDiagnostico(ctx: ContextoLaudo): string {
  const { negocio } = ctx;

  if (!ctx.visibilidade) {
    // Etapa gratuita: sem corpus, o diagnóstico não pode citar menção, posição
    // nem concorrente — invariante 18 de docs/05-cenarios-e-fixtures.md.
    return (
      `Ainda não rodamos a varredura de IA para ${negocio.segmento} em ${negocio.cidade}, ` +
      `então não há dado de menção nesta página. O que auditamos foi o seu site, e o índice ` +
      `técnico é ${ctx.indice.valor} de 100, calculado sobre os ${pesoMedido(ctx.indice)} ` +
      `pontos que dependem só dele.`
    );
  }

  const v = ctx.visibilidade;
  const total = v.execucoes_validas;
  const pos = v.posicao_media !== null ? v.posicao_media.toFixed(1) : "—";

  if (v.taxa_mencao === 0) {
    const top3 = v.concorrentes.slice(0, 3).map((c) => c.nome);
    const citados = top3.length > 0 ? top3.join(", ") : "nenhum concorrente com frequência relevante";
    return (
      `Rodamos perguntas que um cliente faria sobre ${negocio.segmento} em ${negocio.cidade}. ` +
      `Em ${total} execuções, o nome ${negocio.nome} não apareceu nenhuma vez. ` +
      `A IA recomendou ${citados}.`
    );
  }

  if (v.taxa_mencao < 0.34) {
    const c1 = v.concorrentes[0];
    const complemento = c1 ? ` ${c1.nome} apareceu em ${c1.mencoes} execuções.` : "";
    return `${negocio.nome} apareceu em ${v.mencoes} de ${total} execuções, na posição média ${pos}.${complemento}`;
  }

  // taxa_mencao >= 0,34: fato comparável, sem elogio (docs/04-regras-de-copy.md).
  const c1 = v.concorrentes[0];
  const lidera = !c1 || v.mencoes >= c1.mencoes;
  const complemento = lidera
    ? "Nenhuma outra entidade foi citada com mais frequência nessas perguntas."
    : `${c1.nome} apareceu com mais frequência, em ${c1.mencoes} execuções.`;
  return `${negocio.nome} apareceu em ${v.mencoes} de ${total} execuções, na posição média ${pos}. ${complemento}`;
}

function montarCta(ctx: ContextoLaudo, temTeto: boolean): { variante: string; titulo: string; subtitulo: string } {
  const { negocio } = ctx;

  if (temTeto) {
    return {
      variante: "bloqueio_critico",
      titulo: "Seu site está invisível para a IA por um motivo específico.",
      subtitulo: `Podemos corrigir o bloqueio técnico e revisar a estrutura de ${negocio.nome} para os motores de IA conseguirem ler o site.`,
    };
  }

  if (!ctx.visibilidade) {
    const medido = pesoMedido(ctx.indice);
    return {
      variante: "gratuita_sem_corpus",
      titulo: "Esta é a parte que conseguimos medir sem varredura do seu nicho.",
      subtitulo:
        `Falta o pilar de autoridade externa, que vale ${100 - medido} dos 100 pontos e depende da ` +
        `varredura de ${negocio.segmento} em ${negocio.cidade}. Deixe seu contato acima e rodamos em até 24 horas.`,
    };
  }

  const v = ctx.visibilidade;
  if (v.taxa_mencao === 0) {
    return {
      variante: "sem_mencao",
      titulo: `Você não apareceu em nenhuma das ${v.execucoes_validas} execuções.`,
      subtitulo: "Podemos revisar o que está impedindo sua presença nas respostas de IA sobre o seu nicho.",
    };
  }

  if (v.taxa_mencao < 0.34) {
    return {
      variante: "mencao_baixa",
      titulo: `Você apareceu ${v.mencoes} vezes em ${v.execucoes_validas} execuções.`,
      subtitulo: "Podemos revisar o que está limitando sua presença nas respostas de IA sobre o seu nicho.",
    };
  }

  return {
    variante: "mencao_boa",
    titulo: `Você apareceu em ${v.mencoes} de ${v.execucoes_validas} execuções.`,
    subtitulo: "Podemos ajudar a consolidar essa posição e cobrir os pilares que ainda pesam contra o índice.",
  };
}

/**
 * montarLaudo — ordem de prioridade fixa, docs/03-regras-de-negocio.md §4:
 *   1. teto acionado           → sempre a recomendação 1
 *   2. domínio dominante ausente (só com corpus) → recomendação 2
 *   3. maior déficit ponderado → preenche o resto, até 3 no total
 *
 * Sem corpus, a regra 2 nunca dispara (invariante 17) e o resto vem inteiro da
 * regra 3 — é por isso que a etapa gratuita produz laudo de verdade mesmo
 * sem menção nenhuma medida.
 *
 * Retorna `null` só se nenhum gatilho disparar — não deveria acontecer na
 * prática (sempre há déficit em algum pilar), mas o chamador não deve assumir
 * `laudo` sempre presente.
 */
export function montarLaudo(ctxOriginal: ContextoLaudo): LaudoResultado | null {
  const { negocio } = ctxOriginal;
  const ctx: ContextoLaudo = {
    ...ctxOriginal,
    negocio: { ...negocio, segmento: descreverSegmento(negocio.segmento), cidade: descreverCidade(negocio.cidade) },
  };
  const comCorpus = ctx.visibilidade !== null;
  const pesoPorId = new Map(ctx.indice.pilares.map((p) => [p.id, p]));
  const temTeto = ctx.indice.teto_aplicado !== null;

  let gatilhoDominio: { gatilho: Gatilho; dominio: Dominio } | null = null;
  if (comCorpus && ctx.visibilidade && ctx.visibilidade.execucoes_validas > 0) {
    const validas = ctx.visibilidade.execucoes_validas;
    const dominante = ctx.visibilidade.dominios_do_nicho.find(
      (d) => d.frequencia / validas >= 0.4 && d.cliente_presente !== true
    );
    if (dominante) {
      const g = gatilhos.find((x) => x.id === "ausente_no_dominio_dominante");
      if (g) gatilhoDominio = { gatilho: g, dominio: dominante };
    }
  }

  const candidatos = gatilhos.filter((g) => {
    if (g.id === "ausente_no_dominio_dominante") return false; // tratado acima, precisa de um domínio específico
    if (g.requer_corpus && !comCorpus) return false; // invariante 17
    return avaliarCondicao(g.condicao, ctx.site_resultado, undefined, ctx.visibilidade);
  });

  const forcados = candidatos.filter((g) => g.prioridade_forcada === 1);
  const semForca = candidatos.filter((g) => g.prioridade_forcada !== 1);

  const porDeficit = semForca
    .map((g) => {
      const p = pesoPorId.get(g.pilar);
      return { g, deficit: p ? p.peso * (1 - p.nota / 100) : 0 };
    })
    .sort((a, b) => b.deficit - a.deficit)
    .map((x) => x.g)
    // No máximo uma por pilar: gatilhos do mesmo pilar têm o mesmo déficit, e três
    // eixos de conteúdo fracos tomariam o laudo inteiro. Vale o primeiro da biblioteca.
    .filter((g, i, lista) => lista.findIndex((x) => x.pilar === g.pilar) === i);

  const ordenados: Array<{ gatilho: Gatilho; dominio?: Dominio }> = forcados.map((g) => ({ gatilho: g }));
  if (gatilhoDominio) ordenados.push(gatilhoDominio);
  ordenados.push(...porDeficit.map((g) => ({ gatilho: g })));

  const top3 = ordenados.slice(0, 3);
  if (top3.length === 0) return null;

  const recomendacoes = top3.map(({ gatilho, dominio }, i) => {
    const valores = resolverValores(gatilho.id, ctx, dominio);
    return {
      prioridade: (i + 1) as 1 | 2 | 3,
      titulo: gatilho.titulo,
      texto: substituir(gatilho.texto, valores),
      dado: substituir(gatilho.dado, valores),
      pilar: gatilho.pilar,
    };
  });

  return {
    diagnostico: montarDiagnostico(ctx),
    recomendacoes,
    cta: montarCta(ctx, temTeto),
  };
}
