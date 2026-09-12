import { Auditoria, EntradaFormulario, EntradaLead } from "./tipos";
import { mockApi } from "./mock";

// api/client.ts — o único arquivo que muda no dia da integração
//
// USE_MOCK detecta o ambiente pelo hostname — sem env var (P5: nada em src/ lê
// process.env ou import.meta.env). Em localhost/127.0.0.1 (npm run dev) sempre
// usa mock; qualquer deploy real (Netlify) usa a API de verdade automaticamente.
// O seletor `dev:` no rodapé continua funcionando em qualquer um dos dois casos,
// porque ele nunca chama `api` — troca a fixture direto no estado do App.
export const USE_MOCK =
  typeof window === "undefined" ||
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export interface RaioxApi {
  iniciar(input: EntradaFormulario): Promise<Auditoria>;
  consultar(id: string): Promise<Auditoria>;
  enviarLead(input: EntradaLead): Promise<{ ok: true }>;
}

interface CorpoErro {
  erro?: string;
  campo?: string;
  mensagem?: string;
}

async function tratarResposta<T>(resp: Response): Promise<T> {
  const dados = (await resp.json().catch(() => ({}))) as CorpoErro | T;
  if (!resp.ok) {
    const erro = dados as CorpoErro;
    // TODO: 429 (rate_limit) chega aqui como Error genérico — App.tsx ainda não
    // diferencia esse caso do de conexão para rotear direto à tela de limite.
    throw new Error(erro.mensagem || erro.erro || `erro ${resp.status}`);
  }
  return dados as T;
}

const realApi: RaioxApi = {
  async iniciar(input: EntradaFormulario): Promise<Auditoria> {
    const resp = await fetch("/api/raiox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return tratarResposta<Auditoria>(resp);
  },
  async consultar(id: string): Promise<Auditoria> {
    const resp = await fetch(`/api/raiox/${id}`);
    return tratarResposta<Auditoria>(resp);
  },
  async enviarLead(input: EntradaLead): Promise<{ ok: true }> {
    const resp = await fetch("/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return tratarResposta<{ ok: true }>(resp);
  },
};

export const api: RaioxApi = USE_MOCK ? mockApi : realApi;
