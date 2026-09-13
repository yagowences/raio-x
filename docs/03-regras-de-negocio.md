# 03 — Regras de negócio

O que o protótipo calcula e exibe. Toda regra aqui tem consequência visível na tela;
regra sem consequência visível pertence ao backend e está na tech-spec.

## 1. Métricas de visibilidade

### O denominador

Existe uma regra acima de todas as outras:

> **Execução com `valida = false` sai do denominador.**

Nunca conta como "não citado". Esse é o erro que transforma uma falha de API numa
acusação falsa contra o cliente — o laudo diz "você não apareceu" quando a verdade é
"o motor não respondeu". É indefensável numa reunião, e destrói a confiança em todos
os outros números do documento.

```
execucoes_validas = total de execuções com valida = true
taxa_mencao       = mencoes / execucoes_validas
posicao_media     = média das posições nas execuções COM menção   (null se zero)
share_of_voice    = mencoes / total de menções de todas as entidades
taxa_fonte        = execuções com o domínio do cliente nas fontes / validas
```

### `incerto`

Casamento marcado `incerto` **não é menção nem ausência**. Sai do numerador e
permanece no denominador apenas se aquela pergunta tiver outras execuções válidas.

O número de incertos vai no laudo, em letra pequena, sempre. Esconder é o começo de
um laudo que não se sustenta: se o avaliador descobre sozinho que houve dúvida no
casamento e o documento não disse, tudo vira suspeito.

Um casamento é marcado `incerto` quando o nome é curto ou genérico demais para dar
certeza — "Bella", "Vitta", "São Lucas", "Nova". A decisão é do backend; o front
recebe pronto e exibe.

### Ordenação

- `concorrentes` — por menções desc, depois `posicao_media` asc. Top 8
- `dominios_do_nicho` — por frequência desc. Top 10

`frequencia` é **contagem absoluta** de aparições nas execuções válidas. Ver D-E em
`02-contrato-de-dados.md`.

## 2. O índice

### Cálculo

```
indice_bruto = Σ(peso × nota) / Σ(peso dos pilares MEDIDOS)
```

A tech-spec §7.1 escreve `100 × Σ(peso × nota) / Σ(peso)` porque assume `nota` entre
0 e 1. Aqui `nota` é 0–100 e `peso` é inteiro, então o fator 100 já está embutido e
somar outro daria 6.280 em vez de 62,8. **Atenção ao portar para o backend.**

Duas escalas convivem, de propósito:

| Campo | Escala | Por quê |
|---|---|---|
| `indice.pilares[].nota` | 0–100 | é o que a barra na tela representa |
| `site_resultado.conteudo[].nota` | 0–10 | é julgamento de LLM, e 0–10 desencoraja falsa precisão |

O denominador usa só os pilares medidos, não os seis sempre. É isso que faz a
degradação funcionar: quando a chamada de julgamento falha e `conteudo` vem `null`,
o pilar `estrutura` sai dos dois lados da fração e o índice continua significando a
mesma coisa numa escala de 0 a 100. A alternativa — tratar pilar ausente como nota
zero — puniria o cliente por uma falha nossa.

`nota` de cada pilar é 0–100. `peso` vem de `config/pesos.json`, em inteiro.

### O teto

```
se algum robô de gravidade crítica estiver bloqueado (por robots OU por 403/429):
    indice = min(indice_bruto, 30)
    teto_aplicado = 30
    motivo_teto = "{UA} bloqueado por HTTP {status}"   (bloqueio silencioso)
                | "{UA} bloqueado no robots.txt"        (negado no próprio arquivo)
```

Crítico quer dizer `gravidade: "critica"` em `config/crawlers.json` — hoje ChatGPT-User
e PerplexityBot, os robôs de recuperação. Robô de gravidade alta barrado (ex.: GPTBot
com 429) **não** aciona o teto: derruba a nota técnica, entra em "robôs bloqueados" e
gera o gatilho `bot_bloqueado_http`. `bloqueio_silencioso` segue a mesma régua — só
robô crítico —, o que mantém a invariante 8 de `05-cenarios-e-fixtures.md` verdadeira.
A decisão vive num lugar só: `src/dominio/bloqueio.ts`.

