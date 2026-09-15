import React, { useState } from "react";
import { EntradaFormulario } from "../api/tipos";
import { track } from "../analytics";
import { SEGMENTOS_DISPONIVEIS, resolverSegmento } from "../dominio/segmento";

interface FormularioProps {
  aoEnviar: (dados: EntradaFormulario) => Promise<void>;
  enviando: boolean;
  erroEnvio?: string | null;
  aoTentarNovamente?: () => void;
}

const ESTADOS_DISPONIVEIS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export const Formulario: React.FC<FormularioProps> = ({
  aoEnviar,
  enviando,
  erroEnvio,
  aoTentarNovamente,
}) => {
  const [negocio, setNegocio] = useState("");
  const [segmento, setSegmento] = useState("");
  const [segmentoOutro, setSegmentoOutro] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [site, setSite] = useState("");
  const [buscaSegmento, setBuscaSegmento] = useState("");

  const segmentoEhOutro = /^outro segmento$/i.test(segmento);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio.trim() || negocio.trim().length < 2 || negocio.trim().length > 120) {
      return;
    }
    if (segmentoEhOutro && !segmentoOutro.trim()) {
      return;
    }

    const segmentoFinal = resolverSegmento(segmento, segmentoOutro);

    track("raiox_iniciado", {
      segmento: segmentoFinal,
      cidade,
      tem_site: !!site.trim(),
    });

    aoEnviar({
      negocio: negocio.trim(),
      segmento: segmentoFinal,
      cidade: cidade.trim(),
      estado,
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
              <option value="" disabled>
                Selecione o segmento
              </option>
              {segmentosFiltrados.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
            {segmentoEhOutro && (
              <input
                id="campo-segmento-outro"
                type="text"
                className="input-padrao"
                placeholder="Ex.: fisioterapia"
                aria-label="Qual o segmento do seu negócio?"
                value={segmentoOutro}
                onChange={(e) => setSegmentoOutro(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                disabled={enviando}
              />
            )}
          </div>
        </div>

        {/* Campo 3: Estado */}
        <div className="grupo-campo">
          <label htmlFor="campo-estado" className="rotulo-campo">
            Estado <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <select
            id="campo-estado"
            name="estado"
            className="select-padrao"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            disabled={enviando}
            required
          >
            <option value="" disabled>
              Selecione o estado
            </option>
            {ESTADOS_DISPONIVEIS.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} — {uf.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Campo 3b: Cidade */}
        <div className="grupo-campo">
          <label htmlFor="campo-cidade" className="rotulo-campo">
            Cidade <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <input
            id="campo-cidade"
            name="cidade"
            type="text"
            className="input-padrao"
            placeholder="Ex.: Goiânia"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            required
            disabled={enviando}
          />
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
