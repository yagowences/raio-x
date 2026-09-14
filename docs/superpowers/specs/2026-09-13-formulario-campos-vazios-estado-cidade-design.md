# Formulário: campos vazios, "outro segmento" livre, estado + cidade

Data: 2026-09-13
Status: aprovado

## Contexto

O formulário de entrada (`src/telas/Formulario.tsx`) hoje:

1. Vem com `negocio`, `site` e `segmento` pré-preenchidos com dados de exemplo
   ("Clínica Vitalis", `https://clinicavitalis.com.br`, "clínica de estética").
2. Tem "outro segmento" como item de um `<select>` fixo, sem capturar qual é o
   segmento real do negócio — a copy generalizava para "seu segmento".
3. Tem cidade como `<select>` fixo com 4 cidades de Goiás + "outra cidade", sem
   campo de estado.

Este desenho cobre as três mudanças pedidas.

## Mudanças

### 1. Campos não vêm preenchidos

Em `Formulario.tsx`, os `useState` de `negocio`, `site` e `segmento` passam a
iniciar vazios. O `<select>` de segmento ganha uma opção placeholder desabilitada
("Selecione o segmento", `value=""`) como valor inicial — força escolha ativa,
igual ao padrão que o novo select de estado também usa.

### 2. "Outro segmento" com caixa de texto

Quando o valor selecionado no `<select>` de segmento é `"outro segmento"`, um
campo de texto aparece abaixo ("Qual o segmento do seu negócio?"), obrigatório
nesse caso. No `handleSubmit`, se `segmento === "outro segmento"`, o valor
enviado como `segmento` é o texto digitado (`trim()`) — não a string fixa.

Isso significa que a partir de agora o formulário nunca envia literalmente
`"outro segmento"` como valor de `segmento`. Ver seção "Fora de escopo" sobre
por que isso não implica remover `descreverSegmento`.

### 3. Estado (sigla) + cidade (texto livre)

- Novo `<select id="campo-estado">`: as 27 UF + DF, valor = sigla (ex. `"GO"`),
  label = sigla + nome por extenso (ex. `"GO — Goiás"`). Placeholder inicial
  desabilitado ("Selecione o estado").
- Campo cidade deixa de ser `<select>` e vira `<input type="text">` livre,
  obrigatório.
- Remove `CIDADES_DISPONIVEIS` e a opção `"outra cidade"` de
  `Formulario.tsx`. Isso não afeta `descreverCidade` (ver "Fora de escopo") —
  a função continua existindo em `src/dominio/segmento.ts`, só deixa de ser
  alcançável a partir do formulário.

### 4. Propagação do estado pelo contrato de dados

Como o estado precisa reaparecer depois (ex. "Goiânia, GO"), ele entra no
contrato de dados como campo novo, seguindo o padrão que `cidade` já tem hoje:

- `src/api/tipos.ts`: `EntradaFormulario.estado: string` (novo, obrigatório) e
  `Auditoria.negocio.estado: string` (novo).
- `src/api/mock.ts`: `auditoria.negocio.estado = input.estado || baseFixture.negocio.estado` —
  mesmo padrão de `cidade`/`segmento` na função `iniciar`.
- Fixtures (`src/api/fixtures/*.ts`): cada uma ganha `estado: "GO"` em
  `negocio` (todas as cinco são cenários de Goiás hoje).
- Exibição: `Analise.tsx` (eyebrow, linha com `negocio.cidade`) e
  `Resultado.tsx` (cabeçalho "Negócio auditado: nome (segmento · cidade)")
  passam a mostrar `cidade, estado`.

> **Nota de 2026-09-14:** esta seção foi escrita quando o `CLAUDE.md` descrevia
> o repositório como "só o front". O `CLAUDE.md` e o `git status` foram
> atualizados nesta sessão: existe backend real
> (`netlify/functions/` + Supabase), e ele é o caminho padrão — mock só entra
> com `?mock`/`?cenario=` na URL. A seção 5 cobre o que isso muda.

### 5. Backend real (Supabase + Netlify Functions)

