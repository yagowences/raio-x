import React from "react";

/**
 * Marca da Intellectus Digital. Recriada em SVG a partir da arte enviada
 * (ícone "i" com anel/ponto em ciano + haste em azul-profundo, wordmark
 * INTELLECTUS + DIGITAL) — vetor, não bitmap, porque o resto do produto é
 * "chapado" sem sombra e precisa ficar nítido em qualquer resolução.
 *
 * `tom="claro"` é para fundo claro (uso normal no app, que é off-white/branco).
 * `tom="escuro"` é para fundo azul-profundo (ex.: dentro da chapa radiográfica).
 */
interface LogoIconeProps {
  tom?: "claro" | "escuro";
  tamanho?: number;
  className?: string;
}

export const LogoIcone: React.FC<LogoIconeProps> = ({ tom = "claro", tamanho = 28, className }) => {
  const corAnel = "var(--ciano)";
  const corHaste = tom === "claro" ? "var(--azul-profundo)" : "#FFFFFF";

  return (
    <svg
      className={className}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 64 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Símbolo Intellectus Digital"
    >
      <circle cx="32" cy="24" r="16" stroke={corAnel} strokeWidth="8" />
      <circle cx="32" cy="24" r="5.5" fill={corAnel} />
      <rect x="23" y="52" width="18" height="48" fill={corHaste} />
    </svg>
  );
};

interface LogoProps {
  tom?: "claro" | "escuro";
  tamanho?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Lockup horizontal: ícone + "INTELLECTUS" + "DIGITAL". Uso em cabeçalho e rodapé. */
export const Logo: React.FC<LogoProps> = ({ tom = "claro", tamanho = 26, className, style }) => {
  const corTexto = tom === "claro" ? "var(--azul-profundo)" : "#FFFFFF";

  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "center", gap: "8px", ...style }}
    >
      <LogoIcone tom={tom} tamanho={tamanho} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          style={{
            fontWeight: "var(--peso-wordmark)",
            fontSize: `${Math.round(tamanho * 0.46)}px`,
            letterSpacing: "0.04em",
            color: corTexto,
          }}
        >
          INTELLECTUS
        </span>
        <span
          style={{
            fontWeight: "var(--peso-titulo)",
            fontSize: `${Math.round(tamanho * 0.32)}px`,
            letterSpacing: "0.14em",
            color: "var(--ciano)",
            marginTop: "2px",
          }}
        >
          DIGITAL
        </span>
      </div>
    </div>
  );
};
