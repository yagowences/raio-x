# 01 — Princípios e escopo

## Parte 1: os princípios

Vêm do §1 da tech-spec. Lá eles são descritos como o backend os garante; aqui estão
traduzidos para o que o front tem de fazer. Se uma decisão de implementação exigir
quebrar um destes, a decisão está errada — não o princípio.

### P1 · Geração cega

O corpus é gerado sem o nome do negócio. O job recebe `(segmento, cidade)` e nada mais.

**No front:** nenhuma tela pode sugerir que a IA foi perguntada sobre o cliente. O
texto da pergunta exibido em `PerguntaResultado.texto` é o prompt literal, e ele
nunca contém o nome do negócio. Se um dia contiver, é bug de backend e o front não
deve maquiar — deve ficar evidente.

Isso não é detalhe técnico: é o que torna o laudo defensável. "Perguntamos sobre o
seu nicho e você não apareceu" é um achado. "Perguntamos sobre você" seria um teste
armado.

### P2 · Três execuções por pergunta

Cada pergunta roda três vezes. Métrica só existe com duas ou mais execuções válidas.

**No front:** `PerguntaResultado.execucoes` é sempre 3, e `posicoes` tem no máximo
`mencoes` elementos. A interface mostra as três execuções, não uma média escondida.
Uma pergunta com menos de duas execuções válidas não exibe taxa.

### P3 · Só afirmar o que foi testado

**No front, esta é a regra mais fácil de quebrar sem perceber.** A lista de motores
sai de `corpus.motores`. Não escreva "ChatGPT", "Gemini" ou "Perplexity" em nenhuma
string literal de componente.

No MVP `motores` é `["gemini"]`. Uma copy que diga "testamos as principais IAs" está
mentindo hoje e continuará mentindo depois, porque a frase nunca corresponde ao array.
Escreva a partir do tamanho real de `corpus.motores`.

### P4 · Casamento determinístico

Nenhum LLM decide se houve menção. É função pura.

**No front:** o que chega já está decidido. O front não reinterpreta, não arredonda
a favor e não converte `incerto` em menção para deixar o número mais bonito.

### P5 · Nenhuma chave no navegador

**No front:** nenhum arquivo em `src/` lê `process.env` ou `import.meta.env`.

Isso é verificável, e por isso é um teste e não uma intenção:

```bash
grep -rn "GEMINI\|import.meta.env\|process.env" src/ index.html
```

Não deve devolver nada. Se devolver, algo que pertence ao backend vazou para cá.
O `.env.example` na raiz é boilerplate herdado do AI Studio e não tem efeito neste
protótipo.

### P6 · Evidência persistida

Todo número exibido é rastreável até a pergunta e a execução que o produziram.

**No front:** nenhum agregado aparece sem que o usuário consiga descer até a
pergunta que o gerou. É por isso que a lista de perguntas mostra o prompt literal em
fonte monoespaçada — é evidência, não decoração.

## Parte 2: o escopo

### Dentro

- As cinco telas do fluxo: formulário, análise, resultado, fila, limite atingido
- Consumo de fixtures por `src/api/mock.ts`, com seleção de cenário por `?cenario=`
  e pelo seletor `dev:` no rodapé
- Simulação do polling: `parcial` nas duas primeiras chamadas, `concluido` na terceira
- Exibição de todas as métricas de visibilidade, da auditoria de site, do índice e
  do laudo
- Captura de lead e captura de fila, com consentimento
- Analytics sem PII (`src/analytics.ts`)

### Fora

Não é "ainda não fizemos". É "não pertence a este repositório".

- Qualquer chamada de rede real
- Cálculo de corpus, casamento de nomes, Jaro-Winkler
- Rate limit de verdade (o protótipo conta em memória e reseta ao recarregar)
- Proteção SSRF, CORS, RLS, hash de IP
- Jobs agendados de refresh e de fila
- Geração de PDF, painel, histórico, monitoramento recorrente

### A fronteira

`src/api/client.ts` é a fronteira, e cabe em quinze linhas de propósito:

```ts
export const USE_MOCK = true;
export const api: RaioxApi = USE_MOCK ? mockApi : realApi;
```

Toda tela fala com `api`. Nenhuma tela importa `mock.ts` para buscar dado — só
`App.tsx` importa, e apenas para o seletor de cenário de desenvolvimento.

Enquanto essa fronteira estiver limpa, o dia 10 do plano da tech-spec é uma linha
alterada. Se ela vazar, o dia 10 vira uma refatoração.
