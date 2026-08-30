import React, { useState } from "react";
import { EntradaLead, LaudoResultado } from "../api/tipos";
import { track } from "../analytics";

interface CapturaProps {
  id?: string;
  auditoriaId: string;
  cta: LaudoResultado["cta"];
  aoEnviarLead: (lead: EntradaLead) => Promise<void>;
  enviando: boolean;
  sucesso: boolean;
}

export const Captura: React.FC<CapturaProps> = ({
  id = "bloco-captura-lead",
  auditoriaId,
  cta,
  aoEnviarLead,
  enviando,
  sucesso,
}) => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

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
      setErroValidacao("Você precisa aceitar os termos de consentimento para receber o laudo.");
      return;
    }

    track("raiox_lead", {
      variante_cta: cta.variante,
    });

    aoEnviarLead({
      auditoria_id: auditoriaId,
      nome: nome.trim(),
      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      consentimento,
    });
  };

  return (
    <div id={id} className="bloco-painel" style={{ border: "2px solid var(--azul-profundo)", padding: "var(--s6) var(--s4)" }}>
      <div style={{ marginBottom: "var(--s4)" }}>
        <span className="eyebrow">Próximos Passos · Intellectus Digital</span>
        <h2 className="titulo-destaque" style={{ marginTop: "var(--s1)" }}>
          {cta.titulo}
        </h2>
        <p className="corpo-texto" style={{ marginTop: "var(--s2)" }}>
          {cta.subtitulo}
        </p>
      </div>

      {sucesso ? (
        <div
          style={{
            padding: "var(--s4)",
            backgroundColor: "rgba(11, 31, 58, 0.05)",
            border: "1px solid var(--azul-profundo)",
            borderRadius: "var(--radius)",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: "var(--peso-titulo)", color: "var(--azul-profundo)", marginBottom: "4px" }}>
            Solicitação registrada com sucesso!
          </h3>
          <p className="corpo-texto">
            Entraremos em contato pelo canal informado com o plano de ação detalhado para seu negócio.
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

          {/* Nome */}
          <div className="grupo-campo">
            <label htmlFor="lead-nome" className="rotulo-campo">
              Seu Nome <span style={{ color: "var(--azul-profundo)" }}>*</span>
            </label>
            <input
              id="lead-nome"
              type="text"
              className="input-padrao"
              placeholder="Ex.: Mariana Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={enviando}
              required
            />
          </div>

          {/* Grid Email / WhatsApp */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--s3)" }}>
            <div className="grupo-campo">
              <label htmlFor="lead-email" className="rotulo-campo">
                E-mail de Contato
              </label>
              <input
                id="lead-email"
                type="email"
                className="input-padrao"
                placeholder="seuemail@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={enviando}
              />
            </div>

            <div className="grupo-campo">
              <label htmlFor="lead-whatsapp" className="rotulo-campo">
                WhatsApp
              </label>
              <input
                id="lead-whatsapp"
                type="tel"
                className="input-padrao"
                placeholder="(62) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                disabled={enviando}
              />
            </div>
          </div>

          {/* Consentimento (não pré-marcado) */}
          <div style={{ marginTop: "var(--s2)", marginBottom: "var(--s4)" }}>
            <label
              htmlFor="lead-consentimento"
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
                id="lead-consentimento"
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                disabled={enviando}
                style={{ marginTop: "3px" }}
              />
              <span>
                Concordo em receber o laudo completo e o contato da equipe técnica da Intellectus Digital de acordo com o{" "}
                <a
                  href="#privacidade"
                  onClick={(e) => e.preventDefault()}
                  style={{ color: "var(--azul-profundo)", fontWeight: "var(--peso-titulo)" }}
                >
                  aviso de privacidade
                </a>.
              </span>
            </label>
          </div>

          <button
            id="botao-enviar-lead"
            type="submit"
            className="botao-primario"
            disabled={enviando}
            style={{ width: "100%", padding: "14px 24px" }}
          >
            {enviando ? "Enviando solicitação..." : "Receber Laudo Técnico Completo"}
          </button>
        </form>
      )}
    </div>
  );
};
