# 02 — Contrato de dados

`src/api/tipos.ts` é a fonte única de verdade do front. A tech-spec §4.5 é a fonte
única do produto. Os dois têm que convergir, e a última seção deste documento lista
onde ainda não convergem.

## Os quatro endpoints

O protótipo simula os três primeiros. `POST /api/fila` usa o mesmo caminho de
`POST /api/lead`, com `origem: "fila"`.

### `POST /api/raiox` — inicia

Responde em menos de 1 segundo, porque só lê corpus. Nenhuma chamada externa
acontece aqui.

```ts
{ negocio: string; segmento: string; cidade: string; site?: string }
```

Três respostas possíveis, e o front trata as três:

| Situação | `status` | O que chega | Tela |
|---|---|---|---|
| Nicho coberto | `"parcial"` | `visibilidade` preenchida, `site_resultado`/`indice`/`laudo` nulos | análise → resultado |
| Nicho coberto, sem site | `"concluido"` | `visibilidade` preenchida, `indice: null` | resultado, sem polling |
| Nicho fora do corpus | `"na_fila"` | `corpus.disponivel: false`, `visibilidade: null`; `site_resultado`, `indice` (sobre 75) e `laudo` preenchidos | etapa gratuita |

Sem site informado, **não há polling**. O Módulo B não tem o que auditar, e o
`status` já nasce `"concluido"`.

### `GET /api/raiox/:id` — polling

O front chama a cada 1.200 ms, teto de 20 tentativas. Devolve o mesmo objeto, com
`site_resultado`, `indice` e `laudo` preenchidos e `status: "concluido"`.

**Falha do Módulo B nunca vira `status: "erro"`.** Vem `"concluido"` com
`site_resultado.avaliado: false` e um `motivo`. A razão é comercial e honesta: o
resultado do Módulo A continua válido, e é ele que sustenta o laudo.

Implementação atual em `src/api/mock.ts`: `parcial` nas duas primeiras chamadas,
`concluido` na terceira. Timers limpos em `App.tsx` no unmount e a cada nova consulta.

### `POST /api/lead` e `POST /api/fila`

```ts
{ auditoria_id: string; nome: string; email?: string; whatsapp?: string; consentimento: true }
→ { ok: true }
```

`consentimento` é obrigatoriamente `true`. O mock rejeita `false`, e deve continuar
rejeitando. Pelo menos um entre `email` e `whatsapp` tem que existir.

## Estados de erro que a interface precisa cobrir

| Código | Significado | Tratamento |
|---|---|---|
| `429` | Limite diário de 3 consultas | Tela dedicada, sem perder o que foi digitado |
| `400` | Validação, com `campo` e `mensagem` | Erro junto ao campo, não em banner genérico |
| falha de rede | | Mensagem preservando os dados do formulário e oferecendo nova tentativa |

Nenhum desses estados descarta o que o visitante digitou. Reescrever o formulário é
o custo mais alto que se pode cobrar de alguém que já estava saindo.

## Como ler os campos que podem ser nulos

Esta tabela é a parte do documento que mais evita erro. Cada `null` significa uma
coisa diferente, e nenhum deles significa zero.

| Campo | `null` quer dizer | A interface diz |
|---|---|---|
| `indice` | Não há site para avaliar. **Só isso** — falta de corpus não zera o índice, renormaliza sobre 75 | "Informe seu site para receber o índice completo" |
| `posicao_media` | Zero menções — não há posição para calcular | "—", nunca "0" |
| `dominio.cliente_presente` | **Não verificamos.** Exigiria consulta paga a SERP | "Verifique se você tem perfil lá" |
| `site_resultado.conteudo` | A chamada de julgamento falhou | Bloco de conteúdo some; o índice renormaliza sem o pilar `estrutura` |
| `tecnica.psi_mobile` | PageSpeed falhou ou não foi consultado | Não pontua, não aparece |
| `sitemap.urls` | Sitemap não existe ou não foi possível contar | "—" |
| `estrutura.video_com_transcricao` | Não há vídeo na página | Item omitido, não marcado como falha |

`cliente_presente: null` é o caso mais delicado. Exibir `false` ali seria invenção:
não sabemos se o cliente tem perfil no Doctoralia, sabemos que não verificamos.
Nulo é honesto.

## Divergências — todas resolvidas

As seis divergências abaixo **foram fechadas** na migração para os seis pilares.
Ficam registradas com o antes e o depois: o "depois" é a regra que vale, e o "antes"
explica por que a regra é essa. Quem for escrever a próxima fixture precisa das duas
metades.

Verificação: as 18 invariantes de `05-cenarios-e-fixtures.md` passam contra as cinco
fixtures, e `npm run lint` está limpo.

### D-A · Pilares do índice — RESOLVIDA

