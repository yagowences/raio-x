import { Auditoria, EntradaFormulario, EntradaLead } from "./tipos";
import { RaioxApi } from "./client";
import { fixtureCritico } from "./fixtures/critico";
import { fixtureMedio } from "./fixtures/medio";
import { fixtureBom } from "./fixtures/bom";
import { fixtureSemSite } from "./fixtures/semSite";
import { fixtureFila } from "./fixtures/fila";

// In-memory store for active mock audits
const store = new Map<string, { auditoria: Auditoria; consultCount: number }>();

export type CenarioKey = "critico" | "medio" | "bom" | "sem-site" | "fila";

export function sortearCenario(): CenarioKey {
  const rand = Math.random() * 100;
  if (rand < 55) return "critico";
  if (rand < 85) return "medio";
  if (rand < 95) return "bom";
  return "fila";
}

export function obterFixturePorCenario(cenario: CenarioKey): Auditoria {
  switch (cenario) {
    case "critico":
      return JSON.parse(JSON.stringify(fixtureCritico));
    case "medio":
      return JSON.parse(JSON.stringify(fixtureMedio));
    case "bom":
      return JSON.parse(JSON.stringify(fixtureBom));
    case "sem-site":
      return JSON.parse(JSON.stringify(fixtureSemSite));
    case "fila":
      return JSON.parse(JSON.stringify(fixtureFila));
  }
}

export function detectarCenarioURL(): CenarioKey | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const c = params.get("cenario") as CenarioKey;
  if (c && ["critico", "medio", "bom", "sem-site", "fila"].includes(c)) {
    return c;
  }
  return null;
}

export const mockApi: RaioxApi = {
  async iniciar(input: EntradaFormulario): Promise<Auditoria> {
    await new Promise((resolve) => setTimeout(resolve, 700));

    // Check URL or pick by input logic / random
    let cenario = detectarCenarioURL();
    if (!cenario) {
      if (!input.site || input.site.trim() === "") {
        cenario = "sem-site";
      } else if (input.segmento.toLowerCase().includes("food truck") || input.segmento.toLowerCase().includes("outro")) {
        cenario = "fila";
      } else {
        cenario = sortearCenario();
      }
    }

    const baseFixture = obterFixturePorCenario(cenario);

    // Apply user inputs to fixture while preserving corpus and analysis
    const auditoria: Auditoria = {
      ...baseFixture,
      auditoria_id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      negocio: {
        nome: input.negocio || baseFixture.negocio.nome,
        segmento: input.segmento || baseFixture.negocio.segmento,
        cidade: input.cidade || baseFixture.negocio.cidade,
        site: input.site ? (input.site.startsWith("http") ? input.site : `https://${input.site}`) : baseFixture.negocio.site,
      },
    };

    if (!input.site && cenario !== "fila") {
      auditoria.negocio.site = null;
      auditoria.site_resultado = { avaliado: false, motivo: "sem_site" };
      auditoria.indice = null;
    }

    // Save in store with consultCount = 0
    store.set(auditoria.auditoria_id, { auditoria, consultCount: 0 });

    // Initial response is returned
    return JSON.parse(JSON.stringify(auditoria));
  },

  async consultar(id: string): Promise<Auditoria> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const entry = store.get(id);
    if (!entry) {
      // Fallback
      return fixtureCritico;
    }

    entry.consultCount += 1;

    const base = entry.auditoria;

    if (base.status === "na_fila") {
      return JSON.parse(JSON.stringify(base));
    }

    // "consultar devolve status: 'parcial' nas duas primeiras chamadas e 'concluido' na terceira"
    if (entry.consultCount < 3) {
      const parcial: Auditoria = {
        ...base,
        status: "parcial",
      };
      return JSON.parse(JSON.stringify(parcial));
    }

    const final: Auditoria = {
      ...base,
      status: "concluido",
    };
    return JSON.parse(JSON.stringify(final));
  },

  async enviarLead(input: EntradaLead): Promise<{ ok: true }> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Verify consent
    if (!input.consentimento) {
      throw new Error("Consentimento é obrigatório");
    }
    return { ok: true };
  },
};
