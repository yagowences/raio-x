# 05 — Cenários e fixtures

As cinco fixtures em `src/api/fixtures/` são o produto inteiro para quem assiste a
uma demonstração. Elas não são dado de teste: são o argumento comercial. Uma fixture
incoerente é um laudo indefensável na frente de um cliente.

Este documento define o que cada cenário existe para provar e as invariantes que
todas têm de respeitar. Depende de `03-regras-de-negocio.md`.

## Como selecionar um cenário

- Query string: `?cenario=critico` (aceita `critico`, `medio`, `bom`, `sem-site`, `fila`)
- Seletor `dev:` no rodapé, incluindo `rate-limit`
- Sorteio, quando nenhum dos dois é usado: 55% crítico, 30% médio, 10% bom, 5% fila

A distribuição do sorteio reflete a realidade esperada do mercado, e é isso que a
torna útil: quem abre a ferramenta sem parâmetro vê, na maior parte das vezes, o
cenário que a maioria dos visitantes reais vai receber.

## Os cinco cenários

### `critico` — o cenário que vende

Clínica Vitalis. 0 menções em 15 execuções, 1 incerta. Bloqueio silencioso ativo,
teto de 30 aplicado.

Existe para provar o achado principal do produto: **robots.txt liberado e HTTP 403
na prática.** O dono não sabe, ninguém contou, e o conserto é uma regra de firewall.

Prova também: `posicao_media: null` renderizado como "—" e não como zero; a linha de
incertos aparecendo; `cliente_presente: false` em doctoralia.com.br contra `null` em
tripadvisor.com.br, que a interface tem de tratar de formas diferentes.

### `medio` — o meio-termo

Estética Harmonize. 4 menções em 15 (27%), posição média 3,2. Sem bloqueio.

Existe para provar que a ferramenta produz laudo útil para quem **já aparece**, mas
mal. É o cenário mais difícil de escrever bem: sem catástrofe para apontar, o texto
tende a escorregar para o elogio de cortesia, que `04-regras-de-copy.md` proíbe.

### `bom` — o teste de honestidade

Clínica Bella Vitta. 11 menções em 15 (73%), posição média 1,6.

Existe para provar que o laudo **não inventa problema** quando não há problema
grande. É o cenário que testa a disciplina da copy: aqui é onde "parabéns pelo seu
perfil" quer aparecer, e não pode.

Bella Vitta é a concorrente número 1 dos outros cenários. A escolha é boa — mostra a
mesma disputa dos dois lados.

### `sem-site` — o gancho

Estética Harmonize, sem site informado. `indice: null`,
`site_resultado: { avaliado: false, motivo: "sem_site" }`.

Existe para provar a degradação mais comum: sem site, o Módulo B não roda, **não há
polling**, e o Módulo A sozinho sustenta a tela. O convite para informar o site é o
gancho, e ele é honesto porque o índice realmente não pode ser calculado.

### `fila` — a etapa gratuita

Burger Gourmet Truck. `corpus.disponivel: false`, `status: "na_fila"`,
`visibilidade: null`, `site_resultado.avaliado: true`.

**Este não é um cenário de degradação.** É a configuração do produto que atende
qualquer negócio, em qualquer segmento, em qualquer cidade, sem corpus e sem
investimento prévio — e é a mais importante comercialmente por isso. Ver D6 e D7 em
`README.md`, e a seção "Com site, sem corpus" de `03-regras-de-negocio.md`.

O que a etapa gratuita entrega:

| | |
|---|---|
| Índice | **sobre 75**, renormalizado sem `autoridade_externa` |
| Pilares | 5 dos 6 — `tecnica`, `local_nap`, `estrutura`, `autoria_onpage`, `dados_estruturados` |
| Gatilhos aplicáveis | **12 dos 14**, os de `requer_corpus: false` |
| Teto de 30 | vale integralmente |
| Custo | 9 fetches HTTP + 1 julgamento no free tier |

O que ela não entrega, e por isso a fila existe como acréscimo: menções,
concorrentes, domínios do nicho e o pilar `autoridade_externa`. A promessa é
concreta — previsão em horas, não "em breve" — e a captura acontece **antes** do
resultado.

## Invariantes

