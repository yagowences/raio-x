import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checarRobots } from "../netlify/functions/lib/moduloB/robots";
import { subirServidor, semSsrf } from "./servidorLocal";

async function robotsCom(texto: string) {
  const srv = await subirServidor((req) => (req.url === "/robots.txt" ? { status: 200, corpo: texto } : { status: 404 }));
  try {
    const { robots } = await checarRobots(srv.base, semSsrf);
    return Object.fromEntries(robots.map((r) => [r.ua, r.permitido]));
  } finally {
    await srv.fechar();
  }
}

test("robots.txt padrão da Nuvemshop libera todos os robôs de IA na raiz", async () => {
  // Caso real: bellaeacessorios.com.br. Linha em branco + comentário entre grupos
  // fazia o Disallow: / do WBSearchBot vazar para o grupo `*`.
  const permitido = await robotsCom(readFileSync(new URL("./fixtures/robots-nuvemshop.txt", import.meta.url), "utf8"));
  assert.deepEqual(permitido, {
    GPTBot: true,
    "ChatGPT-User": true,
    "OAI-SearchBot": true,
    PerplexityBot: true,
    "Google-Extended": true,
    Googlebot: true,
  });
});

test("linha em branco entre User-agent e regras não separa o grupo", async () => {
  const permitido = await robotsCom("User-agent: PerplexityBot\n\nDisallow: /\n\nUser-agent: *\nDisallow: /admin/\n");
  assert.equal(permitido.PerplexityBot, false);
  assert.equal(permitido.GPTBot, true);
});

test("Disallow: / explícito para um robô crítico nega só esse robô", async () => {
  const permitido = await robotsCom("User-agent: *\nDisallow: /admin/\n\nUser-agent: ChatGPT-User\nDisallow: /\n");
  assert.equal(permitido["ChatGPT-User"], false);
  assert.equal(permitido.PerplexityBot, true);
});

test("nome do robô no robots.txt casa sem diferenciar maiúsculas", async () => {
  const permitido = await robotsCom("User-agent: gptbot\nDisallow: /\n");
  assert.equal(permitido.GPTBot, false);
});

test("Disallow: /* também bloqueia a raiz", async () => {
  const permitido = await robotsCom("User-agent: PerplexityBot\nDisallow: /*\n");
  assert.equal(permitido.PerplexityBot, false);
});

test("regra com curinga que exige query string não bloqueia a raiz", async () => {
  const permitido = await robotsCom("User-agent: *\nDisallow: /*?*srsltid=*\n");
  assert.equal(permitido.GPTBot, true);
});

test("Allow: / de mesma especificidade vence Disallow: /", async () => {
  const permitido = await robotsCom("User-agent: GPTBot\nDisallow: /\nAllow: /\n");
  assert.equal(permitido.GPTBot, true);
});

test("Disallow vazio não bloqueia nada", async () => {
  const permitido = await robotsCom("User-agent: *\nDisallow:\n");
  assert.equal(permitido.PerplexityBot, true);
});
