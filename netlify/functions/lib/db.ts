// netlify/functions/lib/db.ts
//
// Conexão direta ao Postgres via pooler (Session pooler), não pela Data API.
// Desde abril de 2026 tabelas novas do public não são expostas à Data API por
// padrão (ver docs/02-contrato-de-dados.md) — @supabase/supabase-js bateria no
// mesmo bloqueio. Conexão pg direta ignora essa camada por completo.

import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL não configurada");
    }
    // max baixo: função serverless, cada container mantém poucas conexões;
    // o pooler do Supabase (Supavisor) já multiplexa por baixo.
    pool = new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000 });
  }
  return pool;
}
