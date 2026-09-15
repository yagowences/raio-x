// netlify/functions/raiox-status.ts
//
// GET /api/raiox/:id — polling. Front chama a cada 1.2s enquanto status === "parcial".

import type { Config, Context } from "@netlify/functions";
import { getPool } from "./lib/db";
import { mapearAuditoria } from "./lib/mapearAuditoria";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

export default async (_req: Request, context: Context) => {
  const id = context.params.id;
  const headers = { "content-type": "application/json", "access-control-allow-origin": CORS_ORIGIN };

  if (!id) {
    return new Response(
      JSON.stringify({ erro: "validacao", campo: "id", mensagem: "id ausente" }),
      { status: 400, headers }
    );
  }

  const pool = getPool();
  const r = await pool.query(
    `select id, negocio, segmento, cidade, estado, site, status, site_resultado, indice_completo, laudo
     from auditorias where id = $1`,
    [id]
  );

  if (r.rows.length === 0) {
    return new Response(JSON.stringify({ erro: "nao_encontrado" }), { status: 404, headers });
  }

  return new Response(JSON.stringify(mapearAuditoria(r.rows[0])), { status: 200, headers });
};

export const config: Config = {
  path: "/api/raiox/:id",
  method: "GET",
};
