# INTELLECTUS DIGITAL
## Tech-Spec — Raio-X de IA
### Documento de implementação · v1.0 · Agosto de 2026

> **Nota de arquivo.** Documento de referência, reproduzido na íntegra como
> fornecido pelo dono do produto. Não editar aqui para refletir o estado do código —
> este arquivo descreve o **produto final**. As decisões de implementação do
> protótipo visual estão em `docs/01` a `docs/05`, e onde elas reduzem o escopo, a
> redução é explícita.

Implementa `Intellectus_Spec_Ferramenta_Raiox_IA_v1.md` com as alterações de
`Intellectus_Spec_Raiox_Custo_Zero_v1.md`. Onde houver divergência, **esta tech-spec
vence em detalhe de implementação** e as specs anteriores vencem em decisão de produto.

---

## 0. O que este documento decide

| # | Decisão |
|---|---|
| T1 | Backend em **Netlify Functions** (TypeScript), banco em **Supabase**. Nenhuma chave no bundle do front |
| T2 | **Dois projetos Google Cloud separados** — `raiox-consulta` sem billing, `raiox-corpus` com billing |
| T3 | Consulta em **duas fases**: Módulo A síncrono (<1s), Módulo B por polling |
| T4 | Corpus gerado por **job agendado**, nunca pela requisição do visitante |
| T5 | Laudo por **template determinístico**, sem chamada de LLM |
| T6 | Um motor no MVP (**Gemini com grounding**). Arquitetura pronta para o segundo |
| T7 | `pesos.json`, `travas.json` e `crawlers.json` são arquivos de configuração versionados, nunca constantes no código |

---

## 1. Os princípios que o código não pode violar

| # | Princípio | Como o código garante |
|---|---|---|
| P1 | **Geração cega** | O nome do negócio não existe no processo de refresh do corpus. O job de corpus recebe `(segmento, cidade)` e nada mais. Fisicamente impossível vazar |
| P2 | **Três execuções por pergunta** | `execucao` é coluna `NOT NULL` com `CHECK (execucao IN (1,2,3))`. Métrica só é calculada se houver ≥2 execuções válidas |
| P3 | **Só afirmar o que foi testado** | `motores` vem do banco, nunca hardcoded no front. A copy lê a lista real |
| P4 | **Casamento determinístico** | Função pura em TypeScript, com testes unitários. Nenhum LLM decide menção |
| P5 | **Nenhuma chave no navegador** | Toda chamada externa parte de Netlify Function. CSP bloqueia origens de API de modelo |
| P6 | **Evidência persistida** | `respostas.texto` guarda o bruto. Um laudo sem evidência recuperável é um laudo indefensável |

---

## 2. Arquitetura

```
                    ┌──────────────────────────────────────┐
   VISITANTE ──────▶│  Front estático (Netlify)            │
                    └───────────────┬──────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
    POST /api/raiox        GET /api/raiox/:id      POST /api/lead
     (síncrono, <1s)         (polling, 1.5s)
              │                     │
              ▼                     ▼
      ┌───────────────┐    ┌──────────────────┐
      │  MÓDULO A     │    │  MÓDULO B        │
      │  lê corpus    │    │  audita o site   │
      │  + casamento  │    │  fetch × 12      │
      │  ZERO API     │    │  + PSI + 1 LLM   │
      └───────┬───────┘    └────────┬─────────┘
              │                     │
              └──────────┬──────────┘
                         ▼
              ┌──────────────────────┐
              │ ÍNDICE + MÓDULO C    │
              │ pesos.json+template  │
              │ ZERO API             │
              └──────────────────────┘
   ─────────────── fora do caminho da requisição ───────────────
   cron mensal ──▶ JOB REFRESH CORPUS ──▶ Gemini grounding ──▶ respostas
   cron diário ──▶ JOB FILA ──────────▶ mesmo pipeline ──▶ e-mail
```

**A separação de topo é a única coisa que torna a ferramenta gratuita:** nada no
caminho da requisição do visitante gera texto com busca. O Módulo A lê. O Módulo B
faz uma chamada de julgamento no free tier.

---

## 3. Modelo de dados

Postgres no Supabase. RLS ligado em **todas** as tabelas.

