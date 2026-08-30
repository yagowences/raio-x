import React from "react";
import { LaudoResultado } from "../api/tipos";
import { Etiqueta } from "./Etiqueta";

interface RecomendacaoProps {
  id?: string;
  recomendacoes: LaudoResultado["recomendacoes"];
}

export const Recomendacao: React.FC<RecomendacaoProps> = ({
  id = "bloco-recomendacoes",
  recomendacoes,
}) => {
  if (!recomendacoes || recomendacoes.length === 0) return null;

  return (
    <div id={id} className="bloco-painel">
      <div style={{ marginBottom: "var(--s3)" }}>
        <span className="eyebrow">Plano de Ação</span>
        <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
          Recomendações Prioritárias
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
        {recomendacoes.map((rec, idx) => {
          return (
            <div
              key={idx}
              style={{
                border: "1px solid var(--borda-suave)",
                borderRadius: "var(--radius)",
                padding: "var(--s3)",
                backgroundColor: "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--s1)",
                  flexWrap: "wrap",
                  gap: "var(--s1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "11px",
                      fontWeight: "var(--peso-wordmark)",
                      color: "var(--azul-profundo)",
                      backgroundColor: "rgba(11, 31, 58, 0.08)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    PRIORIDADE {rec.prioridade}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "var(--peso-titulo)",
                      color: "var(--azul-profundo)",
                    }}
                  >
                    {rec.titulo}
                  </span>
                </div>

                <Etiqueta texto={rec.pilar} variante="permitido" />
              </div>

              <p className="corpo-texto" style={{ fontSize: "13px", marginBottom: "var(--s2)" }}>
                {rec.texto}
              </p>

              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--mono)",
                  color: "var(--grafite)",
                  backgroundColor: "#F8FAFC",
                  padding: "4px 8px",
                  borderRadius: "var(--radius)",
                  display: "inline-block",
                }}
              >
                Dado de auditoria: <strong>{rec.dado}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
