import React from "react";
import { SiteResultado } from "../api/tipos";
import { Etiqueta } from "./Etiqueta";

interface AuditoriaSiteProps {
  id?: string;
  siteResultado: SiteResultado | null;
  siteUrl?: string | null;
  carregandoParcial?: boolean;
}

export const AuditoriaSite: React.FC<AuditoriaSiteProps> = ({
  id = "bloco-auditoria-site",
  siteResultado,
  siteUrl,
  carregandoParcial = false,
}) => {
  // Caso 1: Sem site informado
  if (!siteUrl) {
    return (
      <div id={id} className="bloco-painel">
        <div style={{ marginBottom: "var(--s2)" }}>
          <span className="eyebrow">Auditoria Técnica</span>
          <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
            Auditoria do Site
          </h2>
        </div>
        <p className="corpo-texto" style={{ marginBottom: "var(--s3)" }}>
          Você não informou o site do seu negócio. Sem o site, avaliamos apenas as citações e a visibilidade em diretórios.
        </p>
        <div
          style={{
            padding: "12px",
            backgroundColor: "rgba(11, 31, 58, 0.04)",
            border: "1px solid var(--borda-suave)",
            borderRadius: "var(--radius)",
            fontSize: "13px",
            fontWeight: "var(--peso-titulo)",
            color: "var(--azul-profundo)",
          }}
        >
          Informe seu site para receber o índice técnico completo, auditoria de robots.txt, schema.org e consistência NAP.
        </div>
      </div>
    );
  }

  // Caso 2: Em carregamento parcial
  if (carregandoParcial || !siteResultado) {
    return (
      <div id={id} className="bloco-painel">
        <div style={{ marginBottom: "var(--s3)" }}>
          <span className="eyebrow">Auditoria Técnica</span>
          <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
            Analisando infraestrutura técnica e robots.txt...
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
          <div style={{ height: "24px", backgroundColor: "#E2E8F0", borderRadius: "var(--radius)" }} />
          <div style={{ height: "24px", backgroundColor: "#EDF2F7", borderRadius: "var(--radius)" }} />
          <div style={{ height: "24px", backgroundColor: "#F7FAFC", borderRadius: "var(--radius)" }} />
        </div>
      </div>
    );
  }

  // Caso 3: Site não avaliado por inacessibilidade / timeout / erro (é um achado, não erro de tela)
  if (!siteResultado.avaliado) {
    return (
      <div id={id} className="bloco-painel">
        <div style={{ marginBottom: "var(--s2)" }}>
          <span className="eyebrow">Auditoria Técnica</span>
          <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
            Site Inacessível para Rastreadores
          </h2>
        </div>
        <p className="corpo-texto" style={{ marginBottom: "var(--s2)" }}>
          O site informado (<code>{siteUrl}</code>) não pôde ser auditado.
        </p>
        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "rgba(11, 31, 58, 0.05)",
            border: "1px solid var(--azul-profundo)",
            borderRadius: "var(--radius)",
            fontSize: "13px",
            fontWeight: "var(--peso-titulo)",
            color: "var(--azul-profundo)",
          }}
        >
          Motivo detectado: {siteResultado.motivo || "inacessivel"}. Os robôs de IA não conseguem carregar a página inicial.
        </div>
      </div>
    );
  }

  const { tecnica, estrutura, dados_estruturados, nap } = siteResultado;

  return (
    <div id={id} className="bloco-painel">
      <div style={{ marginBottom: "var(--s4)" }}>
        <span className="eyebrow">Auditoria Técnica do Site</span>
        <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
          Leitura de Infraestrutura e Dados Estruturados
        </h2>
        {siteResultado.url_final && (
          <div style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--grafite)", marginTop: "2px" }}>
            URL auditada: {siteResultado.url_final}
          </div>
        )}
      </div>

      {/* Grid de Seções Técnicas */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
        {/* 1. Rastreadores e Acesso HTTP */}
        {tecnica && (
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: "var(--peso-titulo)", marginBottom: "var(--s2)", color: "var(--azul-profundo)" }}>
              1. Acesso dos Rastreadores de IA
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--s2)" }}>
              {tecnica.acesso?.map((bot, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid var(--borda-suave)",
                    borderRadius: "var(--radius)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: "12px", fontWeight: "var(--peso-titulo)" }}>
                    {bot.ua}
                  </span>
                  <Etiqueta
                    texto={bot.bloqueado ? `HTTP ${bot.status} (bloqueado)` : `HTTP ${bot.status} (liberado)`}
                    variante={bot.bloqueado ? "bloqueado" : "permitido"}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                gap: "var(--s4)",
                marginTop: "var(--s2)",
                fontSize: "12px",
                color: "var(--grafite)",
                flexWrap: "wrap",
              }}
            >
              <span>
                Sitemap XML: <strong>{tecnica.sitemap.existe ? `Sim (${tecnica.sitemap.urls} URLs)` : "Não encontrado"}</strong>
              </span>
              <span>
                HTML Estático: <strong>{tecnica.html_estatico.chars_bruto.toLocaleString("pt-BR")} caracteres</strong>
                {tecnica.html_estatico.suspeita_spa && " (suspeita de SPA / JS dependente)"}
              </span>
              {tecnica.psi_mobile !== null && (
                <span>
                  PSI Mobile: <strong>{tecnica.psi_mobile}/100</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* 2. Estrutura Semântica */}
        {estrutura && (
          <div style={{ borderTop: "1px solid var(--borda-suave)", paddingTop: "var(--s3)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "var(--peso-titulo)", marginBottom: "var(--s2)", color: "var(--azul-profundo)" }}>
              2. Estrutura e Hierarquia de Conteúdo
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--s2)" }}>
              <div style={{ padding: "8px", border: "1px solid var(--borda-suave)", borderRadius: "var(--radius)" }}>
                <span className="eyebrow" style={{ fontSize: "10px" }}>Títulos H1</span>
                <div style={{ fontWeight: "var(--peso-wordmark)", fontSize: "18px", color: "var(--azul-profundo)" }}>{estrutura.h1}</div>
              </div>
              <div style={{ padding: "8px", border: "1px solid var(--borda-suave)", borderRadius: "var(--radius)" }}>
                <span className="eyebrow" style={{ fontSize: "10px" }}>Títulos H2 / H3</span>
                <div style={{ fontWeight: "var(--peso-wordmark)", fontSize: "18px", color: "var(--azul-profundo)" }}>{estrutura.h2} / {estrutura.h3}</div>
              </div>
              <div style={{ padding: "8px", border: "1px solid var(--borda-suave)", borderRadius: "var(--radius)" }}>
                <span className="eyebrow" style={{ fontSize: "10px" }}>Imagens com ALT</span>
                <div style={{ fontWeight: "var(--peso-wordmark)", fontSize: "18px", color: "var(--azul-profundo)" }}>{estrutura.imagens_com_alt}/{estrutura.imagens}</div>
              </div>
              <div style={{ padding: "8px", border: "1px solid var(--borda-suave)", borderRadius: "var(--radius)" }}>
                <span className="eyebrow" style={{ fontSize: "10px" }}>Salto de Nível</span>
                <div style={{ fontWeight: "var(--peso-titulo)", fontSize: "13px", color: "var(--azul-profundo)", marginTop: "4px" }}>
                  {estrutura.salto_de_nivel ? "Sim (irregular)" : "Não (correto)"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Dados Estruturados (Schema.org) */}
        {dados_estruturados && (
          <div style={{ borderTop: "1px solid var(--borda-suave)", paddingTop: "var(--s3)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "var(--peso-titulo)", marginBottom: "var(--s2)", color: "var(--azul-profundo)" }}>
              3. Dados Estruturados (Schema.org)
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)", marginBottom: "var(--s2)" }}>
              <Etiqueta
                texto={dados_estruturados.presente ? "Schema JSON-LD Detectado" : "Nenhum Schema Detectado"}
                variante={dados_estruturados.presente ? "destaque" : "bloqueado"}
              />
              {dados_estruturados.tipos.length > 0 && (
                <span style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--grafite)" }}>
                  Tipos: {dados_estruturados.tipos.join(", ")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 4. Consistência Local (NAP) */}
        {nap && (
          <div style={{ borderTop: "1px solid var(--borda-suave)", paddingTop: "var(--s3)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "var(--peso-titulo)", marginBottom: "var(--s2)", color: "var(--azul-profundo)" }}>
              4. Consistência Local (Nome, Endereço, Telefone)
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--s2)", fontSize: "12px" }}>
              <div>Nome no site: <strong>{nap.nome ? "Sim" : "Não"}</strong></div>
              <div>Telefone rastreável: <strong>{nap.telefone ? nap.telefone : "Não localizado"}</strong></div>
              <div>Endereço completo: <strong>{nap.endereco ? "Sim" : "Não"}</strong></div>
              <div>Horário de funcionamento: <strong>{nap.horario ? "Sim" : "Não"}</strong></div>
              <div>Página do autor / responsável: <strong>{nap.pagina_autor ? "Sim" : "Não"}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