```sql
-- ─────────────────────────────────────────── corpus
create table nichos (
  id            uuid primary key default gen_random_uuid(),
  segmento      text not null,
  cidade        text not null,
  uf            text not null default 'GO',
  ativo         boolean not null default true,   -- entra no refresh mensal
  origem        text not null default 'matriz',  -- 'matriz' | 'fila'
  corpus_em     timestamptz,                     -- última geração concluída
  criado_em     timestamptz default now(),
  unique (segmento, cidade)
);

create table respostas (
  id            uuid primary key default gen_random_uuid(),
  nicho_id      uuid not null references nichos(id) on delete cascade,
  pergunta_id   text not null,                   -- 'p1'..'p5'
  pergunta      text not null,
  motor         text not null,                   -- 'gemini' | 'perplexity'
  execucao      smallint not null check (execucao between 1 and 3),
  texto         text not null,                   -- resposta bruta = evidência
  entidades     jsonb not null,                  -- saída da etapa 3
  fontes        text[] not null default '{}',    -- domínios normalizados
  valida        boolean not null default true,   -- false = erro do motor
  erro          text,
  criado_em     timestamptz default now(),
  unique (nicho_id, pergunta_id, motor, execucao, criado_em)
);
create index on respostas (nicho_id, criado_em desc);
create index on respostas (nicho_id, valida) where valida;

-- ─────────────────────────────────────────── consulta
create table auditorias (
  id                uuid primary key default gen_random_uuid(),
  nicho_id          uuid references nichos(id),
  negocio           text not null,
  segmento          text not null,
  cidade            text not null,
  site              text,
  status            text not null default 'parcial',
    -- 'parcial' | 'concluido' | 'erro' | 'na_fila'
  visibilidade      jsonb,          -- saída do módulo A
  site_resultado    jsonb,          -- saída do módulo B
  indice            smallint,
  laudo             jsonb,
  versao_pesos      text,           -- hash de pesos.json usado
  ip_hash           text not null,  -- sha256(ip + salt), nunca o IP
  criado_em         timestamptz default now(),
  concluido_em      timestamptz
);
create index on auditorias (ip_hash, criado_em desc);

create table leads (
  id            uuid primary key default gen_random_uuid(),
  auditoria_id  uuid references auditorias(id),
  nome          text not null,
  email         text,
  whatsapp      text,
  consentimento boolean not null default true,
  origem        text not null default 'resultado', -- 'resultado' | 'fila'
  criado_em     timestamptz default now(),
  check (email is not null or whatsapp is not null)
);

create table rate_limit (
  ip_hash       text not null,
  dia           date not null,
  consultas     smallint not null default 0,
  primary key (ip_hash, dia)
);
```

### 3.1 RLS

```sql
alter table nichos       enable row level security;
alter table respostas    enable row level security;
alter table auditorias   enable row level security;
alter table leads        enable row level security;
alter table rate_limit   enable row level security;
```

**Nenhuma policy permissiva é criada.** Sem policy, RLS nega tudo pela chave
publicável. Todo acesso passa pela `service_role` dentro das funções. O front nunca
fala com o Supabase — nem para leitura.

### 3.2 Privacidade no schema

- `ip_hash` guarda `sha256(ip + IP_SALT)`. O IP cru nunca é persistido.
- `respostas.texto` contém conteúdo público gerado sobre empresas. Não é dado pessoal.
- Nome de autor de avaliação **não é coletado em lugar nenhum** — não há Places API nesta versão.
- `leads` só é acessível pela `service_role`.

---

## 4. Contratos de API

Quatro endpoints. Estes contratos são a **fonte única de verdade** compartilhada com
o front — o documento de frontend replica os mesmos tipos.

### 4.1 `POST /api/raiox`

Inicia a auditoria. Responde em menos de 1 segundo.

