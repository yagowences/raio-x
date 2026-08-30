import React, { useEffect, useState } from "react";
import { Auditoria } from "../api/tipos";
import { Chapa, formatarDataVarredura } from "../componentes/Chapa";

interface AnaliseProps {
  auditoria: Auditoria;
  aoConcluirAnimacao: () => void;
}

export const Analise: React.FC<AnaliseProps> = ({ auditoria, aoConcluirAnimacao }) => {
  const [bandasReveladas, setBandasReveladas] = useState(0);
  const totalPerguntas = auditoria.visibilidade?.perguntas.length || 5;

  useEffect(() => {
    // Acessibilidade: prefers-reduced-motion desliga a coreografia
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setBandasReveladas(totalPerguntas);
      const timer = setTimeout(() => {
        aoConcluirAnimacao();
      }, 500);
      return () => clearTimeout(timer);
    }

    let atual = 0;
    const intervalo = setInterval(() => {
      atual += 1;
      setBandasReveladas(atual);
      if (atual >= totalPerguntas) {
        clearInterval(intervalo);
        setTimeout(() => {
          aoConcluirAnimacao();
        }, 600);
      }
    }, 420);

    return () => clearInterval(intervalo);
  }, [totalPerguntas, aoConcluirAnimacao]);

  const { negocio, corpus, visibilidade } = auditoria;
  const totalExec = corpus.total_execucoes ?? 15;

  return (
    <div id="tela-analise" className="bloco-painel" style={{ padding: "var(--s4)" }}>
      <div style={{ marginBottom: "var(--s4)" }}>
        <span className="eyebrow">
          Lendo nossa {formatarDataVarredura(corpus.gerado_em)} para {negocio.segmento} em {negocio.cidade}
        </span>
        <h1 className="titulo-secao" style={{ marginTop: "var(--s1)" }}>
          {totalExec} execuções reais de varredura no nicho
        </h1>
        <p className="corpo-pequeno" style={{ marginTop: "var(--s1)", color: "var(--grafite)" }}>
          Resultado da última varredura · atualizada mensalmente · motores avaliados: {corpus.motores?.join(", ") || "gemini"}
        </p>
      </div>

      {visibilidade && (
        <Chapa
          id="chapa-analise"
          visibilidade={visibilidade}
          corpus={corpus}
          segmento={negocio.segmento}
          cidade={negocio.cidade}
          bandasReveladas={bandasReveladas}
          mostrarCabecalho={true}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "var(--s3)",
          fontSize: "12px",
          color: "var(--grafite)",
        }}
      >
        <span>
          Processando pergunta <strong>{Math.min(bandasReveladas, totalPerguntas)}</strong> de <strong>{totalPerguntas}</strong>
        </span>
        <span style={{ fontFamily: "var(--mono)" }}>
          {corpus.execucoes_por_pergunta ?? 3} execuções por pergunta
        </span>
      </div>
    </div>
  );
};
