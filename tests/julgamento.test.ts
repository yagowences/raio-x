import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { julgarConteudo } from "../netlify/functions/lib/julgamento";

const EIXOS = ["resposta_direta", "perguntas_reais", "ganho_informacional", "sinais_de_autoria", "prova_social", "escaneabilidade"];
const TEXTO = "Texto de página longo o bastante para ser avaliado pelo modelo de julgamento.";

function resposta(nota: number): Response {
  const json = Object.fromEntries(EIXOS.map((e) => [e, { nota, por_que: "trecho concreto" }]));
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), { status: 200 });
}

interface Chamada {
  modelo: string;
  corpo: { generationConfig: Record<string, unknown> };
}

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function simularGemini(responder: (modelo: string) => Response): Chamada[] {
  process.env.GEMINI_KEY_CONSULTA = "chave-de-teste";
  const chamadas: Chamada[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const modelo = String(url).match(/models\/([^:]+):/)?.[1] ?? "?";
    chamadas.push({ modelo, corpo: JSON.parse(String(init?.body)) });
    return responder(modelo);
  }) as typeof fetch;
  return chamadas;
}

test("o modelo principal é o lite; o flash só entra quando o lite falha", async () => {
  // 12/09/2026: gemini-flash-latest devolveu 503 ou estourou o tempo em todas as
  // tentativas; o lite respondeu em ~2s em todas.
  const chamadas = simularGemini((m) => (m === "gemini-flash-lite-latest" ? new Response("{}", { status: 503 }) : resposta(6)));
  const r = await julgarConteudo(TEXTO);
  assert.equal(r?.resposta_direta.nota, 6);
  assert.deepEqual(chamadas.map((c) => c.modelo), ["gemini-flash-lite-latest", "gemini-flash-latest"]);
});

test("com o lite respondendo, só uma chamada é feita", async () => {
  const chamadas = simularGemini(() => resposta(4));
  await julgarConteudo(TEXTO);
  assert.deepEqual(chamadas.map((c) => c.modelo), ["gemini-flash-lite-latest"]);
});

test("a chamada pede temperatura 0 e o formato dos seis eixos por schema", async () => {
  const chamadas = simularGemini(() => resposta(4));
  await julgarConteudo(TEXTO);
  const cfg = chamadas[0].corpo.generationConfig as {
    temperature: number;
    responseSchema: { required: string[]; properties: Record<string, { required: string[] }> };
  };
  assert.equal(cfg.temperature, 0);
  assert.deepEqual([...cfg.responseSchema.required].sort(), [...EIXOS].sort());
  for (const eixo of EIXOS) assert.deepEqual(cfg.responseSchema.properties[eixo].required, ["nota", "por_que"]);
});

test("nota fora de 0-10 invalida a resposta e passa para o modelo de reserva", async () => {
  const chamadas = simularGemini((m) => (m === "gemini-flash-lite-latest" ? resposta(11) : resposta(7)));
  const r = await julgarConteudo(TEXTO);
  assert.equal(r?.escaneabilidade.nota, 7);
  assert.equal(chamadas.length, 2);
});
