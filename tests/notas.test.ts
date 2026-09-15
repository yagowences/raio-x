import { test } from "node:test";
import assert from "node:assert/strict";
import { notasDoModuloB } from "../src/dominio/notas";
import { bloqueioCritico, motivoTeto } from "../src/dominio/bloqueio";
import { calcularIndice, pontosDaVarredura, pontosNaoMedidos } from "../src/dominio/indice";
import type { SiteResultado } from "../src/api/tipos";

type Gravidade = "critica" | "alta" | "baixa";
const ROBOS: Array<[string, "busca" | "recuperacao" | "treinamento", Gravidade]> = [
  ["GPTBot", "treinamento", "alta"],
  ["ChatGPT-User", "recuperacao", "critica"],
  ["OAI-SearchBot", "busca", "alta"],
  ["PerplexityBot", "recuperacao", "critica"],
  ["Google-Extended", "treinamento", "alta"],
  ["Googlebot", "busca", "baixa"],
];
const COM_GET = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "PerplexityBot"];

function site(opcoes: { negadosNoRobots?: string[]; http?: Record<string, number> } = {}): SiteResultado {
  const negados = opcoes.negadosNoRobots ?? [];
  const http = opcoes.http ?? {};
  return {
    avaliado: true,
    url_final: "https://exemplo.com.br/",
    tecnica: {
      robots: ROBOS.map(([ua, familia, gravidade]) => ({ ua, familia, gravidade, permitido: !negados.includes(ua) })),
      acesso: COM_GET.map((ua) => {
        const status = http[ua] ?? 200;
        return { ua, status, bloqueado: status === 403 || status === 429 };
      }),
      bloqueio_silencioso: false,
      sitemap: { existe: true, urls: 10, lastmod: null },
      html_estatico: { chars_bruto: 5000, suspeita_spa: false },
      psi_mobile: null,
    },
    estrutura: null,
    dados_estruturados: null,
    nap: null,
    conteudo: null,
  } as SiteResultado;
}

function notaTecnica(sr: SiteResultado): number | undefined {
  return notasDoModuloB(sr, null).find((n) => n.id === "tecnica")?.nota;
}

test("nota técnica é 100 quando todo robô de IA lê a raiz", () => {
  assert.equal(notaTecnica(site()), 100);
});

test("robô negado no robots.txt derruba a nota técnica, como o barrado por HTTP", () => {
  // Antes: robots.txt negando ChatGPT-User convivia com técnica 100/100.
  const porRobots = notaTecnica(site({ negadosNoRobots: ["ChatGPT-User"] }));
  const porHttp = notaTecnica(site({ http: { GPTBot: 429 } }));
  assert.equal(porRobots, 86);
  assert.equal(porHttp, 86);
});

test("robô negado no robots.txt e barrado por HTTP conta uma vez só", () => {
  assert.equal(notaTecnica(site({ negadosNoRobots: ["PerplexityBot"], http: { PerplexityBot: 403 } })), 86);
});

test("Googlebot (gravidade baixa) não entra na nota técnica de IA", () => {
  assert.equal(notaTecnica(site({ negadosNoRobots: ["Googlebot"] })), 100);
});

function conteudo(notas: Partial<Record<string, number | null>>) {
  const eixos = ["resposta_direta", "perguntas_reais", "ganho_informacional", "sinais_de_autoria", "prova_social", "escaneabilidade"];
  return Object.fromEntries(eixos.map((e) => [e, { nota: e in notas ? notas[e]! : 10, por_que: "x" }])) as NonNullable<SiteResultado["conteudo"]>;
}

function comConteudoEEstrutura(paginaAutor: boolean): SiteResultado {
  return {
    ...site(),
    nap: { nome: true, telefone: null, endereco: false, cep: null, horario: false, pagina_autor: paginaAutor },
    // estrutural: 50 + 20 (sem salto) + 10 (sem imagens) = 80
    estrutura: { h1: 1, h2: 2, h3: 0, salto_de_nivel: false, tabelas: 0, listas: 0, imagens: 0, imagens_com_alt: 0, video_com_transcricao: null },
  } as SiteResultado;
}