```ts
// request
{
  negocio:  string;   // 2..120 chars
  segmento: string;   // slug da lista coberta, ou texto livre
  cidade:   string;   // slug da lista coberta, ou texto livre
  site?:    string;   // com ou sem esquema
}

// 200 — nicho coberto
{
  auditoria_id: string;
  status: "parcial";
  negocio: { nome, segmento, cidade, site: string | null };
  corpus: {
    disponivel: true;
    gerado_em: string;              // ISO
    motores: string[];              // ["gemini"]
    execucoes_por_pergunta: number; // 3
    total_execucoes: number;        // 15
  };
  visibilidade: Visibilidade;       // §4.5
  site_resultado: null;             // chega no polling
  indice: null;
  laudo: null;
}

// 200 — nicho fora do corpus
{
  auditoria_id: string;
  status: "na_fila";
  corpus: { disponivel: false, previsao_horas: 24 };
  visibilidade: null;
  site_resultado: null;             // o módulo B roda mesmo assim, via polling
  ...
}

// 429 — rate limit
{ erro: "rate_limit", limite: 3, reset_em: string }

// 400 — validação
{ erro: "validacao", campo: "segmento", mensagem: string }
```

Quando `site` é `null`, `status` já nasce `"concluido"` e o polling não acontece.

### 4.2 `GET /api/raiox/:id`

Polling. O front chama a cada 1.500 ms enquanto `status === "parcial"`, com teto de
20 tentativas (30 s).

Devolve o mesmo objeto, com `site_resultado`, `indice` e `laudo` preenchidos e
`status: "concluido"`. Em falha do Módulo B, `status: "concluido"` com
`site_resultado.avaliado: false` e `motivo` — **nunca** `status: "erro"`, porque o
resultado do Módulo A continua válido e é o que vende.

### 4.3 `POST /api/lead`

```ts
{ auditoria_id: string; nome: string; email?: string; whatsapp?: string; consentimento: true }
→ 200 { ok: true }
```

Dispara webhook para o n8n com o payload completo da auditoria. Falha de webhook
**não** falha a requisição — o lead já está no banco; a entrega é reprocessável.

### 4.4 `POST /api/fila`

Captura para nicho não coberto. Mesmo shape do lead, `origem: "fila"`.

### 4.5 Tipos compartilhados

```ts
type Confianca = "alta" | "media" | "baixa";

interface Visibilidade {
  mencoes: number;
  execucoes_validas: number;
  taxa_mencao: number;              // 0..1
  posicao_media: number | null;     // null se zero menções
  share_of_voice: number;
  taxa_fonte: number;
  incertas: number;                 // casamentos marcados 'incerto'
  perguntas: PerguntaResultado[];
  concorrentes: Concorrente[];      // top 8
  dominios_do_nicho: Dominio[];     // top 10
}

interface PerguntaResultado {
  id: string;                       // 'p1'..'p5'
  texto: string;                    // prompt literal, exibido em mono
  execucoes: number;                // 3
  mencoes: number;                  // 0..3
  incertas: number;
  posicoes: number[];               // posição em cada execução com menção
  concorrentes_citados: string[];   // top 3 daquela pergunta, em ordem
  fontes: string[];                 // domínios consultados
}

interface Concorrente { nome: string; mencoes: number; posicao_media: number; }
interface Dominio     { dominio: string; frequencia: number; cliente_presente: boolean | null; }

interface SiteResultado {
  avaliado: boolean;
  motivo?: "sem_site" | "inacessivel" | "timeout" | "erro";
  url_final?: string;
  tecnica: {
    robots: { ua: string; familia: "busca" | "recuperacao" | "treinamento";
              gravidade: "critica" | "alta" | "baixa";
              permitido: boolean }[];
    acesso: { ua: string; status: number; bloqueado: boolean }[];
    bloqueio_silencioso: boolean;   // robots limpo + 403/429 real
    sitemap: { existe: boolean; urls: number | null; lastmod: string | null };
    html_estatico: { chars_bruto: number; suspeita_spa: boolean };
    psi_mobile: number | null;
  };
  estrutura: {
    h1: number; h2: number; h3: number; salto_de_nivel: boolean;
    tabelas: number; listas: number;
    imagens: number; imagens_com_alt: number;
    video_com_transcricao: boolean | null;
  };
  dados_estruturados: {
    presente: boolean; tipos: string[];
    campos_faltando: Record<string, string[]>;
    risco_avaliacao: boolean;       // aggregateRating sem fonte pública
  };
  nap: {
    nome: boolean; telefone: string | null; endereco: boolean; cep: string | null;
    horario: boolean; pagina_autor: boolean;
  };
  conteudo: {                        // única saída de LLM da consulta
    resposta_direta:     Nota; perguntas_reais:  Nota;
    ganho_informacional: Nota; sinais_de_autoria: Nota;
    prova_social:        Nota; escaneabilidade:   Nota;
  } | null;
}

interface Nota { nota: number | null; por_que: string; }

interface Indice {
  valor: number;                    // 0..100
  teto_aplicado: number | null;     // 30 quando multiplicador dispara
  motivo_teto: string | null;
  pilares: { id: string; rotulo: string; peso: number; nota: number; confianca: Confianca }[];
}

interface Laudo {
  diagnostico: string;              // 2-3 frases, template
  recomendacoes: { prioridade: 1|2|3; titulo: string; texto: string;
                   dado: string; pilar: string }[];
  cta: { variante: string; titulo: string; subtitulo: string };
}
```

