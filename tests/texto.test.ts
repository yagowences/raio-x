import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairTextoParaJulgamento, acharPaginaInterna, juntarComPaginaInterna } from "../netlify/functions/lib/moduloB/texto";

test("página interna do responsável: primeiro link de sobre/quem-somos do mesmo domínio", () => {
  // spec §6.4: o julgamento lê a home e uma página interna. Caso real:
  // bellaeacessorios.com.br tem /quem-somos/, e a home sozinha não diz quem é a marca.
  const html = `<body>
    <a href="https://instagram.com/sobre">Insta</a>
    <a href="#sobre">Sobre</a>
    <a href="/quem-somos/">Quem somos</a>
    <a href="/sobre">Sobre</a>
  </body>`;
  assert.equal(acharPaginaInterna(html, "https://www.loja.com.br/"), "https://www.loja.com.br/quem-somos/");
});

test("sem link interno de sobre/quem-somos, não há página interna", () => {
  const html = `<body><a href="#sobre">Sobre</a><a href="https://outro.com/quem-somos">x</a><a href="/contato">Contato</a></body>`;
  assert.equal(acharPaginaInterna(html, "https://www.loja.com.br/"), null);
});

test("texto da página interna entra depois da home, com separador que diz de onde veio", () => {
  const t = juntarComPaginaInterna("# Home\nTexto da home.", "/quem-somos/", "# Quem somos\nFundada por Ana Lima, ourives.");
  assert.equal(t, "# Home\nTexto da home.\n\n=== Página interna: /quem-somos/ ===\n# Quem somos\nFundada por Ana Lima, ourives.");
  assert.equal(juntarComPaginaInterna("# Home", "/sobre", ""), "# Home");
});

test("cabeçalho, menu, carrinho e aviso de cookies não chegam ao julgamento", () => {
  // Caso real: bellaeacessorios.com.br — o texto enviado começava com
  // "Login / Cadastre-se 0 Carrinho (0) R$0,00 () x Adicionado ao carrinho!".
  const html = `<body>
    <header><a href="/login">Login / Cadastre-se</a></header>
    <nav><a href="/aneis">ANÉIS</a><a href="/brincos">BRINCOS</a></nav>
    <div class="js-cart-drawer"><span>Carrinho (0)</span><span>R$0,00</span><p>Adicionado ao carrinho!</p></div>
    <div id="cookie-banner"><p>Usamos cookies para melhorar sua experiência.</p></div>
    <main><h1>Joias em moissanite</h1><p>Cada peça tem certificado de autenticidade.</p></main>
    <footer>CNPJ 00.000.000/0001-00</footer>
  </body>`;
  const t = extrairTextoParaJulgamento(html);
  assert.match(t, /certificado de autenticidade/);
  for (const lixo of ["Login", "ANÉIS", "Carrinho", "R$0,00", "cookies", "CNPJ"]) {
    assert.ok(!t.includes(lixo), `"${lixo}" vazou para o texto: ${t}`);
  }
});

