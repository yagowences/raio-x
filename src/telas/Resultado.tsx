import React, { useEffect, useRef } from "react";
import { Auditoria, EntradaLead } from "../api/tipos";
import { Chapa, formatarDataVarredura } from "../componentes/Chapa";
import { Metrica } from "../componentes/Metrica";
import { ListaConcorrentes } from "../componentes/ListaConcorrentes";
import { Indice } from "../componentes/Indice";
import { AuditoriaSite } from "../componentes/AuditoriaSite";
import { DominiosDoNicho } from "../componentes/DominiosDoNicho";
import { Recomendacao } from "../componentes/Recomendacao";
import { BlocoBloqueio } from "../componentes/BlocoBloqueio";
import { Captura } from "./Captura";
import { track } from "../analytics";

interface ResultadoProps {
  auditoria: Auditoria;
  aoEnviarLead: (lead: EntradaLead) => Promise<void>;
  enviandoLead: boolean;
  sucessoLead: boolean;
  carregandoParcialSite?: boolean;
  aoNovaConsulta?: () => void;
}

export const Resultado: React.FC<ResultadoProps> = ({
  auditoria,
  aoEnviarLead,
  enviandoLead,
  sucessoLead,
  carregandoParcialSite = false,
  aoNovaConsulta,
}) => {
  const { negocio, corpus, visibilidade, site_resultado, indice, laudo } = auditoria;
  const recomendacoesRef = useRef<HTMLDivElement>(null);
  const trackResultadoFired = useRef(false);
  const trackScrollFired = useRef(false);

  useEffect(() => {
    if (!trackResultadoFired.current && visibilidade) {
      trackResultadoFired.current = true;
      track("raiox_resultado", {
        taxa_mencao: visibilidade.taxa_mencao,
        indice: indice ? indice.valor : null,
      });
    }
  }, [visibilidade, indice]);

  // Observer para rastrear visualização das recomendações (§10)
  useEffect(() => {
    const el = recomendacoesRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !trackScrollFired.current) {
            trackScrollFired.current = true;
            track("raiox_scroll_recomendacoes");
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const totalExec = corpus.total_execucoes ?? 15;
  const temTetoBloqueio = indice?.teto_aplicado !== null && indice?.teto_aplicado !== undefined;

  return (
    <div id="tela-resultado">
      {/* Cabeçalho de Metodologia e Data */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s3)",
          fontSize: "12px",
          color: "var(--grafite)",
          flexWrap: "wrap",
          gap: "var(--s2)",
        }}
      >
        <div>
          Negócio auditado: <strong>{negocio.nome}</strong> ({negocio.segmento} · {negocio.cidade})
        </div>
        <div style={{ fontFamily: "var(--mono)" }}>
          {formatarDataVarredura(corpus.gerado_em)} · {totalExec} execuções
        </div>
      </div>

      {/* BLOCO 1: Diagnóstico Principal */}
      {laudo && (
        <div id="bloco-diagnostico" className="bloco-painel" style={{ borderLeft: "4px solid var(--azul-profundo)" }}>
          <span className="eyebrow">Diagnóstico Geral</span>
          <h1
            className="titulo-destaque"
            style={{
              marginTop: "var(--s1)",
              fontSize: "20px",
              lineHeight: "1.4",
            }}
          >
            {laudo.diagnostico}
          </h1>
        </div>
      )}

      {/* Se houver teto aplicado por bloqueio crítico, sobe o Bloco de Bloqueio (§6.4) */}
      {temTetoBloqueio && site_resultado && indice && (
        <BlocoBloqueio siteResultado={site_resultado} indice={indice} />
      )}

      {/* Resumo de Métricas de Visibilidade */}
      {visibilidade && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "var(--s2)",
            marginBottom: "var(--s4)",
          }}
        >
          <Metrica
            rotulo="Taxa de Menção"
            valor={`${Math.round(visibilidade.taxa_mencao * 100)}%`}
            subtexto={`${visibilidade.mencoes} de ${totalExec} execuções`}
            destaque={true}
          />

          {/* §2.1 Regra: posicao_media: null -> esconder a métrica inteira */}
          {visibilidade.posicao_media !== null && (
            <Metrica
              rotulo="Posição Média"
              valor={`#${visibilidade.posicao_media.toFixed(1)}`}
              subtexto="Quando citado na resposta"
            />
          )}

          <Metrica
            rotulo="Share of Voice"
            valor={`${Math.round(visibilidade.share_of_voice * 100)}%`}
            subtexto="Frequência vs concorrentes"
          />

          <Metrica
            rotulo="Taxa de Fontes"
            valor={`${Math.round(visibilidade.taxa_fonte * 100)}%`}
            subtexto="Presença em portais citados"
          />
        </div>
      )}

      {/* BLOCO 2: Chapa com as 5 bandas resolvidas */}
      {visibilidade && (
        <div style={{ marginBottom: "var(--s4)" }}>
          <Chapa
            id="chapa-resultado"
            visibilidade={visibilidade}
            corpus={corpus}
            segmento={negocio.segmento}
            cidade={negocio.cidade}
            mostrarCabecalho={true}
          />
        </div>
      )}

      {/* BLOCO 3: Quem apareceu no seu lugar (Top 5 Concorrentes) */}
      {visibilidade && visibilidade.concorrentes && visibilidade.concorrentes.length > 0 && (
        <ListaConcorrentes
          concorrentes={visibilidade.concorrentes}
          totalExecucoes={totalExec}
        />
      )}

      {/* BLOCO 4: Índice */}
      {indice !== null && <Indice indice={indice} />}

      {/* BLOCO 5: Auditoria do site (se não subiu como bloco crítico) */}
      {!temTetoBloqueio && (
        <AuditoriaSite
          siteResultado={site_resultado}
          siteUrl={negocio.site}
          carregandoParcial={carregandoParcialSite}
        />
      )}

      {/* BLOCO 6: Onde a IA foi buscar (Domínios do Nicho) */}
      {visibilidade && visibilidade.dominios_do_nicho && visibilidade.dominios_do_nicho.length > 0 && (
        <DominiosDoNicho dominios={visibilidade.dominios_do_nicho} />
      )}

      {/* BLOCO 7: 3 Recomendações Prioritárias */}
      {laudo && laudo.recomendacoes && (
        <div ref={recomendacoesRef}>
          <Recomendacao recomendacoes={laudo.recomendacoes} />
        </div>
      )}

      {/* BLOCO 8: CTA de Captura */}
      {laudo && laudo.cta && (
        <Captura
          auditoriaId={auditoria.auditoria_id}
          cta={laudo.cta}
          aoEnviarLead={aoEnviarLead}
          enviando={enviandoLead}
          sucesso={sucessoLead}
        />
      )}

      {/* Ação secundária para nova consulta */}
      {aoNovaConsulta && (
        <div style={{ marginTop: "var(--s6)", textAlign: "center" }}>
          <button
            type="button"
            className="botao-secundario"
            onClick={aoNovaConsulta}
            style={{ padding: "10px 20px" }}
          >
            Fazer Nova Auditoria
          </button>
        </div>
      )}
    </div>
  );
};