Descoberto ao reler o estado atual do repo: `src/api/client.ts` chama
`POST /api/raiox` de verdade por padrão (inclusive em localhost). Sem mexer
no backend, `estado` seria enviado e silenciosamente descartado pelo Zod
schema (`z.object` sem `.strict()` ignora chaves desconhecidas), nunca
persistido, nunca devolvido — e como `App.tsx` substitui `auditoria` inteiro
a cada tick do polling (`setAuditoria(atualizada)`), qualquer remendo só no
front seria apagado no próximo poll. Para `estado` sobreviver de verdade ao
polling e a reloads, no caminho real, precisa:

- **Migration nova** `supabase/migrations/0003_estado.sql`, no padrão de
  `0002_indice_completo.sql`: `alter table public.auditorias add column if
  not exists estado text;`. Sem `not null` — linhas antigas não têm valor.
- `netlify/functions/raiox.ts`: `EntradaSchema` ganha
  `estado: z.string().trim().length(2)` (sigla de UF); os dois `insert`
  (com site e sem site) passam a gravar a coluna `estado`.
- `netlify/functions/lib/mapearAuditoria.ts`: `LinhaAuditoria` ganha
  `estado: string | null`; `negocio` no retorno ganha `estado: linha.estado`.
- `netlify/functions/raiox-status.ts`: o `select` explícito de colunas ganha
  `estado`.
- `netlify/functions/raiox-audit-background.ts` **não muda** — ele só lê
  `negocio, segmento, cidade, site` para montar o laudo (Módulo C), e a
  seção "Fora de escopo" já deixa claro que a copy do laudo continua sem
  `estado`.

A migration é aplicada ao projeto Supabase configurado (via `supabase db
push` ou a ferramenta MCP do Supabase) como parte da implementação, não
antes — é o tipo de mudança que se confirma com o usuário no momento de
aplicar, não só no desenho.

## Fora de escopo (e por quê)

**`src/dominio/laudo.ts` e `src/telas/Fila.tsx` não mudam.** O texto que eles
geram (`diagnostico`, `cta.subtitulo`, os parágrafos da tela de fila) é regra
de negócio guiada por `docs/03-regras-de-negocio.md`, com invariantes
testadas, e hoje usa só `cidade` (nunca `estado`). Adicionar estado ali seria
mudança de regra de negócio — fora do pedido original, que é sobre o
formulário.

**`descreverSegmento` e `descreverCidade` (`src/dominio/segmento.ts`)
continuam intocados**, junto com o teste que os cobre em
`tests/laudo.test.ts` (linha 16, comentado como "Caso real" — documenta um
bug de verdade em que a copy do laudo vazava "outro segmento"/"outra cidade"
literalmente). Depois desta mudança, o formulário nunca mais produz esses
valores literais como entrada, então essas funções na prática não são mais
alcançadas por esse caminho — mas `montarLaudo` é uma função genérica de
domínio, chamável com qualquer `negocio` (inclusive de um backend futuro), e
manter a normalização é proteção defensiva de custo zero. Remover apagaria a
cobertura de um bug real sem necessidade.

**Lista de UF cobre todo o Brasil**, mesmo o corpus testado sendo só de
Goiás — mesma lógica que já vale para segmento: fora do que foi testado, o
negócio cai no cenário `fila` (sem corpus), não é bloqueado no formulário.

## Testando

`npm run lint` (tsc --noEmit) e `npm test` continuam sendo o portão. Como
nenhuma regra de `src/dominio/` muda, nenhum teste existente deveria quebrar;
não há bug de medição sendo corrigido aqui, então não se aplica a exigência de
"bug corrigido ganha teste com o caso real".

Como a seção 5 toca o backend real, a verificação manual entra também:
`npx netlify dev` (porta 8888) para submeter o formulário de ponta a ponta —
confirmar que `estado` chega no `insert`, sobrevive ao polling e aparece em
Análise/Resultado — além do caminho de fixture (`?cenario=`) continuar
funcionando sem backend.