test("título vira linha com # e item de lista vira linha com -", () => {
  // Sem isso, pedíamos para julgar escaneabilidade e perguntas nos títulos
  // de um texto com a estrutura apagada.
  const t = extrairTextoParaJulgamento(
    `<body><h2>Quanto custa o botox?</h2><p>A partir de R$ 900.</p><ul><li>Testa</li><li>Pés de galinha</li></ul></body>`
  );
  assert.match(t, /^## Quanto custa o botox\?$/m);
  assert.match(t, /^A partir de R\$ 900\.$/m);
  assert.match(t, /^- Testa$/m);
  assert.match(t, /^- Pés de galinha$/m);
});

test("página longa é amostrada por seção: todos os títulos aparecem, dentro do limite", () => {
  const secoes = Array.from({ length: 10 }, (_, i) => `<h2>Seção ${i + 1}</h2><p>${"conteúdo ".repeat(600)}</p>`).join("");
  const t = extrairTextoParaJulgamento(`<body>${secoes}</body>`, 12000);
  assert.ok(t.length <= 12000, `texto com ${t.length} caracteres`);
  for (let i = 1; i <= 10; i++) assert.match(t, new RegExp(`^## Seção ${i}$`, "m"));
});

test("resposta de FAQ recolhida (aria-hidden / hidden) chega ao julgamento", () => {
  // Caso real: bellae.com.br — 5.168 caracteres de respostas do FAQ estavam em
  // acordeões com aria-hidden, e o modelo concluiu que o guia tinha "títulos sem
  // conteúdo". O robô lê o HTML, não o estado do acordeão.
  const t = extrairTextoParaJulgamento(`<body><main>
    <h3>Dói fazer botox?</h3><div aria-hidden="true"><p>A aplicação usa agulha fina e dura 15 minutos.</p></div>
    <h3>Quanto tempo dura?</h3><div hidden><p>De 4 a 6 meses.</p></div>
  </main></body>`);
  assert.match(t, /agulha fina e dura 15 minutos/);
  assert.match(t, /De 4 a 6 meses/);
});

test("card de produto dentro de <form> continua no texto", () => {
  // Caso real: bellaeacessorios.com.br (Nuvemshop) — cada produto fica num
  // <form class="js-product-form">, e a regra de remover formulário apagava a vitrine.
  const t = extrairTextoParaJulgamento(
    `<body><main><form class="js-product-form"><h3>Anel solitário moissanite</h3><p>R$ 289,90 em até 4x</p></form></main></body>`
  );
  assert.match(t, /Anel solitário moissanite/);
  assert.match(t, /R\$ 289,90/);
});

test("cabeçalho com o logo em h1 sai, mas o h1 fica", () => {
  // Caso real: bellaeacessorios.com.br — o único h1 é o logo, dentro do <header>
  // com login e categorias; proteger o cabeçalho inteiro deixava o menu no texto.
  const t = extrairTextoParaJulgamento(`<body>
    <header><h1>Bellae Acessórios</h1><a href="/login">Login / Cadastre-se</a><ul><li>ANÉIS</li><li>BRINCOS</li></ul></header>
    <div class="vitrine"><h2>Destaques</h2><p>Brinco ponto de luz</p></div>
  </body>`);
  assert.match(t, /^# Bellae Acessórios$/m);
  assert.match(t, /Brinco ponto de luz/);
  for (const lixo of ["Login", "ANÉIS", "BRINCOS"]) assert.ok(!t.includes(lixo), `"${lixo}" vazou: ${t}`);
});

test("elementos em linha vizinhos não grudam as palavras", () => {
  // Caso real: bellae.com.br — "Estética AvançadaSinfonia de Beleza & SaúdeHair Design".
  const t = extrairTextoParaJulgamento(
    `<body><main><div><span>Estética Avançada</span><span>Sinfonia de Beleza &amp; Saúde</span><a href="#">Hair Design</a></div></main></body>`
  );
  assert.equal(t, "Estética Avançada Sinfonia de Beleza & Saúde Hair Design");
});

test("espaço que as seções curtas não usam vai para as longas", () => {
  // Caso real: bellae.com.br tem 13 mil caracteres visíveis em 40 seções curtas e
  // algumas longas; a fatia igual por seção mandava só 6.223 com limite de 12 mil.
  const curtas = Array.from({ length: 9 }, (_, i) => `<h2>Curta ${i + 1}</h2><p>Texto breve da seção.</p>`).join("");
  const longa = `<h2>Longa</h2><p>${"detalhe ".repeat(3000)}</p>`;
  const t = extrairTextoParaJulgamento(`<body>${curtas}${longa}</body>`, 12000);
  assert.ok(t.length <= 12000, `texto com ${t.length} caracteres`);
  assert.ok(t.length >= 11500, `desperdiçou limite: só ${t.length} caracteres`);
  for (let i = 1; i <= 9; i++) assert.match(t, new RegExp(`^## Curta ${i}\\nTexto breve da seção\\.$`, "m"));
});

test("título vazio não vira linha de #", () => {
  const t = extrairTextoParaJulgamento(`<body><main><h3>  </h3><p>Sua compra é segura</p></main></body>`);
  assert.equal(t, "Sua compra é segura");
});

test("página curta passa inteira, sem corte", () => {
  const t = extrairTextoParaJulgamento(`<body><main><p>Atendemos de segunda a sexta.</p></main></body>`);
  assert.equal(t, "Atendemos de segunda a sexta.");
});
