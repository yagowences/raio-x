// netlify/functions/lib/ipHash.ts
//
// sha256(ip + IP_SALT). O IP cru nunca é gravado — tech-spec §3.2.

import { createHash } from "node:crypto";

export function hashIp(ip: string): string {
  const salt = process.env.IP_SALT;
  if (!salt) {
    throw new Error("IP_SALT não configurado");
  }
  return createHash("sha256").update(ip + salt).digest("hex");
}
