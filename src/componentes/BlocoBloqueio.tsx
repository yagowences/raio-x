import React from "react";
import { SiteResultado, Indice } from "../api/tipos";
import { bloqueioCritico } from "../dominio/bloqueio";

interface BlocoBloqueioProps {
  id?: string;
  siteResultado: SiteResultado;
  indice: Indice;
}

// Só descreve o que foi medido: robô, status e origem vêm de site_resultado.
// Sem bloqueio crítico medido, o bloco não aparece — nunca um "HTTP 403" de enfeite.
export const BlocoBloqueio: React.FC<BlocoBloqueioProps> = ({
  id = "bloco-bloqueio-critico",
  siteResultado,
  indice,
}) => {
  const bloqueio = bloqueioCritico(siteResultado);
  if (!bloqueio) return null;

  const titulo =
    bloqueio.via === "http"
      ? `${bloqueio.ua} recebeu HTTP ${bloqueio.status} em seu site`
      : `Seu robots.txt proíbe o ${bloqueio.ua} de ler o site`;
  const explicacao =
    bloqueio.via === "http"
      ? "Seu robots.txt está liberado. O bloqueio vem do firewall ou de um plugin de segurança do servidor."
      : "A regra está no próprio arquivo robots.txt. É uma linha de texto, e removê-la libera o acesso.";

  return (
    <div
      id={id}
      className="bloco-alerta-critico"
      style={{
        border: "2px solid var(--azul-profundo)",
        backgroundColor: "#FFFFFF",
        padding: "var(--s4)",
        marginBottom: "var(--s4)",
        borderRadius: "var(--radius)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--s3)" }}>
        <div
          style={{
            fontSize: "20px",
            lineHeight: "1",
            marginTop: "2px",
          }}
          aria-hidden="true"
        >
          ⛔
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "var(--peso-wordmark)",
              color: "var(--azul-profundo)",
              marginBottom: "var(--s1)",
            }}
          >
            {titulo}
          </div>

          <p className="corpo-texto" style={{ marginBottom: "var(--s2)" }}>
            {explicacao}
          </p>

          {indice.teto_aplicado !== null && (
            <div
              style={{
                display: "inline-block",
                padding: "4px 8px",
                backgroundColor: "rgba(11, 31, 58, 0.06)",
                borderRadius: "var(--radius)",
                fontSize: "12px",
                fontWeight: "var(--peso-titulo)",
                color: "var(--azul-profundo)",
              }}
            >
              Índice limitado a {indice.teto_aplicado} por causa disto
              {indice.motivo_teto ? ` (${indice.motivo_teto})` : ""}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