---

## 5. Módulo A — leitura de corpus e casamento

Zero chamadas externas. Tudo abaixo é código nosso.

### 5.1 Resolução do nicho

```
normalizar(segmento) → slug        // minúsculas, sem acento, hífen
normalizar(cidade)   → slug
buscar em nichos WHERE segmento=? AND cidade=? AND corpus_em IS NOT NULL
  achou   → segue
  não     → status 'na_fila', insere nicho com origem='fila', ativo=false
```

Sinônimos de segmento resolvem por tabela de aliases em `segmentos.json`
(`"estetica"`, `"clinica de estetica"`, `"clínica estética"` → `clinica-estetica`).
Sem isso, metade dos visitantes de um nicho coberto cai na fila por erro de digitação
— é o modo de falha mais provável do produto inteiro.

### 5.2 Normalização de nomes

Aplicada ao nome do cliente **e** a cada entidade extraída.

```ts
function tokenDistintivo(nome: string, segmento: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // 1. sem acento
    .replace(/\b(ltda|me|epp|eireli|s\/a|sa|mei)\b/g, "") // 2. sufixo societário
    .replace(palavrasDoSegmento(segmento), "")           // 3. termos do segmento
    .replace(/[^\w\s]/g, " ")                            // 4. pontuação
    .replace(/\s+/g, " ").trim();                        // 5. espaços
}
```

`palavrasDoSegmento("clinica-estetica")` devolve `/\b(clinica|estetica)\b/g`.

### 5.3 Regras de casamento, em ordem

```
1. token distintivo idêntico                       → mencao
2. Jaro-Winkler(token) ≥ 0.90                      → mencao
3. dominio do cliente ∈ fontes                     → citacao_fonte  (métrica separada)
4. nada disso                                      → ausente
```

**Guarda contra falso positivo.** Se `tokenDistintivo.length < 5` **ou** o token
consta de `nomes_comuns.json` (`sao lucas`, `santa rita`, `bella`, `vitta`, `art`,
`top`, `nova`…), a menção só é confirmada com **confirmação adicional**:

- o domínio do cliente aparece nas fontes daquela execução, **ou**
- a cidade aparece no mesmo parágrafo do texto bruto onde a entidade foi citada

Sem confirmação → `incerto`. **`incerto` não conta como menção nem como ausência** —
sai do numerador e permanece no denominador apenas se houver outras execuções
válidas para aquela pergunta. O número de incertos vai no laudo em letra pequena;
esconder isso é o começo de um laudo que não se sustenta.

### 5.4 Métricas

```
execucoes_validas = COUNT(respostas WHERE valida = true)
taxa_mencao       = mencoes / execucoes_validas
posicao_media     = AVG(posicao) sobre execuções com menção        // null se 0
share_of_voice    = mencoes / total_de_mencoes_de_todas_entidades
taxa_fonte        = execucoes_com_dominio_do_cliente / validas
dominios_do_nicho = fontes agregadas, ordenadas por frequência desc
concorrentes      = entidades por frequência desc, depois posicao_media asc
```

Execução com `valida = false` **sai do denominador**. Nunca conta como "não citado" —
esse é o erro que transforma uma falha de API em uma acusação falsa contra o cliente.

