// netlify/functions/lib/moduloB/sitemap.ts

import { XMLParser } from "fast-xml-parser";
import { fetchComLimites } from "../http";

export interface ResultadoSitemap {
  existe: boolean;
  urls: number | null;
  lastmod: string | null;
}

interface UrlEntry {
  lastmod?: string;
}

interface UrlSetXml {
  urlset?: { url?: UrlEntry | UrlEntry[] };
}

export async function checarSitemap(
  baseUrl: string,
  validarSsrf: (url: string) => Promise<URL>
): Promise<ResultadoSitemap> {
  try {
    const resp = await fetchComLimites(new URL("/sitemap.xml", baseUrl).toString(), { validarSsrf });
    if (!resp.ok) return { existe: false, urls: null, lastmod: null };

    const parser = new XMLParser({ ignoreAttributes: false });
    const doc = parser.parse(resp.texto) as UrlSetXml;
    const entradas = doc.urlset?.url;
    const lista = Array.isArray(entradas) ? entradas : entradas ? [entradas] : [];

    const lastmods = lista
      .map((e) => e.lastmod)
      .filter((d): d is string => typeof d === "string")
      .sort()
      .reverse();

    return { existe: true, urls: lista.length, lastmod: lastmods[0] ?? null };
  } catch {
    return { existe: false, urls: null, lastmod: null };
  }
}
