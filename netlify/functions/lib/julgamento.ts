// netlify/functions/lib/julgamento.ts
//
// A única saída de LLM da consulta gratuita — tech-spec §6.4.
//
// TRAVA DE PRIVACIDADE: esta função recebe SÓ o texto limpo da página. Nome do
// negócio, e-mail e WhatsApp são fisicamente inalcançáveis daqui — a assinatura
// de `julgarConteudo` não aceita mais nada. Isso é obrigatório porque o free
// tier do Gemini permite que o Google use os prompts para treinar.

import type { EixoConteudo, Nota } from "../../../src/api/tipos";

// O lite é o principal: em 12/09/2026 o flash devolveu 503 "high demand" ou
// estourou o tempo em todas as tentativas, e o lite respondeu em ~2s em todas,
// com notas estáveis entre execuções. O flash fica como segunda tentativa.
const MODELOS = ["gemini-flash-lite-latest", "gemini-flash-latest"];
// Roda em background function (até 15 min); 8s cortava resposta lenta mas válida.
const TIMEOUT_MS = 15000;

const EIXOS: EixoConteudo[] = [
  "resposta_direta",
  "perguntas_reais",
  "ganho_informacional",
  "sinais_de_autoria",
  "prova_social",
  "escaneabilidade",
];

// Espelha prompts/julgamento.txt — mantenha os dois sincronizados ao editar.
// Embutido aqui, e não lido do disco em runtime, porque o bundler de funções
// da Netlify não garante que arquivos fora do grafo de import cheguem ao
// pacote publicado da função.
const PROMPT_BASE = `Você avalia um trecho de texto extraído de uma página web, sem saber a que negócio ela pertence.

Você recebe apenas texto limpo (sem HTML, sem nome do negócio, sem contato). Avalie os
seis eixos abaixo, cada um de 0 a 10. Responda só com JSON, sem texto fora do JSON.

Como ler o texto: linhas que começam com # são títulos (## subtítulo, ### e assim por
diante); linhas que começam com - são itens de lista; […] marca trecho cortado para
caber no limite — não trate o corte como falha do texto. Menu, carrinho e rodapé já
foram removidos. Se houver uma linha "=== Página interna: /caminho ===", o que vem
depois é de uma página interna do mesmo site (sobre, quem somos): avalie as duas
partes juntas.`;

const PROMPT_EIXOS = `

Eixos:

- resposta_direta: a primeira ou segunda frase de cada seção já responde a pergunta que
  o título sugere, sem exigir que o leitor monte a resposta a partir de contexto disperso?
- perguntas_reais: os títulos e subtítulos estão escritos como uma pergunta que um
  cliente faria, ou como jargão de marketing?
- ganho_informacional: o texto ensina algo específico (preço, prazo, processo, material,
  contraindicação) ou fica em afirmação genérica que serviria para qualquer concorrente?
- sinais_de_autoria: há indício de que uma pessoa ou equipe identificável escreveu isto —
  primeira pessoa, referência a experiência própria, menção a formação ou cargo?
- prova_social: há depoimento, caso, número ou resultado citado em texto — não em
  imagem, não "centenas de clientes satisfeitos" sem nenhum dado?
- escaneabilidade: um leitor apressado consegue extrair o essencial em listas, tabelas
  ou parágrafos curtos, ou o texto é um bloco contínuo sem estrutura?

Formato de saída, exatamente estas seis chaves:

{
  "resposta_direta": { "nota": 0, "por_que": "" },
  "perguntas_reais": { "nota": 0, "por_que": "" },
  "ganho_informacional": { "nota": 0, "por_que": "" },
  "sinais_de_autoria": { "nota": 0, "por_que": "" },
  "prova_social": { "nota": 0, "por_que": "" },
  "escaneabilidade": { "nota": 0, "por_que": "" }
}

Regras:

- "por_que" tem uma frase, cita algo concreto do texto recebido — nunca genérico.
- Se o texto for curto demais para avaliar um eixo com confiança, dê nota 0 e diga
  isso em "por_que" — nunca meio-termo por incerteza.
- Nunca elogie o texto além do que os fatos observados sustentam. Sem "excelente",
  "muito bom", "parabéns" — só o que foi observado e por quê.
- Não invente nome de empresa, produto ou pessoa que não esteja literalmente no texto.

Texto a avaliar:

`;