`cliente_presente` em `dominios_do_nicho` fica `null` no MVP. Verificar presença
exigiria consulta a SERP, que é paga. Nulo é honesto; `false` seria invenção. O front
trata `null` como "não verificamos" e o laudo escreve "verifique se você tem perfil lá".

---

## 6. Módulo B — auditoria do site

Roda apenas com `site` informado. Tudo server-side — CORS impede buscar `robots.txt`
de terceiro pelo navegador.

### 6.1 Orçamento de rede

| Fetch | Quantidade |
|---|---:|
| `GET /robots.txt` | 1 |
| `GET /sitemap.xml` | 1 |
| `GET /` com UA de navegador | 1 |
| `GET /` com cada UA crítico | 5 |
| 1 página interna relevante (`/sobre`, `/servicos`, primeira do sitemap) | 1 |
| PageSpeed Insights | 1 |
| **Total** | **10** |

Timeout de 4 s por fetch, 3 em paralelo. Orçamento total do módulo: **20 s**. Roda em
função em background ou Edge Function do Supabase — não cabe nos 10 s da função
síncrona da Netlify.

Todo fetch respeita `redirect: "follow"` com máximo de 3 saltos e grava `url_final`.
Site que redireciona `http → https → www` e devolve 200 no fim está acessível;
reportar bloqueio nesse caso é falso positivo.

### 6.2 Bloqueio silencioso — o achado principal

```ts
for (const ua of crawlersCriticos) {          // de crawlers.json
  const r = await fetch(url, { headers: { "User-Agent": ua.string } });
  acesso.push({ ua: ua.nome, status: r.status, bloqueado: r.status === 403 || r.status === 429 });
}
bloqueio_silencioso = robotsPermite(ua) && acessoBloqueado(ua);
```

Robots limpo com 403 na prática é o cenário mais comum de todos, e continua sendo o
achado mais frequente e mais invisível. É a primeira coisa que o laudo diz quando
acontece.

`crawlers.json` carrega a taxonomia do §5.1 da spec original — família e gravidade
por user agent. **Arquivo separado, revisão trimestral no calendário.** Notas de
agosto de 2026 a confirmar antes de codificar: o robots.txt pode não se aplicar ao
`ChatGPT-User`, porque a busca parte de um usuário; e o UA do `OAI-SearchBot` agora
começa com string completa de Chrome desktop, então filtro de log com o formato
antigo não pega mais.

### 6.3 Checagens determinísticas

Nenhuma delas usa LLM. Parser: `cheerio` para HTML, `fast-xml-parser` para sitemap.

| Checagem | Método |
|---|---|
| robots por bot | parse do `/robots.txt`, casamento de UA e path |
| bloqueio real | §6.2 |
| sitemap | existe, contagem de URLs, `lastmod` mais recente |
| HTML estático | `chars` do texto do HTML cru; `suspeita_spa` se `< 500` com `div` raiz vazia |
| alt text | `img` com e sem `alt` |
| estrutura | contagem de `table`, `ol`, `ul`, `h1`, `h2`, `h3`; detectar salto de nível |
| transcrição de vídeo | `<track kind="captions">`, `VideoObject.transcript`, bloco de texto adjacente a iframe |
| JSON-LD | parse de `script[type="application/ld+json"]`, tipos, campos obrigatórios faltando |
| NAP | schema `LocalBusiness` + regex de telefone BR e CEP |
| horário | `openingHoursSpecification` |
| autor | `Person`/`author` no schema, existência de `/sobre`, `/autor`, `/quem-somos` |
| risco de avaliação | `aggregateRating` presente sem fonte pública correspondente |

**`risco_avaliacao` é risco, nunca veredito.** A copy do laudo diz que o schema está
arriscado e possivelmente inútil — o Google já não exibe rich snippet de avaliação
autodeclarada para `LocalBusiness` e `Organization` — e não diz que a avaliação é falsa.

### 6.4 A única chamada de LLM

Modelo: `gemini-flash` no projeto **`raiox-consulta`, sem billing**. Entrada:
~2.000 chars de texto limpo da home + ~1.000 da interna. Saída: JSON.