**O teto é multiplicador, não é parcela.** Não entra na soma ponderada; corta o
resultado depois.

`teto_aplicado` só é preenchido quando o corte **realmente aconteceu** — ou seja,
quando o bruto passava de 30. Um site bloqueado cujo bruto já era 20 fica com
`teto_aplicado: null`, porque escrever "teto de 30 aplicado" ao lado de um 20
confunde: o teto não fez nada ali. O bloqueio continua reportado em
`site_resultado.tecnica`, continua abrindo `BlocoBloqueio` e continua sendo a
recomendação de prioridade 1. Nada se perde.

O raciocínio: não faz sentido dar 78 a um site que a IA não consegue ler. Todos os
outros pilares podem estar impecáveis — schema perfeito, NAP completo, conteúdo
excelente — e nada disso chega ao destino. O teto existe para o número não contradizer
o laudo.

Quando o teto age, a interface diz que agiu e diz por quê. Um 30 sem explicação
parece nota baixa; um 30 com "PerplexityBot bloqueado por HTTP 403" é um diagnóstico.

### 2.1 Notas dos pilares do Módulo B

Heurísticas determinísticas, em `src/dominio/notas.ts`. Documentadas aqui para que
nenhuma nota seja caixa-preta.

| Pilar | Nota | Confiança |
|---|---|---|
| `tecnica` | `100 − 70 × (robôs de IA sem acesso / robôs de IA)`; −20 se suspeita de SPA; −10 sem sitemap. "Sem acesso" = negado no robots.txt **ou** 403/429 no GET; conta uma vez por robô. Googlebot (gravidade baixa) fica fora | alta |
| `local_nap` | 25 por campo presente: nome, telefone, endereço, horário | alta |
| `autoria_onpage` | Metade checagem: 100 se há página ou seção do responsável (link `/sobre`, `/quem-somos`, `/equipe`..., âncora `#sobre`) ou pessoa com nome no schema, senão 20. Metade julgamento: eixo `sinais_de_autoria` × 10. Sem julgamento, só a checagem | media |
| `dados_estruturados` | 5 sem JSON-LD; 95 completo; −15 por campo obrigatório faltando, piso 20 | alta |
| `estrutura` | média entre parte estrutural (títulos, alt) e a média dos cinco eixos de conteúdo × 10 — `sinais_de_autoria` fica fora, já pesa em autoria. Sem julgamento, o pilar sai | baixa |

Regras de leitura que sustentam essas notas (`netlify/functions/lib/moduloB/`):

- **robots.txt segue a RFC 9309.** Linha em branco não separa grupo; nome de robô
  casa sem diferenciar maiúsculas; a regra mais longa que casa com `/` vence, e Allow
  vence empate.
- **O GET de acesso usa o User-Agent completo do robô** (`ua_completo` em
  `config/crawlers.json`). Firewall e CDN casam pelo formato real; o token puro passa
  por regras que barram o robô de verdade. Google-Extended não tem UA próprio e só é
  lido no robots.txt.
- **NAP lê só texto visível.** `<script>`, `<style>`, `<noscript>` e `<template>` saem
  antes dos regexes — IDs e nomes de arquivo viravam telefone e CEP. CEP exige hífen
  ou o rótulo "CEP". Link `tel:` conta como telefone.
- **O julgamento de conteúdo recebe a página inteira, com estrutura**
  (`moduloB/texto.ts`). Saem menu, cabeçalho, carrinho, aviso de cookies e rodapé;
  título vira linha com `#`, item de lista vira `- `. Até 12 mil caracteres; acima
  disso cada seção entra com uma fatia igual, marcada com `[…]` onde é cortada. O
  modelo é o `gemini-flash-lite-latest`, com temperatura 0 e formato garantido por
  schema; o `gemini-flash-latest` é a segunda tentativa. Como pede a spec §6.4, entra
  também uma página interna — a do responsável (sobre, quem somos, equipe), até 3 mil
  caracteres — depois de uma linha `=== Página interna: /caminho ===`.
