// netlify/functions/lib/http.ts
//
// fetch com timeout, limite de redirecionamentos e teto de tamanho de resposta.
// Tech-spec §6.1: timeout 4s por fetch, máx 3 redirects, corta acima de 2MB.
//
// Redirect é seguido manualmente (não `redirect: "follow"`) porque cada salto
// precisa passar pela validação de SSRF de novo — um site pode redirecionar
// para um IP interno, e isso tem que ser barrado tanto quanto a URL original.

const TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

export interface RespostaHttp {
  status: number;
  url: string; // url final, após os redirects seguidos
  texto: string; // corpo, truncado em 2MB
  ok: boolean;
}

export interface OpcoesFetch {
  userAgent?: string;
  /** Chamado antes de CADA hop, inclusive redirects. Lança se a URL não for segura. */
  validarSsrf?: (url: string) => Promise<URL>;
}

async function lerComTeto(resp: Response, teto: number): Promise<string> {
  const reader = resp.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let texto = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > teto) {
      await reader.cancel();
      break;
    }
    texto += decoder.decode(value, { stream: true });
  }
  return texto;
}

export async function fetchComLimites(url: string, opcoes: OpcoesFetch = {}): Promise<RespostaHttp> {
  let atual = url;

  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    if (opcoes.validarSsrf) {
      await opcoes.validarSsrf(atual);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(atual, {
        redirect: "manual",
        signal: controller.signal,
        headers: opcoes.userAgent ? { "User-Agent": opcoes.userAgent } : undefined,
      });
    } finally {
      clearTimeout(timer);
    }

    const local = resp.headers.get("location");
    if (resp.status >= 300 && resp.status < 400 && local) {
      atual = new URL(local, atual).toString();
      continue;
    }

    const texto = await lerComTeto(resp, TAMANHO_MAXIMO);
    return { status: resp.status, url: atual, texto, ok: resp.status >= 200 && resp.status < 300 };
  }

  throw new Error(`muitos redirecionamentos a partir de ${url}`);
}
