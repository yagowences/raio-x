import React from "react";
import { PerguntaResultado } from "../api/tipos";
import { Etiqueta } from "./Etiqueta";

export interface BandaProps {
  id?: string;
  pergunta: PerguntaResultado;
  totalExecucoes: number;
  revelada: boolean;
  indiceBanda?: number;
}

export const Banda: React.FC<BandaProps> = ({
  id,
  pergunta,
  revelada,
  indiceBanda = 1,
}) => {
  const { execucoes, mencoes, incertas, texto, fontes } = pergunta;

  // Cálculo da porcentagem de preenchimento e opacidade
  const proporcao = execucoes > 0 ? mencoes / execucoes : 0;
  const porcentagemCheia = Math.min(100, Math.max(0, proporcao * 100));

  let corPreenchimento = "var(--chapa-vazia)";
  if (proporcao >= 1) {
    corPreenchimento = "var(--chapa-cheia)";
  } else if (proporcao >= 0.6) {
    corPreenchimento = "rgba(0, 166, 230, 0.70)";
  } else if (proporcao > 0) {
    corPreenchimento = "rgba(0, 166, 230, 0.45)";
  }

  const porcentagemIncertas = execucoes > 0 ? (incertas / execucoes) * 100 : 0;

  return (
    <div
      id={id || `banda-${pergunta.id}`}
      style={{
        marginBottom: "var(--s4)",
        opacity: revelada ? 1 : 0.15,
        transition: "opacity 0.25s ease",
      }}
    >
      {/* Barra de Frequência da Chapa */}
      <div
        style={{
          height: "28px",
          width: "100%",
          backgroundColor: "var(--chapa-vazia)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
        }}
      >
        {/* Parte preenchida de menção */}
        {porcentagemCheia > 0 && (
          <div
            style={{
              width: `${porcentagemCheia}%`,
              height: "100%",
              backgroundColor: corPreenchimento,
              transition: "width 0.3s ease-out",
            }}
          />
        )}

        {/* Faixa hachurada para incertas se houver */}
        {porcentagemIncertas > 0 && (
          <div
            style={{
              width: `${porcentagemIncertas}%`,
              height: "100%",
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 6px, transparent 6px, transparent 12px)",
              borderLeft: "1px solid rgba(255,255,255,0.2)",
            }}
          />
        )}
      </div>

      {/* Conteúdo textual da banda */}
      <div
        style={{
          marginTop: "var(--s2)",
          paddingLeft: "var(--s1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "var(--s2)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              fontWeight: "var(--peso-titulo)",
              color: "rgba(255, 255, 255, 0.6)",
              fontFamily: "var(--mono)",
            }}
          >
            p{indiceBanda}
          </span>
          <span
            className="prompt-literal"
            style={{
              color: "#FFFFFF",
            }}
          >
            "{texto}"
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s3)",
            marginTop: "var(--s1)",
            fontSize: "13px",
            color: "rgba(255, 255, 255, 0.85)",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: "var(--peso-corpo)" }}>
            citado em <strong>{mencoes}</strong> de <strong>{execucoes}</strong> execuções
          </span>

          {incertas > 0 && (
            <span
              style={{
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.65)",
                fontFamily: "var(--mono)",
              }}
            >
              ({incertas === 1 ? "1 execução ficou inconclusiva" : `${incertas} execuções ficaram inconclusivas`})
            </span>
          )}

          {fontes && fontes.length > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s1)",
                marginLeft: "auto",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255, 255, 255, 0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                fontes:
              </span>
              {fontes.map((f, i) => (
                <Etiqueta key={i} texto={f} variante="chapa" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
