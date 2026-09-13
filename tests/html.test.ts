import { test } from "node:test";
import assert from "node:assert/strict";
import { analisarHtml } from "../netlify/functions/lib/moduloB/html";

test("caracteres do HTML estático contam só texto visível, não script nem JSON-LD", () => {
  // Caso real: o laudo da bellae.com.br dizia "HTML Estático: 25.612 caracteres",
  // somando o JSON-LD. Script inline grande também escondia SPA de página vazia.
  const json = JSON.stringify({ "@type": "BeautySalon", description: "x".repeat(2000) });
  const html = `<body><p>Olá</p><script type="application/ld+json">${json}</script><script>var a = "${"y".repeat(3000)}";</script><style>p{color:red}</style></body>`;
  assert.equal(analisarHtml(html).estatico.chars_bruto, 3);
});

test("SPA com root vazio e script inline grande continua suspeita de SPA", () => {
  const html = `<body><div id="root"></div><script>window.__DATA__ = "${"z".repeat(5000)}";</script><script src="a.js"></script><script src="b.js"></script><script src="c.js"></script></body>`;
  assert.equal(analisarHtml(html).estatico.suspeita_spa, true);
});