const PROMPT = `${PROMPT_BASE}\n${PROMPT_EIXOS}`;

// Formato garantido pela API, não só pedido no prompt: resposta fora dele volta
// como erro do modelo em vez de JSON que o validar() teria de recusar.
const SCHEMA_RESPOSTA = {
  type: "OBJECT",
  properties: Object.fromEntries(
    EIXOS.map((eixo) => [
      eixo,
      {
        type: "OBJECT",
        properties: { nota: { type: "INTEGER" }, por_que: { type: "STRING" } },
        required: ["nota", "por_que"],
      },
    ])
  ),
  required: EIXOS,
};

interface RespostaGemini {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

async function chamarGemini(modelo: string, textoLimpo: string): Promise<unknown> {
  const chave = process.env.GEMINI_KEY_CONSULTA;
  if (!chave) throw new Error("GEMINI_KEY_CONSULTA não configurada");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + textoLimpo }] }],
        // Temperatura 0: a mesma página tem de dar a mesma nota em duas consultas.
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA_RESPOSTA, temperature: 0 },
      }),
    });
    if (!resp.ok) throw new Error(`Gemini respondeu HTTP ${resp.status}`);

    const dados = (await resp.json()) as RespostaGemini;
    const texto = dados.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof texto !== "string") throw new Error("resposta do Gemini sem texto");
    return JSON.parse(texto);
  } finally {
    clearTimeout(timer);
  }
}

function validar(obj: unknown): Record<EixoConteudo, Nota> | null {
  if (typeof obj !== "object" || obj === null) return null;
  const resultado = {} as Record<EixoConteudo, Nota>;
  for (const eixo of EIXOS) {
    const bruto = (obj as Record<string, unknown>)[eixo];
    if (typeof bruto !== "object" || bruto === null) return null;
    const nota = (bruto as Record<string, unknown>).nota;
    const porQue = (bruto as Record<string, unknown>).por_que;
    if (typeof nota !== "number" || !Number.isInteger(nota) || nota < 0 || nota > 10) return null;
    if (typeof porQue !== "string") return null;
    resultado[eixo] = { nota, por_que: porQue };
  }
  return resultado;
}

/**
 * julgarConteudo — a assinatura É a trava de privacidade. Nunca passe mais do
 * que o texto limpo: nada de auditoria, negócio, e-mail ou site_resultado.
 *
 * Uma nova tentativa com backoff (tech-spec §6.4), já no modelo de reserva.
 * Falhando as duas, devolve `null` — o chamador trata como falha da chamada de
 * julgamento: o pilar `estrutura` sai do denominador do índice, e o laudo não
 * menciona conteúdo. Nunca inventar nota.
 *
 * Falha vai para o log da função (só modelo e motivo, nunca o texto julgado):
 * sem isso, o pilar sumia de toda auditoria sem ninguém perceber.
 */
export async function julgarConteudo(textoLimpo: string): Promise<Record<EixoConteudo, Nota> | null> {
  if (!textoLimpo || textoLimpo.trim().length < 50) return null;

  for (let tentativa = 0; tentativa < MODELOS.length; tentativa++) {
    const modelo = MODELOS[tentativa];
    try {
      const validado = validar(await chamarGemini(modelo, textoLimpo));
      if (validado) return validado;
      console.error(`[julgamento] ${modelo}: resposta fora do formato dos seis eixos`);
    } catch (err) {
      console.error(`[julgamento] ${modelo}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (tentativa < MODELOS.length - 1) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}