O prompt está em `Intellectus_Spec_Raiox_Custo_Zero_v1.md` §3 e vive em
`prompts/julgamento.txt`, versionado.

Tratamento de falha: uma tentativa com backoff. Persistindo o erro, `conteudo: null`
— o índice renormaliza sem o pilar de estrutura de conteúdo e o laudo não menciona
conteúdo. **Nunca inventar nota.**

**Trava de privacidade:** a função que monta este prompt recebe apenas
`(textoLimpo: string)`. Não recebe o objeto da auditoria. Nome do negócio, e-mail e
WhatsApp são fisicamente inalcançáveis dali. Isto é obrigatório porque o free tier
permite que o Google use os prompts para treinar.

---

## 7. Índice e pesos

`pesos.json`, inalterado em relação ao §5.5 da spec original, com a granularidade que
a emenda pediu:

```json
{
  "versao": "1.0.0",
  "pilares": [
    { "id": "autoridade_externa", "rotulo": "Autoridade externa", "peso": 25,
      "fonte": "modulo_a" },
    { "id": "autoria_onpage",     "rotulo": "Sinais de autoria",  "peso": 10,
      "fonte": "modulo_b" },
    { "id": "tecnica",            "rotulo": "Acessibilidade técnica", "peso": 25,
      "fonte": "modulo_b", "multiplicador": true },
    { "id": "local_nap",          "rotulo": "Presença local e NAP",  "peso": 20,
      "fonte": "modulo_b" },
    { "id": "estrutura",          "rotulo": "Estrutura de conteúdo", "peso": 12,
      "fonte": "modulo_b" },
    { "id": "dados_estruturados", "rotulo": "Dados estruturados",    "peso": 8,
      "fonte": "modulo_b" }
  ]
}
```

A divisão dos 35 originais em **25 externo + 10 on-page** existe para impedir dupla
contagem: o E-E-A-T que o site declara não é a mesma coisa que a autoridade que a IA
mede.

### 7.1 Cálculo

```
indice_bruto = 100 × Σ(peso × nota) / Σ(peso dos pilares medidos)

// multiplicador do pilar técnico — não é soma
se algum crawler de família crítica estiver bloqueado
   (por robots OU por 403/429):
      indice = min(indice_bruto, 30)
      motivo_teto = "{UA} bloqueado"
```

Não faz sentido dar 78 para um site que a IA não consegue ler.

**Sem site informado:** `indice = null`. Só as métricas de visibilidade são exibidas.
O front usa isso como gancho — *"informe seu site para receber o índice completo"* —
que é honesto e converte.

`versao_pesos` na tabela `auditorias` guarda o campo `versao` do JSON. Sem isso,
quando os pesos mudarem não haverá como comparar o laudo de agosto com o de novembro
nem reprocessar o histórico.

---

## 8. Módulo C — laudo por template

Zero LLM. `laudo/gatilhos.json` + montagem em TypeScript.

### 8.1 Ordem de prioridade, sem exceção

```
1. multiplicador acionado          → sempre a recomendação 1
2. dominios_do_nicho com frequência ≥ 40% e cliente_presente !== true
3. maior déficit ponderado: peso × (1 − nota)
```

### 8.2 Estrutura de um gatilho

```json
{
  "id": "bot_critico_bloqueado",
  "condicao": "tecnica.bloqueio_silencioso === true",
  "pilar": "tecnica",
  "titulo": "Seu site bloqueia os robôs que alimentam as respostas de IA",
  "texto": "O {ua} recebeu erro {status} ao tentar ler {url}. Seu robots.txt está liberado — o bloqueio vem de uma regra de firewall ou de plugin de segurança. Enquanto isso durar, seu site existe para pessoas e não existe para essas ferramentas.",
  "dado": "{ua} → HTTP {status}"
}
```

Cada gatilho **precisa** citar dado real da auditoria. Recomendação sem número não
entra na biblioteca.

### 8.3 Diagnóstico

Duas a três frases, montadas por regra:

