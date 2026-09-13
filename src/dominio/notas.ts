// src/dominio/notas.ts
//
// Notas 0-100 dos pilares que o Módulo B mede sozinho. Heurísticas simples,
// documentadas em docs/03-regras-de-negocio.md §2.1 — não é o casamento do
// Módulo A, é o que dá para extrair de checagens determinísticas mais o
// julgamento de conteúdo (LLM).
//
// Um pilar só entra na lista se houve dado suficiente para julgá-lo; ausência
// de dado nunca vira nota 0 disfarçada — ela simplesmente sai da lista, e
// calcularIndice() renormaliza sem ele (docs/03 §2).

import type { EixoConteudo, Nota, SiteResultado } from "../api/tipos";
import type { NotaPilar } from "./indice";
import { robosSemAcesso } from "./bloqueio";

export function notasDoModuloB(
  sr: SiteResultado,
  conteudo: Record<EixoConteudo, Nota> | null
): NotaPilar[] {
  const notas: NotaPilar[] = [];

  if (sr.tecnica) {
    const tecnica = sr.tecnica;
    const robosIa = tecnica.robots.filter((r) => r.gravidade !== "baixa").length;
    let nota = 100 - (robosSemAcesso(sr).length / (robosIa || 1)) * 70;
    if (tecnica.html_estatico.suspeita_spa) nota -= 20;
    if (!tecnica.sitemap.existe) nota -= 10;
    notas.push({ id: "tecnica", nota: Math.max(0, Math.min(100, Math.round(nota))), confianca: "alta" });
  }

  if (sr.nap) {
    const campos = [Boolean(sr.nap.nome), sr.nap.telefone !== null, sr.nap.endereco, sr.nap.horario];
    const presentes = campos.filter(Boolean).length;
    notas.push({ id: "local_nap", nota: Math.round((presentes / campos.length) * 100), confianca: "alta" });

    // autoria_onpage (spec §7: o E-E-A-T que o site declara): metade checagem da
    // página/seção/pessoa do responsável, metade o eixo sinais_de_autoria lido no
    // texto. Sem julgamento, fica só a checagem — nunca meia-nota inventada.
    const paginaAutor = sr.nap.pagina_autor ? 100 : 20;
    const autoriaLida = conteudo?.sinais_de_autoria?.nota;
    const notaAutoria =
      typeof autoriaLida === "number" ? Math.round((paginaAutor + autoriaLida * 10) / 2) : paginaAutor;
    notas.push({ id: "autoria_onpage", nota: notaAutoria, confianca: "media" });
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

    // sinais_de_autoria já pesa em autoria_onpage; contá-lo aqui também seria dupla contagem.
    const notasConteudo = Object.entries(conteudo)
      .filter(([eixo]) => eixo !== "sinais_de_autoria")
      .map(([, n]) => n.nota)
      .filter((n): n is number => typeof n === "number");
    const mediaConteudo =
      notasConteudo.length > 0 ? (notasConteudo.reduce((s, n) => s + n, 0) / notasConteudo.length) * 10 : notaEstrutural;

    notas.push({ id: "estrutura", nota: Math.round((notaEstrutural + mediaConteudo) / 2), confianca: "baixa" });
  }

  return notas;
}
