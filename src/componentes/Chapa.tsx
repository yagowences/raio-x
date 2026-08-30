import React from "react";
import { Corpus, Visibilidade } from "../api/tipos";
import { Banda } from "./Banda";

interface ChapaProps {
  id?: string;
  visibilidade: Visibilidade;
  corpus: Corpus;
  segmento: string;
  cidade: string;
  bandasReveladas?: number; // Para controle da coreografia na tela de Análise vs Resultado (onde tudo é revelado)
  mostrarCabecalho?: boolean;
}

export function formatarDataVarredura(isoString?: string): string {
  if (!isoString) return "varredura recente";
  try {
    const data = new Date(isoString);
    const mes = data.toLocaleDateString("pt-BR", { month: "long" });
    const ano = data.getFullYear();
    return `varredura de ${mes} de ${ano}`;
  } catch {
    return "varredura de agosto de 2026";
  }
}

export const Chapa: React.FC<ChapaProps> = ({
  id = "chapa-radiografica",
  visibilidade,
  corpus,
  segmento,
  cidade,
  bandasReveladas,
  mostrarCabecalho = true,
}) => {
  const totalExec = corpus.total_execucoes ?? 15;
  const numPerguntas = visibilidade.perguntas.length;
  const mencoesTotais = visibilidade.mencoes;
  const reveladas = bandasReveladas !== undefined ? bandasReveladas : numPerguntas;

  // Texto para leitor de tela (A11y)
  const textoA11y = `${numPerguntas} perguntas, citado em ${mencoesTotais} de ${totalExec} execuções`;

  return (
    <section
      id={id}
      className="chapa-radiografica"
      role="img"
      aria-label={textoA11y}
      style={{
        backgroundColor: "var(--chapa-fundo)",
        borderRadius: "var(--radius)",
        padding: "var(--s4)",
      }}
    >
      {mostrarCabecalho && (
        <div
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
            paddingBottom: "var(--s3)",
            marginBottom: "var(--s4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--s2)",
          }}
        >
          <div
            className="eyebrow"
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              letterSpacing: "0.14em",
            }}
          >
            {formatarDataVarredura(corpus.gerado_em).toUpperCase()} · {segmento.toUpperCase()} · {cidade.toUpperCase()}
          </div>

          <div
            style={{
              fontSize: "12px",
              fontFamily: "var(--mono)",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            {mencoesTotais}/{totalExec} menções
          </div>
        </div>
      )}

      {/* Lista de Bandas da Chapa */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {visibilidade.perguntas.map((pergunta, idx) => (
          <Banda
            key={pergunta.id}
            indiceBanda={idx + 1}
            pergunta={pergunta}
            totalExecucoes={totalExec}
            revelada={idx < reveladas}
          />
        ))}
      </div>
    </section>
  );
};
