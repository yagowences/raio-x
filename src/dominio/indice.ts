// src/dominio/indice.ts
//
// Função pura, sem I/O. Usada pela função de background (Módulo B real) e
// disponível para o front caso um dia precise recalcular algo localmente.
// Regras em docs/03-regras-de-negocio.md §2.

import pesosConfig from "../../config/pesos.json";
import type { Confianca, Indice } from "../api/tipos";

interface PesoPilarConfig {
  id: string;
  rotulo: string;
  peso: number;
  fonte: "modulo_a" | "modulo_b";
  multiplicador?: boolean;
}

interface PesosJson {
  versao: string;
  teto_multiplicador: number;
  pilares: PesoPilarConfig[];
}

const pesos = pesosConfig as PesosJson;

export interface NotaPilar {
  id: string;
  nota: number; // 0..100
  confianca: Confianca;
}

export interface OpcoesIndice {
  /** true quando algum robô de gravidade crítica está bloqueado (robots ou 403/429). */
  tetoAcionado: boolean;
  /** ex.: "PerplexityBot bloqueado por HTTP 403". Só usado se o teto realmente cortar. */
  motivoTeto?: string;
}

/**
 * calcularIndice — soma ponderada só sobre os pilares MEDIDOS (não os 6 sempre),
 * depois aplica o teto de 30 como corte, não como parcela.
 *
 * Fórmula: Σ(peso × nota) / Σ(peso dos pilares medidos). SEM ×100 — `nota` já é
 * 0-100 e `peso` é inteiro. A tech-spec §7.1 assume nota 0-1; aqui não é o caso.
 *
 * `teto_aplicado` só vem preenchido se o corte realmente aconteceu (bruto > 30).
 * Um site bloqueado cujo bruto já era ≤ 30 fica com `teto_aplicado: null` — o
 * bloqueio continua reportado em `site_resultado.tecnica`, só não "morde" o índice.
 */
export function calcularIndice(notas: NotaPilar[], opcoes: OpcoesIndice): Indice {
  const porId = new Map(notas.map((n) => [n.id, n]));
  const medidos = pesos.pilares.filter((p) => porId.has(p.id));

  if (medidos.length === 0) {
    throw new Error("calcularIndice: nenhum pilar medido — nota vazia não produz índice");
  }

  const somaPeso = medidos.reduce((soma, p) => soma + p.peso, 0);
  const somaProduto = medidos.reduce((soma, p) => soma + p.peso * porId.get(p.id)!.nota, 0);
  const bruto = somaProduto / somaPeso;

  const mordeu = opcoes.tetoAcionado && bruto > pesos.teto_multiplicador;
  const valor = Math.round(mordeu ? pesos.teto_multiplicador : bruto);

  return {
    valor,
    teto_aplicado: mordeu ? pesos.teto_multiplicador : null,
    motivo_teto: mordeu ? (opcoes.motivoTeto ?? null) : null,
    versao_pesos: pesos.versao,
    pilares: medidos.map((p) => {
      const n = porId.get(p.id)!;
      return { id: p.id, rotulo: p.rotulo, peso: p.peso, nota: n.nota, confianca: n.confianca };
    }),
  };
}

/** Soma dos pesos efetivamente medidos — usado na copy ("X dos 100 pontos"). */
export function pesoMedido(indice: Indice): number {
  return indice.pilares.reduce((soma, p) => soma + p.peso, 0);
}
