import React from "react";
import { Dominio } from "../api/tipos";
import { Etiqueta } from "./Etiqueta";

interface DominiosDoNichoProps {
  id?: string;
  dominios: Dominio[];
}

export const DominiosDoNicho: React.FC<DominiosDoNichoProps> = ({
  id = "bloco-dominios-nicho",
  dominios,
}) => {
  if (!dominios || dominios.length === 0) return null;

  return (
    <div id={id} className="bloco-painel">
      <div style={{ marginBottom: "var(--s3)" }}>
        <span className="eyebrow">Fontes de Referência</span>
        <h2 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
          Onde a IA foi buscar informações do seu nicho
        </h2>
        <p className="corpo-pequeno" style={{ marginTop: "var(--s1)" }}>
          Estes foram os portais e diretórios mais consultados durante a varredura para montar as respostas.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)" }}>
        {dominios.map((dom, idx) => {
          let statusTexto = "não verificamos";
          let statusVariante: "padrao" | "chapa" | "destaque" | "bloqueado" | "permitido" = "padrao";

          if (dom.cliente_presente === true) {
            statusTexto = "presente";
            statusVariante = "destaque";
          } else if (dom.cliente_presente === false) {
            statusTexto = "ausente";
            statusVariante = "bloqueado";
          } else {
            statusTexto = "não verificamos";
            statusVariante = "permitido";
          }

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
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
                    fontSize: "13px",
                    fontWeight: "var(--peso-titulo)",
                    color: "var(--azul-profundo)",
                  }}
                >
                  {dom.dominio}
                </span>
                <span style={{ fontSize: "12px", color: "var(--grafite)" }}>
                  ({dom.frequencia} {dom.frequencia === 1 ? "consulta" : "consultas"})
                </span>
              </div>

              <div>
                <Etiqueta texto={statusTexto} variante={statusVariante} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
