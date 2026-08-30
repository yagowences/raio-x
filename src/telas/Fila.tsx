import React, { useState } from "react";
import { Auditoria, EntradaLead } from "../api/tipos";
import { AuditoriaSite } from "../componentes/AuditoriaSite";
import { track } from "../analytics";

interface FilaProps {
  auditoria: Auditoria;
  aoEnviarLead: (lead: EntradaLead) => Promise<void>;
  enviandoLead: boolean;
  sucessoLead: boolean;
  aoVoltarInicio?: () => void;
}

export const Fila: React.FC<FilaProps> = ({
  auditoria,
  aoEnviarLead,
  enviandoLead,
  sucessoLead,
  aoVoltarInicio,
}) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  const { corpus, negocio, site_resultado } = auditoria;
  const previsaoHoras = corpus.previsao_horas ?? 24;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErroValidacao(null);

    if (!nome.trim()) {
      setErroValidacao("Informe seu nome.");
      return;
    }

    if (!email.trim() && !whatsapp.trim()) {
      setErroValidacao("Informe pelo menos um canal de contato (e-mail ou WhatsApp).");
      return;
    }

    if (!consentimento) {
      setErroValidacao("Você precisa aceitar os termos de consentimento para entrar na fila prioritária.");
      return;
    }

    track("raiox_fila", {
      segmento: negocio.segmento,
    });

    aoEnviarLead({
      auditoria_id: auditoria.auditoria_id,
      nome: nome.trim(),
      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      consentimento,
    });
  };

  return (
    <div id="tela-fila">
      {/* 1. Bloco de Captura na Fila (Vem ANTES de propósito) */}
      <div className="bloco-painel" style={{ border: "2px solid var(--azul-profundo)", padding: "var(--s6) var(--s4)", marginBottom: "var(--s4)" }}>
        <div style={{ marginBottom: "var(--s4)" }}>
          <span className="eyebrow">Segmento em Mapeamento</span>
          <h1 className="titulo-destaque" style={{ marginTop: "var(--s1)" }}>
            Seu segmento ainda não está no nosso mapeamento de Goiás.
          </h1>
          <p className="corpo-texto" style={{ marginTop: "var(--s2)" }}>
            Deixe seu contato: rodamos a varredura exclusiva para <strong>{negocio.segmento}</strong> em <strong>{negocio.cidade}</strong> e enviamos o resultado completo em até <strong>{previsaoHoras} horas</strong>.
          </p>
        </div>

        {sucessoLead ? (
          <div
            style={{
              padding: "var(--s4)",
              backgroundColor: "rgba(11, 31, 58, 0.05)",
              border: "1px solid var(--azul-profundo)",
              borderRadius: "var(--radius)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: "var(--peso-titulo)", color: "var(--azul-profundo)", marginBottom: "4px" }}>
              Inclusão na fila prioritária confirmada!
            </h3>
            <p className="corpo-texto">
              Nossa esteira processará as perguntas do segmento {negocio.segmento} e enviaremos o laudo completo no e-mail/WhatsApp cadastrado.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {erroValidacao && (
              <div
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--azul-profundo)",
                  backgroundColor: "#FFFFFF",
                  borderRadius: "var(--radius)",
                  fontSize: "12px",
                  fontWeight: "var(--peso-titulo)",
                  color: "var(--azul-profundo)",
                  marginBottom: "var(--s3)",
                }}
              >
                {erroValidacao}
              </div>
            )}

            <div className="grupo-campo">
              <label htmlFor="fila-nome" className="rotulo-campo">
                Seu Nome <span style={{ color: "var(--azul-profundo)" }}>*</span>
              </label>
              <input
                id="fila-nome"
                type="text"
                className="input-padrao"
                placeholder="Ex.: Mariana Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={enviandoLead}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--s3)" }}>
              <div className="grupo-campo">
                <label htmlFor="fila-email" className="rotulo-campo">
                  E-mail de Contato
                </label>
                <input
                  id="fila-email"
                  type="email"
                  className="input-padrao"
                  placeholder="seuemail@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={enviandoLead}
                />
              </div>

              <div className="grupo-campo">
                <label htmlFor="fila-whatsapp" className="rotulo-campo">
                  WhatsApp
                </label>
                <input
                  id="fila-whatsapp"
                  type="tel"
                  className="input-padrao"
                  placeholder="(62) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  disabled={enviandoLead}
                />
              </div>
            </div>

            <div style={{ marginTop: "var(--s2)", marginBottom: "var(--s4)" }}>
              <label
                htmlFor="fila-consentimento"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "var(--s2)",
                  fontSize: "12px",
                  color: "var(--grafite)",
                  cursor: "pointer",
                }}
              >
                <input
                  id="fila-consentimento"
                  type="checkbox"
                  checked={consentimento}
                  onChange={(e) => setConsentimento(e.target.checked)}
                  disabled={enviandoLead}
                  style={{ marginTop: "3px" }}
                />
                <span>
                  Concordo em receber a notificação da varredura prioritária em até {previsaoHoras} horas.
                </span>
              </label>
            </div>

            <button
              id="botao-fila-lead"
              type="submit"
              className="botao-primario"
              disabled={enviandoLead}
              style={{ width: "100%", padding: "14px 24px" }}
            >
              {enviandoLead ? "Registrando na fila..." : `Solicitar Mapeamento Prioritário (${previsaoHoras}h)`}
            </button>
          </form>
        )}
      </div>

      {/* 2. Auditoria do site roda normalmente mesmo na fila (meia entrega + promessa) */}
      <div style={{ marginTop: "var(--s6)" }}>
        <div style={{ marginBottom: "var(--s3)" }}>
          <span className="eyebrow">Entrega Imediata</span>
          <h2 className="titulo-secao">
            Auditoria Técnica Prévia do seu Site
          </h2>
          <p className="corpo-pequeno">
            Enquanto o mapeamento de IA é processado, auditamos a infraestrutura individual do seu domínio.
          </p>
        </div>

        <AuditoriaSite
          id="auditoria-site-fila"
          siteResultado={site_resultado}
          siteUrl={negocio.site}
          carregandoParcial={false}
        />
      </div>

      {aoVoltarInicio && (
        <div style={{ marginTop: "var(--s4)", textAlign: "center" }}>
          <button
            type="button"
            className="botao-secundario"
            onClick={aoVoltarInicio}
            style={{ padding: "8px 16px" }}
          >
            Fazer outra consulta
          </button>
        </div>
      )}
    </div>
  );
};