- **Os seis eixos aparecem na auditoria técnica**, com a justificativa de cada nota
  ("Leitura do Conteúdo", confiança baixa). Sem julgamento, o bloco é omitido.
- **Negócio no schema inclui os subtipos de LocalBusiness** (BeautySalon, HairSalon,
  Dentist, Store...), que herdam os campos obrigatórios de LocalBusiness. `openingHours`
  vale no lugar de `openingHoursSpecification`. Blocos dentro de `@graph` são lidos
  um a um.

### Sem site

`indice = null`. Só as métricas de visibilidade aparecem. A interface usa isso como
gancho — *"informe seu site para receber o índice completo"* — o que é honesto e
converte, nessa ordem.

### Com site, sem corpus — a etapa gratuita

Terceiro caso, e o mais importante comercialmente. O nicho não está mapeado, então
`visibilidade` é `null`, mas o site existe e foi auditado.

**O índice é calculado assim mesmo**, renormalizado sobre os pilares medidos:

| Pilar | Peso | Fonte |
|---|---:|---|
| `tecnica` | 25 | Módulo B |
| `local_nap` | 20 | Módulo B |
| `estrutura` | 12 | Módulo B |
| `autoria_onpage` | 10 | Módulo B |
| `dados_estruturados` | 8 | Módulo B |
| **denominador** | **75** | |
| `autoridade_externa` | 25 | Módulo A — **fora dos dois lados da fração** |

```
indice = Σ(peso × nota) / 75
```

Não é regra nova: é a mesma renormalização por pilar medido da seção "Cálculo",
aplicada a um pilar que não foi medido por falta de corpus, e não por falha.

O teto de 30 continua valendo. Um site bloqueado é um site bloqueado, com ou sem corpus.

**Por que isso importa:** esta é a única configuração do produto que funciona para
qualquer negócio, em qualquer segmento, em qualquer cidade, sem investimento prévio
nenhum. O Módulo A só atende os nichos já gerados; o Módulo B atende todo mundo,
custa 9 fetches HTTP mais uma chamada de julgamento no free tier, e entrega 75 dos
100 pontos do índice.

A interface **não** apresenta isso como entrega parcial. É a análise gratuita, e o
que falta nela — a autoridade externa — é exatamente o que a varredura do nicho
acrescenta.

### Versionamento

`versao_pesos` guarda o campo `versao` de `pesos.json` em toda auditoria. Ainda não
existe em `tipos.ts` (D-F). Sem ele, quando os pesos mudarem, não há como comparar
o laudo de agosto com o de novembro nem reprocessar histórico.

## 3. Confiança por pilar

Cada pilar carrega `confianca: "alta" | "media" | "baixa"`, e a interface exibe.

- **alta** — medição determinística, verificada diretamente. Robots, status HTTP,
  contagem de tags, parse de JSON-LD
- **media** — inferência sobre dado real. Presença em domínios do nicho, onde
  `cliente_presente` pode ser `null`
- **baixa** — julgamento de LLM, ou amostra pequena

Um pilar de confiança baixa pesa igual no índice. A etiqueta não desconta a nota;
ela diz ao leitor quanto peso dar ao argumento. Descontar seria esconder duas coisas
diferentes dentro de um número só.

## 4. O laudo

### Ordem de prioridade, sem exceção

```
1. teto acionado                                    → sempre a recomendação 1
2. domínio do nicho com frequencia/validas ≥ 0.40
   e cliente_presente !== true                      → recomendação 2
3. maior déficit ponderado: peso × (1 − nota/100)   → preenche o resto,
   no máximo uma recomendação por pilar
```

O limite por pilar existe porque gatilhos do mesmo pilar têm o mesmo déficit. Sem
ele, três eixos de conteúdo fracos (todos de `estrutura`) tomavam o laudo e
empurravam NAP e schema para fora. No empate, vale a ordem de `gatilhos.json`.

Os quatro gatilhos de conteúdo (`conteudo_*`) disparam com nota ≤ 3 no eixo e citam
a nota como dado. A justificativa do modelo não entra no laudo — o laudo é template
(T5); ela aparece como evidência no bloco "Leitura do Conteúdo".

