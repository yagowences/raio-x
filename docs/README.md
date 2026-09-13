# Documentação — Raio-X de IA

Esta pasta governa o desenvolvimento do protótipo visual. Não é descrição do que o
código faz hoje; é definição do que ele tem de fazer. Onde o código divergir daqui,
o código está errado — com uma exceção honesta, listada na seção "Divergências
abertas" de `02-contrato-de-dados.md`, que registra o que ainda não foi conciliado.

## Ordem de leitura

| Arquivo | Responde |
|---|---|
| [01-principios-e-escopo.md](01-principios-e-escopo.md) | O que nunca pode ser violado, e onde o protótipo termina |
| [02-contrato-de-dados.md](02-contrato-de-dados.md) | Que dado entra em cada tela, e o que ainda diverge da spec |
| [03-regras-de-negocio.md](03-regras-de-negocio.md) | Como métrica, índice e laudo são calculados |
| [04-regras-de-copy.md](04-regras-de-copy.md) | Como o texto é escrito |
| [05-cenarios-e-fixtures.md](05-cenarios-e-fixtures.md) | Os cinco cenários e as invariantes de cada um |
| [ref/tech-spec-v1.md](ref/tech-spec-v1.md) | A tech-spec do produto final, na íntegra |

Quem for mexer em regra de negócio lê 01, 02 e 03. Quem for mexer em texto lê 04.
Quem for mexer em fixture lê 05 — e 05 depende de 03.

## Hierarquia de autoridade

1. `ref/tech-spec-v1.md` decide **produto**. Se o dono do produto mudar de ideia,
   muda ali primeiro.
2. Os documentos 01–05 decidem **implementação do protótipo**. Onde a tech-spec
   descreve o produto final e o protótipo precisa de uma versão reduzida, a decisão
   está aqui e é explícita.
3. `config/pesos.json` e `config/gatilhos.json` decidem **valores**. Nenhum peso,
   teto ou texto de recomendação vive dentro de arquivo `.ts`.

O item 3 é a decisão T7 da tech-spec. O motivo é comparabilidade: quando os pesos
mudarem, tem que ser possível dizer qual versão gerou qual laudo.

## Decisões travadas nesta rodada

| # | Decisão | Por quê |
|---|---|---|
| D1 | O protótipo é front puro, com mocks. Nenhum backend neste repositório | A tech-spec põe todo acesso externo em Netlify Functions |
| D2 | Nenhum arquivo em `src/` lê variável de ambiente | Princípio P5. Verificável por grep; é um teste, não um estilo |
| D3 | `pesos.json` e `gatilhos.json` nascem versionados agora, antes do backend | O backend herda os arquivos prontos, e as fixtures ganham um alvo objetivo |
| D4 | `frequencia` em `dominios_do_nicho` é **contagem absoluta**, não proporção | É como as fixtures já estão. O corte de 40% da spec §8.1 vira `frequencia / execucoes_validas` |
| D5 | `gatilhos.json` está versionado mas **não ligado** ao código | Ligar o laudo é refator maior; o índice vem primeiro |
| D6 | Nicho sem corpus é **etapa gratuita**, não degradação: índice sobre 75 e laudo com os gatilhos aplicáveis | É a única configuração que atende qualquer negócio sem investimento prévio. Descartar índice e laudo ali jogava fora 75 dos 100 pontos e 12 dos 14 gatilhos |
| D7 | A etapa gratuita **mantém** a chamada de julgamento de conteúdo (`gemini-flash-lite-latest`, com `gemini-flash-latest` de reserva, free tier) | Sem ela o pilar `estrutura` sai e o índice cai para 63 sobre 100. Os 12 pontos valem a cota; se a cota estourar, a degradação já existe |

## O que ficou de fora, de propósito

Registrado para não voltar como surpresa:

- **Invariantes das fixtures em teste.** `npm test` (`node:test` via `tsx`, sem
  dependência nova) cobre Módulo B, notas, teto e laudo contra casos reais. As 18
  invariantes de `05-cenarios-e-fixtures.md` ainda não estão lá — foram conferidas por
  script na migração, mas o script não está versionado. É a próxima dívida a pagar.
- **Ligar `gatilhos.json` ao componente de laudo.** As recomendações continuam
  escritas à mão dentro de cada fixture — inclusive as da etapa gratuita, que foram
  selecionadas conferindo `requer_corpus` a olho, não por código.
- **Demonstrar o teto de 30.** Está implementado e testado, mas nenhuma fixture o
  exercita — o site do `critico` é ruim demais para passar de 30 por vias honestas.
  Ver I-2 em `05-cenarios-e-fixtures.md`, com três saídas possíveis.
- **Backend, jobs de corpus, rate limit, SSRF, RLS.** São o produto final. A
  tech-spec cobre; este protótipo não implementa nada disso.
