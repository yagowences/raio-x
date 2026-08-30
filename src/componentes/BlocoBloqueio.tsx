import React from "react";
import { SiteResultado, Indice } from "../api/tipos";

interface BlocoBloqueioProps {
  id?: string;
  siteResultado: SiteResultado;
  indice: Indice;
}

export const BlocoBloqueio: React.FC<BlocoBloqueioProps> = ({
  id = "bloco-bloqueio-critico",
  siteResultado,
  indice,
}) => {
  const botsBloqueados = siteResultado.tecnica?.acesso?.filter((a) => a.bloqueado) || [];
  const primeiroBloqueio = botsBloqueados[0];
  const nomeBot = primeiroBloqueio ? primeiroBloqueio.ua : "Rastreador de IA";
  const statusCode = primeiroBloqueio ? primeiroBloqueio.status : 403;

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
            {nomeBot} recebeu HTTP {statusCode} em seu site
          </div>

          <p className="corpo-texto" style={{ marginBottom: "var(--s2)" }}>
            Seu robots.txt está liberado. O bloqueio vem do firewall ou de um plugin de segurança do servidor.
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
              Índice limitado a {indice.teto_aplicado} por causa disto ({indice.motivo_teto || "bloqueio técnico"}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