O bloqueio silencioso vem primeiro porque é o achado que converte: robots.txt limpo
e 403 na prática é o cenário mais comum e o mais invisível para o dono do site. Ele
não sabe, ninguém contou, e o conserto é barato.

**Na etapa gratuita, a regra 2 não se aplica** — ela depende de `dominios_do_nicho`,
que vem do corpus. A regra 1 e a regra 3 funcionam integralmente, e é por isso que a
etapa gratuita produz laudo de verdade: **17 dos 19 gatilhos de `config/gatilhos.json`
disparam só com o site**, incluindo `bot_critico_bloqueado`. Cada gatilho carrega
`requer_corpus` para tornar isso verificável.

Regra 3 usa déficit **ponderado**, não nota bruta. Um pilar de peso 25 com nota 60
(déficit 10,0) vem antes de um pilar de peso 8 com nota 20 (déficit 6,4). Ordenar
por nota bruta mandaria o cliente consertar o que menos importa.

### Toda recomendação cita um número

`gatilhos.json` obriga o campo `dado`. Recomendação sem dado não entra na biblioteca.

É o que separa este laudo de um checklist genérico de SEO. "Implemente dados
estruturados" é conselho de blog. "Não há JSON-LD em clinicavitalis.com.br, e por
isso seu endereço e horário são texto solto" é um achado sobre aquela empresa.

### Diagnóstico

Duas a três frases, montadas por regra, nunca por LLM:

```
taxa_mencao = 0:
  "Rodamos {n} perguntas que um cliente faria sobre {segmento} em {cidade}.
   Em {total} execuções, o nome {negocio} não apareceu nenhuma vez.
   A IA recomendou {c1}, {c2} e {c3}."

0 < taxa_mencao < 0.34:
  "{negocio} apareceu em {mencoes} de {total} execuções, na posição média {pos}.
   {c1} apareceu em {n1}."
```

Template, e não LLM, por dois motivos: o texto fica auditável, e as regras de escrita
de `04-regras-de-copy.md` passam a ser garantidas por construção em vez de
verificadas a cada geração.

### `risco_avaliacao` é risco, nunca veredito

Quando `dados_estruturados.risco_avaliacao` é `true`, o laudo diz que o schema está
arriscado e provavelmente inútil — o Google já não exibe rich snippet de avaliação
autodeclarada para `LocalBusiness` e `Organization`.

**Não diz que a avaliação é falsa.** Não sabemos, e acusar um cliente de forjar
avaliação com base em ausência de fonte pública é o tipo de erro que não tem conserto.

## 5. Matriz de degradação

Nenhuma destas falhas mostra tela de erro ao visitante.

| Falha | O que o front faz |
|---|---|
| Corpus não existe para o nicho | **Não é degradação.** Cai na etapa gratuita: índice sobre 75, laudo com os gatilhos aplicáveis, e a fila oferecida como acréscimo |
| Site inacessível ou timeout | `avaliado: false` com `motivo`. Módulo A intacto. **É achado, não erro** |
| Julgamento de conteúdo falhou | Bloco de conteúdo some. Índice renormaliza sem `estrutura`; `autoria_onpage` fica só com a checagem da página; gatilhos `conteudo_*` não disparam |
| PageSpeed falhou | `psi_mobile: null`. Não pontua, não aparece |
| Polling estourou 20 tentativas | Para o timer, mantém o que já chegou, resultado parcial segue utilizável |
| Rede caiu no envio | Preserva o formulário, oferece nova tentativa |

O princípio comum: **o Módulo A é o produto.** Ele responde em menos de um segundo,
sem chamada externa, e é ele que sustenta a conversa comercial. Tudo do Módulo B é
enriquecimento. Uma falha lá degrada o laudo; não pode derrubá-lo.

## 6. Limite diário

Três consultas por IP por dia. No protótipo, contador em memória em `App.tsx`, que
zera ao recarregar a página — é simulação, e a tela existe para ser demonstrada, não
para proteger nada.

A tela do limite não é punição. Explica que o limite preserva a capacidade da
varredura mensal e oferece o caminho de falar com a equipe.
