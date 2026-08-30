import React from "react";

interface MetricaProps {
  id?: string;
  rotulo: string;
  valor: string | number;
  subtexto?: string;
  destaque?: boolean;
}

export const Metrica: React.FC<MetricaProps> = ({
  id,
  rotulo,
  valor,
  subtexto,
  destaque = false,
}) => {
  return (
    <div
      id={id}
      style={{
        border: "1px solid var(--borda-suave)",
        borderRadius: "var(--radius)",
        padding: "var(--s3)",
        backgroundColor: destaque ? "rgba(11, 31, 58, 0.03)" : "var(--branco)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <span className="eyebrow" style={{ color: "var(--grafite)", marginBottom: "var(--s1)" }}>
        {rotulo}
      </span>
      <div
        style={{
          fontSize: "24px",
          fontWeight: "var(--peso-wordmark)",
          color: "var(--azul-profundo)",
          lineHeight: "1.1",
        }}
      >
        {valor}
      </div>
      {subtexto && (
        <span
          className="corpo-pequeno"
          style={{
            marginTop: "var(--s1)",
            color: "var(--grafite)",
            fontSize: "12px",
          }}
        >
          {subtexto}
        </span>
      )}
    </div>
  );
};
