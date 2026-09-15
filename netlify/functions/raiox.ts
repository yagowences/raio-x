// netlify/functions/raiox.ts
//
// POST /api/raiox — síncrono, <1s. Valida, checa rate limit, cria a linha da
// auditoria e dispara a background function que roda o Módulo B de verdade.
//
// Este backend implementa só a etapa gratuita (docs/03, "Com site, sem corpus"):
// não há corpus, então toda consulta seria "na_fila" no produto final. Aqui o
// status inicial é "parcial" ENQUANTO o site está sendo auditado em background,
// e vira "na_fila" (terminal, com site_resultado/indice/laudo preenchidos)
// quando o Módulo B termina — é essa transição que o front usa para saber
// quando parar o polling.

import { z } from "zod";
import type { Config, Context } from "@netlify/functions";
import { getPool } from "./lib/db";
import { hashIp } from "./lib/ipHash";
import { verificarEIncrementarRateLimit } from "./lib/rateLimit";
import { mapearAuditoria } from "./lib/mapearAuditoria";
import type { Auditoria } from "../../src/api/tipos";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const EntradaSchema = z.object({
  negocio: z.string().trim().min(2).max(120),
  segmento: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  estado: z.string().trim().length(2),
  site: z.string().trim().min(3).max(300).optional(),
});

function headersJson(): HeadersInit {
  return { "content-type": "application/json", "access-control-allow-origin": CORS_ORIGIN };
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ erro: "metodo_nao_permitido" }), { status: 405, headers: headersJson() });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: "validacao", mensagem: "corpo inválido" }), {
      status: 400,
      headers: headersJson(),
    });
  }

  const validado = EntradaSchema.safeParse(corpo);
  if (!validado.success) {
    const primeiro = validado.error.issues[0];
    return new Response(
      JSON.stringify({
        erro: "validacao",
        campo: primeiro?.path.join(".") ?? "?",
        mensagem: primeiro?.message ?? "entrada inválida",
      }),
      { status: 400, headers: headersJson() }
    );
  }

  const { negocio, segmento, cidade, estado, site } = validado.data;
  const ip = context.ip || "0.0.0.0";
  const ipHash = hashIp(ip);
  const pool = getPool();

  const limite = await verificarEIncrementarRateLimit(pool, ipHash);
  if (!limite.permitido) {
    const resetEm = new Date();
    resetEm.setHours(24, 0, 0, 0);
    return new Response(
      JSON.stringify({ erro: "rate_limit", limite: limite.limite, reset_em: resetEm.toISOString() }),
      { status: 429, headers: headersJson() }
    );
  }

  const siteNormalizado = site ? (site.startsWith("http") ? site : `https://${site}`) : null;

  if (!siteNormalizado) {
    // Sem site: nada para o Módulo B auditar. Resposta final, sem polling —
    // client.ts só inicia polling quando site_resultado vem null.
    const r = await pool.query(
      `insert into auditorias (negocio, segmento, cidade, estado, site, status, site_resultado, ip_hash)
       values ($1, $2, $3, $4, null, 'na_fila', $5, $6)
       returning id, negocio, segmento, cidade, estado, site, status, site_resultado, indice_completo, laudo`,
      [negocio, segmento, cidade, estado, JSON.stringify({ avaliado: false, motivo: "sem_site" }), ipHash]
    );
    const auditoria: Auditoria = mapearAuditoria(r.rows[0]);
    return new Response(JSON.stringify(auditoria), { status: 200, headers: headersJson() });
  }

  const r = await pool.query(
    `insert into auditorias (negocio, segmento, cidade, estado, site, status, ip_hash)
     values ($1, $2, $3, $4, $5, 'parcial', $6)
     returning id, negocio, segmento, cidade, estado, site, status, site_resultado, indice_completo, laudo`,
    [negocio, segmento, cidade, estado, siteNormalizado, ipHash]
  );
  const linha = r.rows[0];
  const auditoria: Auditoria = mapearAuditoria(linha);

  // Dispara o worker em background. A origem vem do próprio request — funciona
  // em produção, deploy previews e `netlify dev`, sem depender de env var.
  // `waitUntil` garante que o fetch seja enviado antes do container congelar,
  // já que não damos await nele dentro do ciclo de resposta síncrona.
  const origem = new URL(req.url).origin;
  context.waitUntil(
    fetch(`${origem}/.netlify/functions/raiox-audit-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ auditoriaId: linha.id }),
    }).catch(() => {
      // Sem retry automático no v1: pior caso, a auditoria fica "parcial" até
      // o polling estourar as 20 tentativas (docs/02).
    })
  );

  return new Response(JSON.stringify(auditoria), { status: 200, headers: headersJson() });
};

export const config: Config = {
  path: "/api/raiox",
  method: "POST",
};
