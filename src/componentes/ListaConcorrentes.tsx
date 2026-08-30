import React from "react";
import { Concorrente } from "../api/tipos";

interface ListaConcorrentesProps {
  id?: string;
  concorrentes: Concorrente[];
  totalExecucoes: number;
}

export const ListaConcorrentes: React.FC<ListaConcorrentesProps> = ({
  id = "bloco-concorrentes",
  concorrentes,
  totalExecucoes,
}) => {
  if (!concorrentes || concorrentes.length === 0) return null;

  return (
    <div id={id} className="bloco-painel">
      <div style={{ marginBottom: "var(--s3)" }}>
        <span className="eyebrow">Concorrência Detectada</span>
        <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
          Quem apareceu no seu lugar nas respostas
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
        {concorrentes.slice(0, 5).map((conc, idx) => {
          const porcentagem = totalExecucoes > 0 ? (conc.mencoes / totalExecucoes) * 100 : 0;
          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                border: "1px solid var(--borda-suave)",
                borderRadius: "var(--radius)",
                backgroundColor: "#FFFFFF",
                flexWrap: "wrap",
                gap: "var(--s2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s2)" }}>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "12px",
                    fontWeight: "var(--peso-titulo)",
                    color: "var(--azul-profundo)",
                    width: "20px",
                  }}
                >
                  #{idx + 1}
                </span>
                <span style={{ fontWeight: "var(--peso-titulo)", color: "var(--azul-profundo)" }}>
                  {conc.nome}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "var(--s4)" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: "var(--peso-titulo)", fontSize: "13px", color: "var(--azul-profundo)" }}>
                    {conc.mencoes} menções ({Math.round(porcentagem)}%)
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--grafite)" }}>
                    Posição média: #{conc.posicao_media.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
