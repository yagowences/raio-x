// netlify/functions/lead.ts
//
// POST /api/lead — captura de contato. Mesmo endpoint serve o CTA do resultado
// e a fila, diferenciados por `origem` (tech-spec §4.3/§4.4).

import { z } from "zod";
import type { Config } from "@netlify/functions";
import { getPool } from "./lib/db";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const EntradaSchema = z
  .object({
    auditoria_id: z.string().uuid(),
    nome: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(200).optional(),
    whatsapp: z.string().trim().min(8).max(30).optional(),
    consentimento: z.literal(true),
    origem: z.enum(["resultado", "fila"]).optional(),
  })
  .refine((d) => Boolean(d.email) || Boolean(d.whatsapp), { message: "informe e-mail ou whatsapp" });

function headersJson(): HeadersInit {
  return { "content-type": "application/json", "access-control-allow-origin": CORS_ORIGIN };
}

export default async (req: Request) => {
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

  const { auditoria_id, nome, email, whatsapp, origem } = validado.data;
  const pool = getPool();

  await pool.query(
    `insert into leads (auditoria_id, nome, email, whatsapp, consentimento, origem)
     values ($1, $2, $3, $4, true, $5)`,
    [auditoria_id, nome, email ?? null, whatsapp ?? null, origem ?? "resultado"]
  );

  // Webhook para n8n fica fora do v1 — D6/D7 em docs/README.md já resolvem a
  // leitura via editor de tabela do Supabase. Quando existir, entra aqui, sem
  // falhar a requisição se o webhook der erro (o lead já está gravado).

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: headersJson() });
};

export const config: Config = {
  path: "/api/lead",
  method: "POST",
};
