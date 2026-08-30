// analytics.ts — Instrumentação segura sem envio de PII (nome, email, whatsapp, url)

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type AnalyticsEvent =
  | { evento: "raiox_iniciado"; params: { segmento: string; cidade: string; tem_site: boolean } }
  | { evento: "raiox_resultado"; params: { taxa_mencao: number; indice: number | null; multiplicador?: number } }
  | { evento: "raiox_scroll_recomendacoes"; params?: Record<string, never> }
  | { evento: "raiox_lead"; params: { variante_cta: string } }
  | { evento: "raiox_fila"; params: { segmento: string } }
  | { evento: "raiox_rate_limit"; params?: Record<string, never> };

export function track<T extends AnalyticsEvent>(evento: T["evento"], params?: T["params"]) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", evento, params || {});
  } else {
    // Fallback seguro em desenvolvimento
    console.info(`[Analytics] ${evento}`, params || {});
  }
}