As fixtures adotaram os seis pilares de `config/pesos.json`. O registro abaixo existe
porque **não foi renomeação: os recortes eram diferentes**, e por isso não houve
de-para linha a linha — toda nota foi reescrita a partir do dado que a fixture já
carregava.

`config/pesos.json`, seis pilares, peso inteiro somando 100:

| id | rótulo | peso |
|---|---|---:|
| `autoridade_externa` | Autoridade externa | 25 |
| `autoria_onpage` | Sinais de autoria | 10 |
| `tecnica` | Acessibilidade técnica | 25 |
| `local_nap` | Presença local e NAP | 20 |
| `estrutura` | Estrutura de conteúdo | 12 |
| `dados_estruturados` | Dados estruturados | 8 |

Fixtures **antes** da migração, cinco pilares, peso fracionário somando 1,00:

| id | rótulo | peso |
|---|---|---:|
| `rastreabilidade` | Rastreabilidade e Acesso | 0.25 |
| `estrutura_dados` | Estrutura e Dados | 0.25 |
| `autoridade_citacoes` | Presença em Fontes do Nicho | 0.20 |
| `desempenho_tecnico` | Desempenho Mobile e SPA | 0.15 |
| `consistencia_nap` | Consistência Local (NAP) | 0.15 |

Três diferenças de recorte, e nenhuma é cosmética:

- **`autoria_onpage` não tem equivalente.** A spec separa `autoridade_externa` (25)
  de `autoria_onpage` (10) de propósito, para impedir dupla contagem: o E-E-A-T que
  o site declara sobre si não é a autoridade que a IA efetivamente mede. As fixtures
  não medem autoria.
- **`estrutura_dados` funde dois pilares da spec.** `estrutura` (12) e
  `dados_estruturados` (8) são medidos por métodos diferentes — contagem de tags
  contra parse de JSON-LD — e um pode falhar sem o outro.
- **`desempenho_tecnico` não existia na spec como pilar.** PageSpeed entra dentro de
  `tecnica`, e quando `psi_mobile` é `null` simplesmente não pontua.

Resultado da migração, com o denominador de cada fixture:

| Fixture | Denominador | Bruto | `indice.valor` |
|---|---:|---:|---:|
| `critico` | 100 | 20,64 | 20 |
| `medio` | 100 | 53,98 | 54 |
| `bom` | 100 | 89,24 | 89 |
| `fila` | 75 | 67,49 | 67 |
| `sem-site` | — | — | `null` |

### D-B · Formato do peso — RESOLVIDA

As fixtures usavam fração (`0.25`) e `Indice.tsx` compensava com
`Math.round(pilar.peso * 100)`. Agora o peso é inteiro em toda parte, igual a
`pesos.json`, e o `* 100` saiu no mesmo commit.

Eram obrigatoriamente o mesmo commit: separados, os pesos apareceriam como `0%` ou
como `2500%` na tela.

### D-C · Chaves de `conteudo` — RESOLVIDA

As fixtures traziam duas chaves; agora trazem os seis eixos da spec §4.5.
`tipos.ts` fechou o tipo em `Record<EixoConteudo, Nota>`, então o compilador passa a
pegar a próxima divergência — o que é melhor do que este documento pegar.

`conteudo[].nota` é **0–10**; `indice.pilares[].nota` é **0–100**. As duas escalas
convivem de propósito: a de conteúdo vem de julgamento de LLM, e 0–10 desencoraja
falsa precisão.

### D-D · `familia` dos robôs — RESOLVIDA

As fixtures traziam o fabricante (`"OpenAI"`, `"Perplexity"`); agora trazem a função:
`GPTBot` → `treinamento`, `PerplexityBot` → `recuperacao`, `Googlebot` → `busca`.
`tipos.ts` fechou o tipo em `Familia`.

A distinção é a que importa no laudo: bloquear um robô de treinamento é decisão de
negócio legítima; bloquear um robô de recuperação é tiro no pé, porque é o que traz
cliente agora. Agrupar por fabricante não permitia dizer isso.

### D-E · Semântica de `frequencia`

Resolvida, registrada aqui para não voltar. A spec §8.1 fala em "frequência ≥ 40%";
as fixtures usam contagem absoluta (`11`). **Vale a contagem absoluta**, e o corte de
40% é `frequencia / execucoes_validas`. Em `critico`: 11/15 = 0,73, acima do corte.

### D-F · `versao_pesos` ausente — RESOLVIDA

O campo existe e é obrigatório, dentro de `Indice` — não no topo de `Auditoria`.

**Desvio consciente da spec.** A tech-spec grava `versao_pesos` na tabela
`auditorias`, o que faz sentido para o banco. Na resposta da API, o lugar útil é ao
lado do número que aquela versão produziu. Quem for escrever o backend guarda na
coluna e serializa dentro de `indice`.

Sem ele, no dia em que os pesos mudarem, não há como reprocessar histórico nem
explicar por que a mesma empresa tirou 42 em agosto e 51 em novembro.
