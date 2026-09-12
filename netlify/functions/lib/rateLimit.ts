// netlify/functions/lib/rateLimit.ts
//
// 3 consultas por ip_hash por dia — tech-spec §10, INSERT ... ON CONFLICT DO UPDATE.
// O teto vem de RATE_LIMIT_DIA (env var), por isso a checagem é aqui e não em
// CHECK de schema, que não pode referenciar variável de ambiente.

import type { Pool } from "pg";

export interface ResultadoRateLimit {
  permitido: boolean;
  consultas: number;
  limite: number;
}

export async function verificarEIncrementarRateLimit(pool: Pool, ipHash: string): Promise<ResultadoRateLimit> {
  const limite = Number(process.env.RATE_LIMIT_DIA ?? 3);

  const r = await pool.query<{ consultas: number }>(
    `insert into rate_limit (ip_hash, dia, consultas)
     values ($1, current_date, 1)
     on conflict (ip_hash, dia)
     do update set consultas = rate_limit.consultas + 1
     returning consultas`,
    [ipHash]
  );

  const consultas = r.rows[0].consultas;
  return { permitido: consultas <= limite, consultas, limite };
}
