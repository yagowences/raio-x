import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairJsonLd, analisarDadosEstruturados } from "../netlify/functions/lib/moduloB/jsonld";

function dados(obj: unknown) {
  return analisarDadosEstruturados(extrairJsonLd(`<script type="application/ld+json">${JSON.stringify(obj)}</script>`));
}

test("blocos dentro de @graph (Yoast, Rank Math) são lidos um a um", () => {
  const r = dados({ "@context": "https://schema.org", "@graph": [{ "@type": "WebPage" }, { "@type": "LocalBusiness", name: "X" }] });
  assert.deepEqual(r.tipos.sort(), ["LocalBusiness", "WebPage"]);
});

test("subtipo de LocalBusiness herda os campos obrigatórios de LocalBusiness", () => {
  const r = dados({ "@type": "BeautySalon", name: "X", address: { streetAddress: "Rua 1" } });
  assert.deepEqual(r.campos_faltando, { BeautySalon: ["telephone", "openingHoursSpecification"] });
});

test("openingHours em texto satisfaz o campo de horário", () => {
  const r = dados({ "@type": "LocalBusiness", address: {}, telephone: "1", openingHours: "Mo-Fr 09:00-18:00" });
  assert.deepEqual(r.campos_faltando, {});
});
