import { Auditoria, EntradaFormulario, EntradaLead } from "./tipos";
import { mockApi } from "./mock";

// api/client.ts — o único arquivo que muda no dia da integração
export const USE_MOCK = true;

export interface RaioxApi {
  iniciar(input: EntradaFormulario): Promise<Auditoria>;
  consultar(id: string): Promise<Auditoria>;
  enviarLead(input: EntradaLead): Promise<{ ok: true }>;
}

const realApi: RaioxApi = {
  iniciar(_input: EntradaFormulario): Promise<Auditoria> {
    return Promise.reject(new Error("backend não implementado"));
  },
  consultar(_id: string): Promise<Auditoria> {
    return Promise.reject(new Error("backend não implementado"));
  },
  enviarLead(_input: EntradaLead): Promise<{ ok: true }> {
    return Promise.reject(new Error("backend não implementado"));
  },
};

export const api: RaioxApi = USE_MOCK ? mockApi : realApi;

