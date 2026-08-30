import React, { useState } from "react";
import { EntradaFormulario } from "../api/tipos";
import { track } from "../analytics";

interface FormularioProps {
  aoEnviar: (dados: EntradaFormulario) => Promise<void>;
  enviando: boolean;
  erroEnvio?: string | null;
  aoTentarNovamente?: () => void;
}

const SEGMENTOS_DISPONIVEIS = [
  "clínica de estética",
  "salão de beleza",
  "barbearia",
  "pet shop",
  "clínica veterinária",
  "ótica",
  "nutricionista",
  "psicólogo",
  "outro segmento",
];

const CIDADES_DISPONIVEIS = [
  "Goiânia",
  "Aparecida de Goiânia",
  "Anápolis",
  "Senador Canedo",
  "outra cidade",
];

export const Formulario: React.FC<FormularioProps> = ({
  aoEnviar,
  enviando,
  erroEnvio,
  aoTentarNovamente,
}) => {
  const [negocio, setNegocio] = useState("Clínica Vitalis");
  const [segmento, setSegmento] = useState("clínica de estética");
  const [cidade, setCidade] = useState("Goiânia");
  const [site, setSite] = useState("https://clinicavitalis.com.br");
  const [buscaSegmento, setBuscaSegmento] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio.trim() || negocio.trim().length < 2 || negocio.trim().length > 120) {
      return;
    }

    track("raiox_iniciado", {
      segmento,
      cidade,
      tem_site: !!site.trim(),
    });

    aoEnviar({
      negocio: negocio.trim(),
      segmento,
      cidade,
      site: site.trim() || undefined,
    });
  };

  const segmentosFiltrados = SEGMENTOS_DISPONIVEIS.filter((s) =>
    s.toLowerCase().includes(buscaSegmento.toLowerCase())
  );

  return (
    <div id="tela-formulario" className="bloco-painel" style={{ padding: "var(--s6) var(--s4)" }}>
      <div style={{ marginBottom: "var(--s4)" }}>
        <span className="eyebrow">Auditoria de Presença em IA</span>
        <h1 className="titulo-destaque" style={{ marginTop: "var(--s1)" }}>
          Raio-X de IA do seu Negócio Local
        </h1>
        <p className="corpo-texto" style={{ marginTop: "var(--s2)" }}>
          Audite a visibilidade da sua empresa dentro das respostas geradas por IA no estado de Goiás.
        </p>
      </div>

      {erroEnvio && (
        <div
          style={{
            padding: "12px",
            border: "2px solid var(--azul-profundo)",
            borderRadius: "var(--radius)",
            marginBottom: "var(--s4)",
            backgroundColor: "#FFFFFF",
          }}
        >
          <div style={{ fontWeight: "var(--peso-wordmark)", color: "var(--azul-profundo)", marginBottom: "4px" }}>
            Erro de conexão ao iniciar auditoria
          </div>
          <p className="corpo-pequeno" style={{ marginBottom: "8px" }}>
            {erroEnvio}
          </p>
          {aoTentarNovamente && (
            <button
              type="button"
              className="botao-secundario"
              onClick={aoTentarNovamente}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Campo 1: Nome do negócio */}
        <div className="grupo-campo">
          <label htmlFor="campo-negocio" className="rotulo-campo">
            Nome do Negócio <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <input
            id="campo-negocio"
            name="negocio"
            type="text"
            className="input-padrao"
            placeholder="Ex.: Clínica Vitalis"
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            minLength={2}
            maxLength={120}
            required
            disabled={enviando}
          />
        </div>

        {/* Campo 2: Segmento (com busca) */}
        <div className="grupo-campo">
          <label htmlFor="campo-segmento" className="rotulo-campo">
            Segmento <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: "var(--s2)", flexDirection: "column" }}>
            <input
              id="campo-busca-segmento"
              type="text"
              className="input-padrao"
              placeholder="Filtrar segmento na lista..."
              value={buscaSegmento}
              onChange={(e) => setBuscaSegmento(e.target.value)}
              disabled={enviando}
              style={{ fontSize: "12px", padding: "6px 10px", backgroundColor: "#F8FAFC" }}
            />
            <select
              id="campo-segmento"
              name="segmento"
              className="select-padrao"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              disabled={enviando}
              required
            >
              {segmentosFiltrados.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Campo 3: Cidade */}
        <div className="grupo-campo">
          <label htmlFor="campo-cidade" className="rotulo-campo">
            Cidade <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <select
            id="campo-cidade"
            name="cidade"
            className="select-padrao"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            disabled={enviando}
            required
          >
            {CIDADES_DISPONIVEIS.map((cid) => (
              <option key={cid} value={cid}>
                {cid}
              </option>
            ))}
          </select>
        </div>

        {/* Campo 4: Site */}
        <div className="grupo-campo">
          <label htmlFor="campo-site" className="rotulo-campo">
            Site do Negócio (opcional)
          </label>
          <input
            id="campo-site"
            name="site"
            type="text"
            className="input-padrao"
            placeholder="Ex.: https://seusite.com.br"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            disabled={enviando}
          />
          <span
            className="corpo-pequeno"
            style={{
              marginTop: "var(--s1)",
              fontSize: "12px",
              color: "var(--grafite)",
              lineHeight: "1.4",
            }}
          >
            Sem o site, avaliamos só a visibilidade em IA. Com ele, você recebe também o índice técnico.
          </span>
        </div>

        {/* Botão de Envio */}
        <div style={{ marginTop: "var(--s6)" }}>
          <button
            id="botao-iniciar-auditoria"
            type="submit"
            className="botao-primario"
            disabled={enviando || !negocio.trim()}
            style={{ width: "100%", padding: "14px 24px" }}
          >
            {enviando ? "Consultando a varredura..." : "Iniciar Raio-X de IA"}
          </button>
        </div>
      </form>
    </div>
  );
};
