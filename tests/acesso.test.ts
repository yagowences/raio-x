import { test } from "node:test";
import assert from "node:assert/strict";
import { checarAcesso, temBloqueioSilencioso } from "../netlify/functions/lib/moduloB/acesso";
import { subirServidor, semSsrf } from "./servidorLocal";

test("o GET de acesso usa o User-Agent completo que o robô real envia", async () => {
  // Caso real: bellae.com.br (hCDN da Hostinger) devolve 429 ao UA real do
  // GPTBot ("...; GPTBot/1.2; +https://openai.com/gptbot") e 200 ao token puro.
  const srv = await subirServidor((req) =>
    /GPTBot\/\d/.test(req.headers["user-agent"] ?? "") ? { status: 429 } : { status: 200, corpo: "ok" }
  );
  try {
    const acesso = await checarAcesso(srv.base, semSsrf);
    const gptbot = acesso.find((a) => a.ua === "GPTBot");
    assert.deepEqual(gptbot, { ua: "GPTBot", status: 429, bloqueado: true });
  } finally {
    await srv.fechar();
  }
});

test("todo UA enviado se identifica com URL de contato, como o robô real", async () => {
  const uas: string[] = [];
  const srv = await subirServidor((req) => {
    uas.push(req.headers["user-agent"] ?? "");
    return { status: 200, corpo: "ok" };
  });
  try {
    await checarAcesso(srv.base, semSsrf);
    assert.ok(uas.length > 0);
    for (const ua of uas) assert.match(ua, /^Mozilla\/5\.0 .*\+https:\/\//, `UA incompleto: ${ua}`);
  } finally {
    await srv.fechar();
  }
});

test("Google-Extended não é testado por GET: é só token de robots.txt, não tem UA próprio", async () => {
  const srv = await subirServidor(() => ({ status: 200, corpo: "ok" }));
  try {
    const acesso = await checarAcesso(srv.base, semSsrf);
    assert.equal(acesso.some((a) => a.ua === "Google-Extended"), false);
  } finally {
    await srv.fechar();
  }
});

const robotsLiberado = [
  { ua: "GPTBot", gravidade: "alta" as const, permitido: true },
  { ua: "PerplexityBot", gravidade: "critica" as const, permitido: true },
];

test("bloqueio silencioso de robô de gravidade alta não é bloqueio silencioso crítico", () => {
  const acesso = [
    { ua: "GPTBot", status: 429, bloqueado: true },
    { ua: "PerplexityBot", status: 200, bloqueado: false },
  ];
  assert.equal(temBloqueioSilencioso(robotsLiberado, acesso), false);
});

test("robô crítico liberado no robots.txt e barrado com 403 é bloqueio silencioso", () => {
  const acesso = [
    { ua: "GPTBot", status: 200, bloqueado: false },
    { ua: "PerplexityBot", status: 403, bloqueado: true },
  ];
  assert.equal(temBloqueioSilencioso(robotsLiberado, acesso), true);
});
