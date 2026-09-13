import { test } from "node:test";
import assert from "node:assert/strict";
import { montarLaudo } from "../src/dominio/laudo";
import { calcularIndice } from "../src/dominio/indice";
import { descreverSegmento, descreverCidade } from "../src/dominio/segmento";
import type { SiteResultado } from "../src/api/tipos";

const indice = calcularIndice([{ id: "tecnica", nota: 100, confianca: "alta" }], { tetoAcionado: false });
// Sem JSON-LD: dispara sem_dados_estruturados, para o laudo ter ao menos uma recomendação.
const site = {
  avaliado: true,
  url_final: "https://exemplo.com.br/",
  dados_estruturados: { presente: false, tipos: [], campos_faltando: {}, risco_avaliacao: false },
} as SiteResultado;

test("segmento genérico do formulário não vira nome de nicho na copy", () => {
  // Caso real: "varredura de IA para outro segmento em Goiânia".
  const laudo = montarLaudo({
    negocio: { nome: "Loja X", segmento: "outro segmento", cidade: "outra cidade" },
    site_resultado: site,
    indice,
    visibilidade: null,
  })!;
  assert.doesNotMatch(laudo.diagnostico, /outro segmento|outra cidade/);
  assert.doesNotMatch(laudo.cta.subtitulo, /outro segmento|outra cidade/);
  assert.match(laudo.diagnostico, /seu segmento em sua cidade/);
});

test("robô de gravidade alta barrado por HTTP gera recomendação com o dado medido", () => {
  // Caso real: bellae.com.br devolve 429 ao GPTBot. Não aciona teto (gravidade
  // alta), mas derruba a nota técnica — e o laudo não dizia por quê.
  const sr = {
    avaliado: true,
    url_final: "https://bellae.com.br/",
    tecnica: {
      robots: [
        { ua: "GPTBot", familia: "treinamento", gravidade: "alta", permitido: true },
        { ua: "PerplexityBot", familia: "recuperacao", gravidade: "critica", permitido: true },
      ],
      acesso: [
        { ua: "GPTBot", status: 429, bloqueado: true },
        { ua: "PerplexityBot", status: 200, bloqueado: false },
      ],
      bloqueio_silencioso: false,
      sitemap: { existe: true, urls: 1, lastmod: null },
      html_estatico: { chars_bruto: 25000, suspeita_spa: false },
      psi_mobile: null,
    },
  } as SiteResultado;
  const idx = calcularIndice([{ id: "tecnica", nota: 86, confianca: "alta" }], { tetoAcionado: false });
  const laudo = montarLaudo({
    negocio: { nome: "Bellae", segmento: "clínica de estética", cidade: "Goiânia" },
    site_resultado: sr,
    indice: idx,
    visibilidade: null,
  })!;
  const rec = laudo.recomendacoes.find((r) => r.pilar === "tecnica");
  assert.ok(rec, "sem recomendação técnica para o GPTBot barrado");
  assert.equal(rec.dado, "GPTBot → HTTP 429");
  assert.match(rec.texto, /GPTBot recebeu erro 429 ao tentar ler https:\/\/bellae\.com\.br\//);
});

function julgamento(notas: Record<string, number>) {
  const eixos = ["resposta_direta", "perguntas_reais", "ganho_informacional", "sinais_de_autoria", "prova_social", "escaneabilidade"];
  return Object.fromEntries(eixos.map((e) => [e, { nota: notas[e] ?? 8, por_que: "x" }])) as NonNullable<SiteResultado["conteudo"]>;
}

function laudoCom(conteudo: SiteResultado["conteudo"], pilares: Array<[string, number]>) {
  const sr = {
    avaliado: true,
    url_final: "https://loja.com.br/",
    nap: { nome: true, telefone: null, endereco: false, cep: null, horario: false, pagina_autor: true },
    dados_estruturados: { presente: false, tipos: [], campos_faltando: {}, risco_avaliacao: false },
    conteudo,
  } as SiteResultado;
  const idx = calcularIndice(
    pilares.map(([id, n]) => ({ id, nota: n, confianca: "alta" as const })),
    { tetoAcionado: false }
  );
  return montarLaudo({ negocio: { nome: "Loja", segmento: "joalheria", cidade: "Goiânia" }, site_resultado: sr, indice: idx, visibilidade: null })!;
}

test("título que não é pergunta de cliente gera recomendação com a nota do julgamento", () => {
  const laudo = laudoCom(julgamento({ perguntas_reais: 2 }), [["estrutura", 40], ["local_nap", 50], ["dados_estruturados", 5]]);
  const rec = laudo.recomendacoes.find((r) => r.pilar === "estrutura");
  assert.ok(rec, JSON.stringify(laudo.recomendacoes));
  assert.equal(rec.titulo, "Seus títulos não são as perguntas que o cliente faz");
  assert.equal(rec.dado, "títulos como pergunta: 2/10");
});

test("sem julgamento de conteúdo, o laudo não fala de conteúdo", () => {
  // docs/04: conteudo null → omitir, nunca "conteúdo fraco".
  const laudo = laudoCom(null, [["local_nap", 50], ["dados_estruturados", 5]]);
  assert.ok(laudo.recomendacoes.every((r) => !r.dado.endsWith("/10")), JSON.stringify(laudo.recomendacoes));
});

test("no máximo uma recomendação por pilar: três eixos fracos não tomam o laudo", () => {
  // Caso real: bellaeacessorios.com.br — resposta direta, perguntas e prova social
  // com 0/10; sem o limite, os três gatilhos de Estrutura empurravam NAP e schema para fora.
  const laudo = laudoCom(
    julgamento({ resposta_direta: 0, perguntas_reais: 0, prova_social: 0 }),
    [["estrutura", 40], ["local_nap", 50], ["dados_estruturados", 5]]
  );
  const pilares = laudo.recomendacoes.map((r) => r.pilar);
  assert.equal(pilares.length, 3);
  assert.deepEqual([...pilares].sort(), ["dados_estruturados", "estrutura", "local_nap"]);
});

test("segmento e cidade reais passam intactos", () => {
  assert.equal(descreverSegmento("clínica de estética"), "clínica de estética");
  assert.equal(descreverCidade("Goiânia"), "Goiânia");
});
