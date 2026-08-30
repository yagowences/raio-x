import React from "react";
import { Indice as IndiceTipo } from "../api/tipos";
import { Etiqueta } from "./Etiqueta";

interface IndiceProps {
  id?: string;
  indice: IndiceTipo;
}

export const Indice: React.FC<IndiceProps> = ({ id = "bloco-indice", indice }) => {
  return (
    <div id={id} className="bloco-painel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid var(--borda-suave)",
          paddingBottom: "var(--s3)",
          marginBottom: "var(--s3)",
          flexWrap: "wrap",
          gap: "var(--s2)",
        }}
      >
        <div>
          <span className="eyebrow">Pontuação Geral</span>
          <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
            Índice de Prontidão para IA
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--s1)" }}>
          <span
            style={{
              fontSize: "36px",
              fontWeight: "var(--peso-wordmark)",
              color: "var(--azul-profundo)",
              lineHeight: "1",
            }}
          >
            {indice.valor}
          </span>
          <span style={{ fontSize: "14px", color: "var(--grafite)", fontWeight: "var(--peso-titulo)" }}>
            /100
          </span>
        </div>
      </div>

      {indice.teto_aplicado !== null && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "rgba(11, 31, 58, 0.05)",
            border: "1px solid var(--azul-profundo)",
            borderRadius: "var(--radius)",
            fontSize: "12px",
            fontWeight: "var(--peso-titulo)",
            color: "var(--azul-profundo)",
            marginBottom: "var(--s3)",
          }}
        >
          Teto de nota aplicado: {indice.teto_aplicado} ({indice.motivo_teto})
        </div>
      )}

      {/* Pilares do Índice */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
        {indice.pilares.map((pilar) => {
          return (
            <div key={pilar.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
                  <span style={{ fontWeight: "var(--peso-titulo)", color: "var(--azul-profundo)" }}>
                    {pilar.rotulo}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--grafite)" }}>
                    (peso {Math.round(pilar.peso * 100)}%)
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
                  <span style={{ fontWeight: "var(--peso-wordmark)", color: "var(--azul-profundo)" }}>
                    {pilar.nota}/100
                  </span>
                  <Etiqueta
                    texto={`confiança ${pilar.confianca}`}
                    variante={pilar.confianca === "alta" ? "padrao" : "permitido"}
                  />
                </div>
              </div>

              {/* Barra de Progresso Chapada */}
              <div
                style={{
                  height: "8px",
                  backgroundColor: "#E2E8F0",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.max(0, pilar.nota))}%`,
                    backgroundColor: "var(--azul-profundo)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
