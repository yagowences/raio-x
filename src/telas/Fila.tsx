import React, { useState } from "react";
import { Search, Users, Link2 } from "lucide-react";
import { Auditoria, EntradaLead } from "../api/tipos";
import { AuditoriaSite } from "../componentes/AuditoriaSite";
import { Indice } from "../componentes/Indice";
import { Metrica } from "../componentes/Metrica";
import { Recomendacao } from "../componentes/Recomendacao";
import { BlocoBloqueio } from "../componentes/BlocoBloqueio";
import { track } from "../analytics";
import { bloqueioCritico, robosSemAcesso } from "../dominio/bloqueio";
import { descreverCidade, descreverSegmento } from "../dominio/segmento";
import { pontosDaVarredura, pontosNaoMedidos } from "../dominio/indice";

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

  const { corpus, negocio, site_resultado, indice, laudo } = auditoria;
  const previsaoHoras = corpus.previsao_horas ?? 24;
  const segmentoCopy = descreverSegmento(negocio.segmento);
  const cidadeCopy = descreverCidade(negocio.cidade);

  // Etapa gratuita: o índice sai só dos pilares do Módulo B. O denominador vem
  // dos próprios pilares medidos, nunca de uma constante — se um pilar cair, o
  // número na tela acompanha. Ver docs/03, "Com site, sem corpus".
  const pesoMedido = indice ? indice.pilares.reduce((s, p) => s + p.peso, 0) : 0;
  // Varredura = pilares do Módulo A (config/pesos.json). Pilar do site que falhou
  // nesta consulta não é "autoridade externa" — sai à parte, dito com todas as letras.
  const pesoVarredura = pontosDaVarredura();
  const pesoNaoMedido = indice ? pontosNaoMedidos(indice) : 0;
  // Bloqueio crítico abre o BlocoBloqueio mesmo sem o teto morder (docs/03 §2).
  const temBloqueioCritico = bloqueioCritico(site_resultado) !== null;
  const semAcesso = robosSemAcesso(site_resultado);

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
          <span className="eyebrow">Falta a Varredura do Nicho</span>
          <h1 className="titulo-destaque" style={{ marginTop: "var(--s1)" }}>
            {indice
              ? `Medimos ${pesoMedido} dos 100 pontos do índice sem varredura nenhuma.`
              : "Auditamos o seu site agora, sem varredura do nicho."}
          </h1>
          <p className="corpo-texto" style={{ marginTop: "var(--s2)" }}>
            {indice ? (
              <>
                A análise do seu site está pronta{pesoNaoMedido === 0 ? " e completa" : ""}, logo abaixo.
                {pesoNaoMedido > 0 && <> {pesoNaoMedido} pontos do site não puderam ser medidos nesta consulta.</>}{" "}
                Os <strong>{pesoVarredura} pontos</strong> de autoridade externa — quanto a IA cita{" "}
                <strong>{negocio.nome}</strong> — dependem de uma varredura de{" "}
                <strong>{segmentoCopy}</strong> em <strong>{cidadeCopy}</strong>, que ainda
                não rodamos. Deixe seu contato e enviamos em até <strong>{previsaoHoras} horas</strong>.
              </>
            ) : (
              <>
                Deixe seu contato: rodamos a varredura de <strong>{segmentoCopy}</strong> em{" "}
                <strong>{cidadeCopy}</strong> e enviamos o resultado em até{" "}
                <strong>{previsaoHoras} horas</strong>.
              </>
            )}
          </p>

          {/* Progresso visual do índice: reforça que o site já rendeu quase tudo
              que pode render sozinho, e nomeia o que falta em pontos, não em vago. */}
          {indice && (
            <div style={{ marginTop: "var(--s3)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  fontWeight: "var(--peso-titulo)",
                  color: "var(--grafite)",
                  marginBottom: "4px",
                }}
              >
                <span>{pesoMedido} pontos medidos pelo site</span>
                <span>{pesoVarredura} pontos dependem da varredura</span>
              </div>
              <div
                style={{
                  display: "flex",
                  height: "8px",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  border: "1px solid var(--borda-suave)",
                }}
                role="img"
                aria-label={
                  `${pesoMedido} de 100 pontos do índice medidos pelo site; ` +
                  (pesoNaoMedido > 0 ? `${pesoNaoMedido} não medidos nesta consulta; ` : "") +
                  `${pesoVarredura} pontos dependem da varredura de nicho`
                }
              >
                <div style={{ width: `${pesoMedido}%`, backgroundColor: "var(--azul-profundo)" }} />
                {pesoNaoMedido > 0 && <div style={{ width: `${pesoNaoMedido}%`, backgroundColor: "#FFFFFF" }} />}
                <div
                  style={{
                    width: `${pesoVarredura}%`,
                    backgroundColor: "#E2E8F0",
                    backgroundImage:
                      "repeating-linear-gradient(135deg, rgba(11,31,58,0.12) 0px, rgba(11,31,58,0.12) 2px, transparent 2px, transparent 7px)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Instrui o que exatamente chega com o contato — concreto, não "saiba mais". */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--s2)",
              marginTop: "var(--s4)",
            }}
          >
            {[
              { Icone: Search, texto: <>Quantas vezes a IA cita <strong>{negocio.nome}</strong> em perguntas reais de {segmentoCopy}</> },
              { Icone: Users, texto: <>Quais concorrentes aparecem no seu lugar</> },
              { Icone: Link2, texto: <>De quais sites a IA tira essa informação</> },
            ].map(({ Icone, texto }, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "var(--s2)" }}>
                <Icone size={16} color="var(--ciano)" strokeWidth={2.25} style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true" />
                <span className="corpo-pequeno" style={{ color: "var(--azul-profundo)" }}>{texto}</span>
              </div>
            ))}
          </div>
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
              Nossa esteira processará as perguntas de {segmentoCopy} e enviaremos o laudo completo no e-mail/WhatsApp cadastrado.
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

      {/* 2. A análise gratuita. Não é prévia nem consolação: é o que o Módulo B
             entrega sozinho, para qualquer negócio, sem corpus. Ver docs/05, D6. */}
      <div style={{ marginTop: "var(--s6)" }}>
        <div style={{ marginBottom: "var(--s3)" }}>
          <span className="eyebrow">Análise do seu Site</span>
          <h2 className="titulo-secao">O que medimos sem depender de varredura</h2>
          <p className="corpo-pequeno">
            {indice
              ? `${indice.pilares.length} pilares do índice saem só da leitura do seu site.`
              : "Auditoria técnica do domínio informado."}
          </p>
        </div>

        {/* Diagnóstico montado por template. Sem corpus, não cita menção,
            posição nem concorrente (invariante 18). */}
        {laudo && (
          <div
            id="bloco-diagnostico-fila"
            className="bloco-painel"
            style={{ borderLeft: "4px solid var(--azul-profundo)" }}
          >
            <span className="eyebrow">Diagnóstico</span>
            <p className="corpo-texto" style={{ marginTop: "var(--s1)", lineHeight: "1.6" }}>
              {laudo.diagnostico}
            </p>
          </div>
        )}

        {/* O achado que converte também acontece aqui, e aqui ele tem de aparecer. */}
        {temBloqueioCritico && site_resultado && indice && (
          <BlocoBloqueio siteResultado={site_resultado} indice={indice} />
        )}

        {site_resultado?.tecnica && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "var(--s2)",
              marginBottom: "var(--s4)",
            }}
          >
            <Metrica
              rotulo="Robôs Testados"
              valor={String(site_resultado.tecnica.acesso.length)}
              subtexto="Acesso real ao seu domínio"
              destaque={true}
            />
            <Metrica
              rotulo="Robôs Bloqueados"
              valor={String(semAcesso.length)}
              subtexto="Por 403/429 ou robots.txt"
            />
            {indice && (
              <Metrica
                rotulo="Pilares Medidos"
                valor={`${indice.pilares.length} de 6`}
                subtexto={`${pesoMedido} dos 100 pontos`}
              />
            )}
            {/* psi_mobile null = não verificamos. Não pontua e não aparece. */}
            {site_resultado.tecnica.psi_mobile !== null && (
              <Metrica
                rotulo="PageSpeed Mobile"
                valor={String(site_resultado.tecnica.psi_mobile)}
                subtexto="De 0 a 100"
              />
            )}
          </div>
        )}

        {indice && <Indice id="bloco-indice-fila" indice={indice} />}

        {/* Sempre visível: é a evidência de cada número acima (regra 6). */}
        <AuditoriaSite
          id="auditoria-site-fila"
          siteResultado={site_resultado}
          siteUrl={negocio.site}
          carregandoParcial={false}
        />

        {laudo && laudo.recomendacoes && laudo.recomendacoes.length > 0 && (
          <Recomendacao recomendacoes={laudo.recomendacoes} />
        )}
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