Toda fixture tem de satisfazer todas. Hoje a verificação das fixtures é a olho: o
`npm test` cobre o Módulo B, as notas, o teto e o laudo, mas ainda não as invariantes.

### Aritmética

1. `taxa_mencao` = `mencoes / execucoes_validas`, com duas casas
2. `mencoes` do topo = soma de `mencoes` das cinco perguntas
3. `incertas` do topo = soma de `incertas` das cinco perguntas
4. `posicoes[]` de cada pergunta tem exatamente `mencoes` elementos
5. `execucoes` = 3 em toda pergunta (princípio P2)
6. `posicao_media` é `null` se e somente se `mencoes === 0`
7. `indice.valor` = `Σ(peso × nota)`, e depois `min(bruto, 30)` se houver teto
8. `teto_aplicado` é não-nulo se e somente se `tecnica.bloqueio_silencioso === true`
   ou algum robô de gravidade crítica tem `permitido: false`
9. `indice` é `null` se e somente se `negocio.site` é `null`

### Coerência entre laudo e dado

10. Toda `recomendacao.dado` cita valor que existe em outro ponto da mesma fixture
11. Quando o teto age, a recomendação de prioridade 1 é sobre o bloqueio
12. `recomendacao.pilar` corresponde a um `id` de `config/pesos.json`
13. `diagnostico` não nomeia motor fora de `corpus.motores`

### Coerência entre fixtures do mesmo nicho

As quatro fixtures de estética em Goiânia compartilham o mesmo `gerado_em`
(`2026-08-12T03:00:00Z`), logo compartilham o mesmo corpus.

14. Uma entidade citada em mais de uma fixture tem o mesmo `mencoes` e a mesma
    `posicao_media` em todas

### Etapa gratuita

15. Se `corpus.disponivel === false` e `site_resultado.avaliado === true`, então
    `indice` **não** é `null`, e seu denominador é 75
16. Nenhum pilar de `indice.pilares` tem `fonte: "modulo_a"` quando `visibilidade` é `null`
17. Nenhuma recomendação com `requer_corpus: true` aparece num laudo sem corpus
18. `diagnostico` não cita menção, posição nem concorrente quando `visibilidade` é `null`

## Incoerências conhecidas

**I-1, I-3, I-4, I-5 e I-6 foram corrigidas** na migração para os seis pilares.
Ficam registradas abaixo com o antes e o depois, porque a decisão de cada uma
continua valendo para quem escrever a próxima fixture.

**I-2 continua aberta**, e mudou de forma. Leia antes de mexer no `critico`.

### I-1 · O índice não fechava com os próprios pilares — CORRIGIDA

Invariante 7 estava violada em duas das três fixtures com índice. Toda nota foi
reescrita a partir dos dados que a própria fixture carrega, e agora fecha:

| Fixture | Denominador | Bruto | `indice.valor` |
|---|---:|---:|---:|
| `critico` | 100 | 20,64 | 20 |
| `medio` | 100 | 53,98 | 54 |
| `bom` | 100 | 89,24 | 89 |
| `fila` | **75** | 67,49 | 67 |

Conta de `medio`, para conferência:
`(25×34 + 10×20 + 25×76 + 20×82 + 12×62 + 8×8) / 100 = 5.398 / 100 = 53,98`

As notas não são arbitrárias — cada uma sai do dado ao lado. `critico` tira 5 em
`dados_estruturados` porque `presente: false`; tira 55 em `local_nap` porque tem
nome, telefone e endereço mas não tem CEP nem horário.

### I-2 · Nenhuma fixture demonstra o teto — ABERTA

Antes da migração, o bruto de `critico` dava exatamente 30,00 contra um teto de 30.
Depois, com as notas honestas, dá **20,64** — agora passa **por baixo** do teto.
`teto_aplicado` ficou `null`, corretamente.

**A causa é de conteúdo, não de aritmética.** O site do `critico` é ruim em todos os
pilares: sem h1, sem sitemap, sem schema, `suspeita_spa`, 2 de 14 imagens com alt.
Não existe conjunto honesto de notas que leve esse site acima de 30. O teto nunca
vai morder ali.

O teto existe para dizer *"seu site é bom, mas a IA não consegue lê-lo"*. Isso exige
um site **bem construído e bloqueado** — que é, aliás, o caso realista: quem tem
firewall ou WAF costuma ter site com alguma infraestrutura. Três saídas, e a escolha
é de produto:

1. **Reescrever os dados de site do `critico`** para bem-construído-porém-bloqueado.
   O cenário passa a demonstrar o teto e continua com 0 menções — a narrativa fica
   mais forte, porque o motivo da invisibilidade vira o bloqueio, e não incompetência
2. **Bloquear o `medio`**, cujo site já é decente (sitemap, sem SPA, PSI 68). Custa o
   propósito atual do cenário, que é o meio-termo sem catástrofe
3. **Aceitar** que o teto não é demonstrável e removê-lo da pauta da demonstração

Enquanto não se decide, o teto está implementado e testado em código — só não há
fixture que o exercite.

### I-3 · Bella Vitta tinha dois valores — CORRIGIDA

Invariante 14 estava violada: a mesma entidade, no mesmo corpus, aparecia como 9/1,4
onde era concorrente e 11/1,6 onde era cliente. Agora é **11 menções, posição 1,6**
em todas as fixtures.

`share_of_voice` foi recalculado junto, porque o total de menções mudou:

| Fixture | Menções do cliente | Total | `share_of_voice` |
|---|---:|---:|---:|
| `critico` | 0 | 30 | 0 |
| `medio`, `sem-site` | 4 | 34 | 0,12 |
| `bom` | 11 | 30 | 0,37 |

A copy que citava "seus concorrentes, 9" foi reescrita. Número em texto que não bate
com a tabela ao lado é o erro mais barato de cometer e o mais caro numa reunião.


### I-4 · `conteudo` tinha duas chaves em vez de seis — CORRIGIDA

Divergência D-C. As fixtures traziam `clareza_servicos` e `provas_sociais`; agora
trazem os seis eixos da spec §4.5, com nota de 0 a 10.

`tipos.ts` deixou de aceitar chave livre: `conteudo` é `Record<EixoConteudo, Nota>`,
com `EixoConteudo` fechado nos seis. O compilador agora pega a próxima divergência
sozinho — que é melhor do que este documento pegar.

### I-5 · `familia` trazia fabricante em vez de função — CORRIGIDA

Divergência D-D. O mapeamento aplicado:

| UA | Era | Virou | Por quê |
|---|---|---|---|
| `GPTBot` | `"OpenAI"` | `"treinamento"` | alimenta treinamento de modelo |
| `PerplexityBot` | `"Perplexity"` | `"recuperacao"` | busca para responder na hora |
| `Googlebot` | `"Google"` | `"busca"` | indexação de busca |

`tipos.ts` fechou o tipo em `Familia`. Isso devolve ao laudo um argumento que estava
perdido: bloquear treinamento é decisão de negócio legítima; bloquear recuperação é
tiro no pé, porque é o robô que traz cliente agora.

### I-6 · A etapa gratuita descartava índice e laudo — CORRIGIDA

Invariante 15 estava violada: `fila.ts` trazia `indice: null` e `laudo: null` apesar
de já carregar `tecnica`, `estrutura`, `nap`, `dados_estruturados`, `conteudo` e
`psi_mobile: 74`.

Agora entrega **índice 67 sobre 75** e duas recomendações. Só duas, e isso é
correto: contra os dados dessa fixture, apenas `sem_pagina_autor` e
`schema_incompleto` disparam. Não há bloqueio (200 nos três robôs), há sitemap, não
há `suspeita_spa`, o PSI é 74 e 8 de 10 imagens têm alt. **Inventar uma terceira
recomendação para preencher a lista seria o mesmo que inventar dado.**

`Fila.tsx` passou de 1 para 5 componentes: `Indice`, `Metrica`, `BlocoBloqueio`,
`AuditoriaSite` e `Recomendacao`. `BlocoBloqueio` era o mais grave dos ausentes —
sem ele, um robô crítico com 403 num nicho não mapeado passava despercebido.

## Ao criar ou alterar uma fixture

1. Decida o que o cenário existe para provar. Sem isso, ele vira ruído
2. Rode as invariantes 1 a 18 à mão
3. Confira o índice com calculadora, contra `config/pesos.json`
4. Leia o laudo em voz alta contra `04-regras-de-copy.md`
5. `npm run lint`