function nota(sr: SiteResultado, c: SiteResultado["conteudo"], id: string) {
  return notasDoModuloB(sr, c ?? null).find((n) => n.id === id)?.nota;
}

test("autoria combina página do responsável com sinais de autoria lidos no texto", () => {
  // spec §7: autoria_onpage é o E-E-A-T que o site declara. O eixo sinais_de_autoria
  // do julgamento mede exatamente isso, e ficava perdido dentro de Estrutura.
  // Metade checagem da página (100 ou 20), metade julgamento × 10.
  assert.equal(nota(comConteudoEEstrutura(true), conteudo({ sinais_de_autoria: 0 }), "autoria_onpage"), 50);
  assert.equal(nota(comConteudoEEstrutura(false), conteudo({ sinais_de_autoria: 9 }), "autoria_onpage"), 55);
});

test("sem julgamento de conteúdo, autoria fica só com a checagem da página", () => {
  assert.equal(nota(comConteudoEEstrutura(true), null, "autoria_onpage"), 100);
  assert.equal(nota(comConteudoEEstrutura(true), conteudo({ sinais_de_autoria: null }), "autoria_onpage"), 100);
});

test("Estrutura não conta sinais de autoria — senão o eixo pesa em dois pilares", () => {
  // Conteúdo 10 em tudo menos autoria: média dos cinco eixos = 100; (80 + 100) / 2 = 90.
  assert.equal(nota(comConteudoEEstrutura(true), conteudo({ sinais_de_autoria: 0 }), "estrutura"), 90);
});

test("pontos da varredura vêm dos pilares de corpus, não de 100 − medido", () => {
  // Com o julgamento de conteúdo fora, o índice mede 63; a copy dizia "37 pontos
  // de autoridade externa". A varredura vale 25 — os outros 12 não foram medidos.
  const semEstrutura = calcularIndice(
    [
      { id: "autoria_onpage", nota: 50, confianca: "media" },
      { id: "tecnica", nota: 100, confianca: "alta" },
      { id: "local_nap", nota: 50, confianca: "alta" },
      { id: "dados_estruturados", nota: 65, confianca: "alta" },
    ],
    { tetoAcionado: false }
  );
  assert.equal(pontosDaVarredura(), 25);
  assert.equal(pontosNaoMedidos(semEstrutura), 12);
});

test("etapa gratuita completa não tem ponto sem medição", () => {
  const completo = calcularIndice(
    ["autoria_onpage", "tecnica", "local_nap", "estrutura", "dados_estruturados"].map((id) => ({
      id,
      nota: 70,
      confianca: "alta" as const,
    })),
    { tetoAcionado: false }
  );
  assert.equal(pontosNaoMedidos(completo), 0);
});

test("robô de gravidade alta barrado por 429 não é bloqueio crítico", () => {
  assert.equal(bloqueioCritico(site({ http: { GPTBot: 429 } })), null);
});

test("robô crítico liberado no robots.txt e barrado por 403 é bloqueio crítico via HTTP", () => {
  const b = bloqueioCritico(site({ http: { PerplexityBot: 403 } }));
  assert.deepEqual(b, { ua: "PerplexityBot", via: "http", status: 403 });
  assert.equal(motivoTeto(b!), "PerplexityBot bloqueado por HTTP 403");
});

test("robô crítico negado no robots.txt é bloqueio crítico via robots, com motivo próprio", () => {
  const b = bloqueioCritico(site({ negadosNoRobots: ["ChatGPT-User"] }));
  assert.deepEqual(b, { ua: "ChatGPT-User", via: "robots", status: null });
  assert.equal(motivoTeto(b!), "ChatGPT-User bloqueado no robots.txt");
});
