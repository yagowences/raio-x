import { test } from "node:test";
import assert from "node:assert/strict";
import { analisarNap } from "../netlify/functions/lib/moduloB/nap";
import { extrairJsonLd } from "../netlify/functions/lib/moduloB/jsonld";

function nap(html: string) {
  return analisarNap(html, extrairJsonLd(html));
}

function jsonLd(obj: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

test("números dentro de <script> não viram telefone nem CEP", () => {
  // Caso real: bellaeacessorios.com.br — nome de arquivo de imagem num script
  // ("whatsapp-image-...-7884491134e4...") virava telefone "18-788449113" e CEP.
  const html = `<html><head><title>Loja</title></head><body>
    <p>Acessórios femininos</p>
    <script>var img = "/stores/007/821/219/products/whatsapp-image-2026-06-01-at-15-31-18-7884491134e44e67.webp";</script>
  </body></html>`;
  const r = nap(html);
  assert.equal(r.telefone, null);
  assert.equal(r.cep, null);
  assert.equal(r.endereco, false);
});

test("sequência de 8 dígitos sem hífen nem rótulo CEP não é CEP", () => {
  const r = nap(`<body><p>Pedido 78844911 confirmado</p></body>`);
  assert.equal(r.cep, null);
  assert.equal(r.endereco, false);
});

test("CEP com hífen no texto visível conta como endereço", () => {
  const r = nap(`<body><p>Rua 261, Setor Universitário, Goiânia - GO, 74610-250</p></body>`);
  assert.equal(r.cep, "74610-250");
  assert.equal(r.endereco, true);
});

test("horário declarado em BeautySalon.openingHoursSpecification conta", () => {
  // Caso real: bellae.com.br — o tipo BeautySalon não era reconhecido como negócio.
  const html = `<body>${jsonLd({
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: "Bellae",
    telephone: "+5562985951069",
    address: { "@type": "PostalAddress", streetAddress: "Rua 261", postalCode: "74610-250" },
    openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday"], opens: "09:00", closes: "19:00" },
  })}</body>`;
  const r = nap(html);
  assert.equal(r.horario, true);
  assert.equal(r.telefone, "+5562985951069");
  assert.equal(r.endereco, true);
});

test("horário declarado como openingHours (texto) conta", () => {
  const r = nap(`<body>${jsonLd({ "@type": "HairSalon", name: "X", openingHours: "Mo-Fr 09:00-19:00" })}</body>`);
  assert.equal(r.horario, true);
});

test("negócio dentro de @graph é encontrado", () => {
  const html = `<body>${jsonLd({
    "@context": "https://schema.org",
    "@graph": [{ "@type": "WebSite", name: "X" }, { "@type": "Dentist", name: "X", telephone: "(62) 3212-1234" }],
  })}</body>`;
  assert.equal(nap(html).telefone, "(62) 3212-1234");
});

test("link tel: conta como telefone rastreável", () => {
  const r = nap(`<body><a href="tel:+556232121234">Ligue para nós</a></body>`);
  assert.equal(r.telefone, "+556232121234");
});

test("pessoa identificada no schema (nome + cargo) conta como página do responsável", () => {
  // Caso real: bellae.com.br — Person "Fernanda Figueira Guimarães", Biomédica Esteta,
  // ligada ao BeautySalon por `employee`, num site de página única com seção #sobre.
  const html = `<body><section id="sobre"><h2>Quem cuida de você</h2></section>${jsonLd([
    { "@type": "BeautySalon", name: "Bellae", employee: { "@id": "#fernanda" } },
    { "@type": "Person", "@id": "#fernanda", name: "Fernanda Figueira Guimarães", jobTitle: "Biomédica Esteta" },
  ])}</body>`;
  assert.equal(nap(html).pagina_autor, true);
});

test("seção âncora #sobre em site de página única conta como página do responsável", () => {
  const r = nap(`<body><a href="#sobre">Sobre</a><section id="sobre"><p>Somos a equipe X.</p></section></body>`);
  assert.equal(r.pagina_autor, true);
});

test("sem link, seção nem pessoa no schema, não há página do responsável", () => {
  const r = nap(`<body><p>Produtos</p><a href="/contato">Contato</a></body>`);
  assert.equal(r.pagina_autor, false);
});