```
se taxa_mencao === 0:
  "Rodamos {n} perguntas que um cliente faria sobre {segmento} em {cidade}.
   Em {total} execuções, o nome {negocio} não apareceu nenhuma vez.
   A IA recomendou {c1}, {c2} e {c3}."

se taxa_mencao > 0 && < 0.34:
  "{negocio} apareceu em {mencoes} de {total} execuções, na posição média {pos}.
   {c1} apareceu em {n1}."
```

### 8.4 Regras de escrita, herdadas do documento-mestre

Frases curtas, verbos no presente, português do Brasil. Tratar o dono como adulto:
explicar o que o resultado custa em clientes, não vender o serviço. **Zero elogio
vazio** — "parabéns pelo seu perfil" destrói a credibilidade do laudo inteiro.
Palavras proibidas: revolucionário, único no mercado, transformador, disruptivo.

O template garante isso por construção. Era esse o motivo de tirar o LLM daqui.

---

## 9. Job de refresh do corpus

Netlify Scheduled Function, mensal, dia 1 às 03:00. Projeto **`raiox-corpus`, com
billing**.

```
para cada nicho ativo:
  para cada pergunta p1..p5:                    // templates fixos, sem LLM
    para execucao em 1..3:
      1. gerar com Gemini + grounding           // prompt cego, §4.3 da spec
      2. extrair entidades (Flash)              // prompt cego, §4.4
      3. inserir em respostas
      4. sleep(4s)                              // free tier: 15 RPM
  atualizar nichos.corpus_em
```

**A pergunta nunca contém o nome de negócio nenhum.** É o P1, e no refresh ele é
garantido pela estrutura: o job não tem acesso à tabela `auditorias`.

Escrita transacional por nicho: as 15 respostas entram juntas ou nenhuma entra.
Corpus meio gravado produz `taxa_mencao` calculada sobre denominador errado.

Volume por rodada: 32 nichos × 15 = **480 gerações com grounding** e 480 extrações.
Ambos dentro das cotas. Duração com o sleep: ~35 minutos.

Guarda de custo: se `gerações_no_mes > TETO_GERACOES` (default 1.000), o job aborta e
envia alerta. Testar com estouro simulado antes de considerar pronto — é a mesma
regra do dia 5 da Frente B.

### 9.1 Job de fila

Diário, 04:00. Roda o mesmo pipeline sobre nichos com `origem = 'fila'`, no máximo 3
por dia. Ao concluir, dispara e-mail com o laudo completo e alerta o SC. Nicho pedido
3 vezes ou mais vira `origem = 'matriz'`, `ativo = true` e entra no refresh mensal.

---

## 10. Segurança, limites e degradação

| Item | Implementação |
|---|---|
| Chaves | apenas em env da função. CSP no front bloqueia `connect-src` para domínios de API de modelo |
| Rate limit | 3 consultas por `ip_hash` por dia, transação `INSERT … ON CONFLICT DO UPDATE` com `CHECK` |
| Validação | `zod` no boundary de toda função. Rejeitar entrada < 3 chars (§4.1) |
| SSRF | o `site` do usuário é buscado server-side. **Bloquear IP privado, `localhost`, `169.254.*`, esquemas não-http(s), portas não padrão.** Resolver DNS antes e validar o IP resolvido |
| Tamanho de resposta | truncar HTML remoto em 2 MB; abortar acima disso |
| Teto de gasto | contador diário no Supabase por provedor; ao atingir, degrada em vez de falhar |
| CORS | `Access-Control-Allow-Origin` apenas para o domínio do front |

### 10.1 Matriz de degradação

Nenhuma dessas falhas devolve erro ao visitante.

| Falha | Comportamento |
|---|---|
| Um motor falhou no corpus | execuções marcadas `valida = false`, saem do denominador |
| Corpus não existe para o nicho | `status: "na_fila"`, Módulo B roda normalmente, captura antes do resultado |
| Site inacessível / timeout | `site_resultado.avaliado: false` com `motivo`. Módulo A intacto. **É achado, não erro** |
| LLM de julgamento falhou | `conteudo: null`, pilar `estrutura` sai do denominador do índice |
| PageSpeed falhou | `psi_mobile: null`, não pontua |
| Webhook do n8n falhou | lead persistido, entrega reprocessável por job |

---

