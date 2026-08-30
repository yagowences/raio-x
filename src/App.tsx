import React, { useState, useEffect, useCallback, useRef } from "react";
import { Auditoria, EntradaFormulario, EntradaLead } from "./api/tipos";
import { api } from "./api/client";
import { obterFixturePorCenario, CenarioKey, detectarCenarioURL } from "./api/mock";
import { Formulario } from "./telas/Formulario";
import { Analise } from "./telas/Analise";
import { Resultado } from "./telas/Resultado";
import { Fila } from "./telas/Fila";
import { track } from "./analytics";

export default function App() {
  const [tela, setTela] = useState<"formulario" | "analise" | "resultado" | "fila" | "rate_limit">("formulario");
  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [enviandoFormulario, setEnviandoFormulario] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [ultimoFormulario, setUltimoFormulario] = useState<EntradaFormulario | null>(null);
  const [enviandoLead, setEnviandoLead] = useState(false);
  const [sucessoLead, setSucessoLead] = useState(false);
  const [cenarioForcado, setCenarioForcado] = useState<string>("url_ou_sorteio");
  const [consultasHoje, setConsultasHoje] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTentativasRef = useRef(0);

  // Limpeza de timers de polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Iniciar Polling de Consulta (§1 e §8: polling a cada 1200ms até concluir ou 20 tentativas)
  const iniciarPolling = useCallback((auditoriaId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingTentativasRef.current = 0;

    pollingIntervalRef.current = setInterval(async () => {
      pollingTentativasRef.current += 1;

      try {
        const atualizada = await api.consultar(auditoriaId);
        setAuditoria(atualizada);

        if (atualizada.status === "concluido" || atualizada.status === "na_fila" || pollingTentativasRef.current >= 20) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
        }
      } catch (err) {
        console.error("Erro no polling da auditoria", err);
      }
    }, 1200);
  }, []);

  // Submissão do Formulário
  const handleIniciarAuditoria = async (dados: EntradaFormulario) => {
    setUltimoFormulario(dados);
    setErroEnvio(null);

    // Simulação de Rate Limit (§8: limite de 3 consultas por dia)
    if (consultasHoje >= 3 || cenarioForcado === "rate_limit") {
      track("raiox_rate_limit");
      setTela("rate_limit");
      return;
    }

    setEnviandoFormulario(true);

    try {
      let resultado: Auditoria;

      if (cenarioForcado !== "url_ou_sorteio" && cenarioForcado !== "rate_limit") {
        resultado = obterFixturePorCenario(cenarioForcado as CenarioKey);
        resultado.negocio.nome = dados.negocio;
        resultado.negocio.segmento = dados.segmento;
        resultado.negocio.cidade = dados.cidade;
        resultado.negocio.site = dados.site || (cenarioForcado === "sem-site" ? null : resultado.negocio.site);
        resultado.auditoria_id = `aud_${Date.now()}`;
      } else {
        resultado = await api.iniciar(dados);
      }

      setAuditoria(resultado);
      setConsultasHoje((prev) => prev + 1);
      setSucessoLead(false);

      if (resultado.status === "na_fila") {
        setTela("fila");
      } else {
        setTela("analise");
        iniciarPolling(resultado.auditoria_id);
      }
    } catch (err) {
      setErroEnvio("Não foi possível conectar aos dados de auditoria. Suas informações foram mantidas.");
      console.error(err);
    } finally {
      setEnviandoFormulario(false);
    }
  };

  // Callback de conclusão da animação da chapa
  const handleConcluirAnimacao = () => {
    if (auditoria && auditoria.status === "na_fila") {
      setTela("fila");
    } else {
      setTela("resultado");
    }
  };

  // Envio de Lead
  const handleEnviarLead = async (lead: EntradaLead) => {
    setEnviandoLead(true);
    try {
      await api.enviarLead(lead);
      setSucessoLead(true);
    } catch (err) {
      console.error("Erro ao enviar lead", err);
    } finally {
      setEnviandoLead(false);
    }
  };

  // Reiniciar fluxo
  const handleVoltarInicio = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setAuditoria(null);
    setSucessoLead(false);
    setTela("formulario");
  };

  // Troca rápida de cenário de desenvolvimento (§1)
  const handleTrocarCenarioDev = (novoCenario: string) => {
    setCenarioForcado(novoCenario);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    if (novoCenario === "rate_limit") {
      track("raiox_rate_limit");
      setTela("rate_limit");
      return;
    }

    if (novoCenario === "url_ou_sorteio") {
      handleVoltarInicio();
      return;
    }

    const fix = obterFixturePorCenario(novoCenario as CenarioKey);
    setAuditoria(fix);
    setSucessoLead(false);
    if (fix.status === "na_fila") {
      setTela("fila");
    } else {
      setTela("resultado");
    }
  };

  // Detecção de cenário na URL ao carregar
  useEffect(() => {
    const cenarioURL = detectarCenarioURL();
    if (cenarioURL) {
      setCenarioForcado(cenarioURL);
    }
  }, []);

  return (
    <div className="container-app">
      {/* Cabeçalho da Aplicação */}
      <header className="topo-app">
        <div className="topo-marca">
          <span className="wordmark">Raio-X de IA</span>
          <span className="topo-sub">· Intellectus Digital</span>
        </div>

        {tela !== "formulario" && (
          <button
            type="button"
            className="botao-secundario"
            onClick={handleVoltarInicio}
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            Nova consulta
          </button>
        )}
      </header>

      {/* Roteamento de Telas em Memória */}
      <main id="conteudo-principal">
        {tela === "formulario" && (
          <Formulario
            aoEnviar={handleIniciarAuditoria}
            enviando={enviandoFormulario}
            erroEnvio={erroEnvio}
            aoTentarNovamente={() => ultimoFormulario && handleIniciarAuditoria(ultimoFormulario)}
          />
        )}

        {tela === "analise" && auditoria && (
          <Analise
            auditoria={auditoria}
            aoConcluirAnimacao={handleConcluirAnimacao}
          />
        )}

        {tela === "resultado" && auditoria && (
          <Resultado
            auditoria={auditoria}
            aoEnviarLead={handleEnviarLead}
            enviandoLead={enviandoLead}
            sucessoLead={sucessoLead}
            carregandoParcialSite={auditoria.status === "parcial"}
            aoNovaConsulta={handleVoltarInicio}
          />
        )}

        {tela === "fila" && auditoria && (
          <Fila
            auditoria={auditoria}
            aoEnviarLead={handleEnviarLead}
            enviandoLead={enviandoLead}
            sucessoLead={sucessoLead}
            aoVoltarInicio={handleVoltarInicio}
          />
        )}

        {tela === "rate_limit" && (
          <div id="tela-rate-limit" className="bloco-painel" style={{ padding: "var(--s6) var(--s4)", textAlign: "center" }}>
            <span className="eyebrow">Limite Diário Atingido</span>
            <h1 className="titulo-destaque" style={{ marginTop: "var(--s2)", marginBottom: "var(--s3)" }}>
              Você já realizou 3 consultas hoje.
            </h1>
            <p className="corpo-texto" style={{ maxWidth: "480px", margin: "0 auto var(--s4) auto" }}>
              Para preservar a capacidade da nossa varredura mensal, limitamos o acesso gratuito diário.
              Volte amanhã ou fale diretamente com a equipe técnica da Intellectus Digital.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "var(--s3)", flexWrap: "wrap" }}>
              <button
                type="button"
                className="botao-primario"
                onClick={() => {
                  setConsultasHoje(0);
                  handleVoltarInicio();
                }}
              >
                Entendi, reiniciar consultas
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Seletor Discreto de Cenário (Dev Only, 10px monospace, sem cor de destaque) */}
      <div className="dev-cenario-selector" aria-label="Seletor de testes de cenário">
        <label htmlFor="dev-cenario-select">dev:</label>
        <select
          id="dev-cenario-select"
          value={cenarioForcado}
          onChange={(e) => handleTrocarCenarioDev(e.target.value)}
        >
          <option value="url_ou_sorteio">padrão (URL / sorteio)</option>
          <option value="critico">crítico (55%)</option>
          <option value="medio">médio (30%)</option>
          <option value="bom">bom (10%)</option>
          <option value="sem-site">sem-site</option>
          <option value="fila">fila (5%)</option>
          <option value="rate_limit">rate-limit (429)</option>
        </select>
      </div>
    </div>
  );
}
