import React from "react";

interface EtiquetaProps {
  id?: string;
  texto: string;
  variante?: "padrao" | "chapa" | "destaque" | "bloqueado" | "permitido";
}

export const Etiqueta: React.FC<EtiquetaProps> = ({ id, texto, variante = "padrao" }) => {
  let estilo: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: "var(--radius)",
    fontSize: "11px",
    fontWeight: "var(--peso-titulo)",
    whiteSpace: "nowrap",
    lineHeight: "1.2",
    letterSpacing: "0.02em",
  };

  if (variante === "chapa") {
    estilo = {
      ...estilo,
      backgroundColor: "var(--chapa-vazia)",
      color: "#FFFFFF",
      border: "1px solid rgba(255, 255, 255, 0.15)",
    };
  } else if (variante === "destaque") {
    estilo = {
      ...estilo,
      backgroundColor: "var(--azul-profundo)",
      color: "#FFFFFF",
    };
  } else if (variante === "bloqueado") {
    estilo = {
      ...estilo,
      backgroundColor: "var(--azul-profundo)",
      color: "#FFFFFF",
      fontWeight: "var(--peso-wordmark)",
    };
  } else if (variante === "permitido") {
    estilo = {
      ...estilo,
      backgroundColor: "transparent",
      color: "var(--grafite)",
      border: "1px solid var(--borda-suave)",
    };
  } else {
    estilo = {
      ...estilo,
      backgroundColor: "#EEF2F6",
      color: "var(--azul-profundo)",
      border: "1px solid var(--borda-suave)",
    };
  }

  return (
    <span id={id} style={estilo}>
      {texto}
    </span>
  );
};