## 11. Variáveis de ambiente

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
IP_SALT
GEMINI_KEY_CONSULTA      # projeto SEM billing — só julgamento de site
GEMINI_KEY_CORPUS        # projeto COM billing — grounding, só no job
PERPLEXITY_KEY           # vazio no MVP; motor liga por config
MOTORES_ATIVOS=gemini
PSI_KEY                  # opcional; sem chave a cota é menor mas existe
WEBHOOK_LEADS
TETO_GERACOES_MES=1000
RATE_LIMIT_DIA=3
```

**`GEMINI_KEY_CONSULTA` e `GEMINI_KEY_CORPUS` nunca podem ser a mesma chave.**
Habilitar billing num projeto apaga o free tier daquele projeto — não soma,
substitui. Se a chave for compartilhada, ou o corpus perde o grounding ou a consulta
perde a gratuidade, e a descoberta acontece em produção.

---

## 12. Plano de construção — 10 dias

Pressupõe o protótipo de front pronto e consumindo mocks.

| Dia | Entrega | Verificação |
|---|---|---|
| **1** | Dois projetos Google criados · **testar grounding sem billing** · schema no Supabase com RLS | 10 chamadas de teste; se grounding funcionar sem billing, cai um projeto |
| **2** | `crawlers.json`, `pesos.json`, `segmentos.json`, `nomes_comuns.json` · normalização e Jaro-Winkler com testes unitários | 20 casos de casamento, incluindo 5 de nome genérico |
| **3** | Job de refresh sobre **1 nicho**, revisão humana das 15 respostas antes de automatizar | qualidade do texto conferida à mão |
| **4** | Job de refresh completo sobre os 32 nichos · teto de gasto com estouro simulado | corpus populado, corte testado |
| **5** | Módulo A ponta a ponta: `POST /api/raiox` devolvendo `Visibilidade` real | latência < 1 s |
| **6** | Módulo B — checagens determinísticas e bloqueio silencioso | testar contra 3 sites reais, um deles com WAF |
| **7** | Módulo B — chamada de julgamento, PSI, índice com multiplicador | site com bot bloqueado deve dar ≤ 30 |
| **8** | Módulo C por template · biblioteca de gatilhos · `GET /api/raiox/:id` | 5 laudos revisados à mão pelos dois sócios |
| **9** | Lead, fila, webhook, rate limit, SSRF, CORS | tentar consumir 4 consultas do mesmo IP |
| **10** | **Trocar mock por API real no front** · deploy · aviso de privacidade no ar | 5 auditorias reais ponta a ponta |

Se um dia atrasar, a ordem de corte é: **primeiro adiar o segundo motor, depois o
PSI, nunca o bloqueio silencioso.** O bloqueio silencioso é o achado que converte.

### 12.1 Definition of done

- [ ] Consulta em nicho coberto responde o Módulo A em < 1 s
- [ ] Auditoria completa com site conclui em < 25 s
- [ ] Nenhuma chave de API aparece no bundle do front (`grep` no `dist`)
- [ ] Rate limit bloqueia a 4ª consulta do mesmo IP no mesmo dia
- [ ] Site com `PerplexityBot` bloqueado produz índice ≤ 30 com motivo em destaque
- [ ] Falha de motor sai do denominador e não vira "não citado"
- [ ] Nome genérico com token < 5 chars é marcado `incerto`
- [ ] `texto` bruto recuperável para toda menção do laudo
- [ ] Teto de geração corta o job em estouro simulado
- [ ] Aviso de privacidade publicado, declarando processamento do conteúdo do site por terceiro
- [ ] `versao_pesos` gravado em toda auditoria

---

## 13. O que fica fora

Registrado para não virar scope creep: segundo e terceiro motor · AI Overviews ·
Google Business Profile e reputação (são o produto do IPD, vendável depois) · PDF
automático do laudo · painel, histórico, monitoramento recorrente · verificação de
`cliente_presente` nos diretórios · multi-idioma.

---

*Intellectus Digital · Tech-Spec Raio-X de IA · v1.0 · Agosto de 2026*
*Implementa a spec original com as alterações da emenda de custo zero. Limites de
free tier reconferir na página oficial antes do dia 1*
