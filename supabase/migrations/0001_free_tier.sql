-- 0001_free_tier.sql
-- Etapa gratuita do Raio-X de IA: Módulo B (auditoria de site) + índice sobre 75 + laudo.
-- Só as três tabelas que o fluxo gratuito toca. `nichos` e `respostas` (Módulo A /
-- corpus) ficam para quando a varredura de nicho entrar. Ver docs/ref/tech-spec-v1.md §3.

-- ─────────────────────────────────────────────────────────── auditorias
create table if not exists public.auditorias (
  id             uuid primary key default gen_random_uuid(),
  negocio        text not null,
  segmento       text not null,
  cidade         text not null,
  site           text,
  status         text not null default 'parcial'
                   check (status in ('parcial', 'concluido', 'erro', 'na_fila')),
  site_resultado jsonb,          -- saída do Módulo B
  indice         smallint,       -- 0..100; null quando não há site
  laudo          jsonb,          -- saída do Módulo C (template)
  versao_pesos   text,           -- campo `versao` de config/pesos.json usado
  evidencia      jsonb,          -- P6: html bruto + resposta do LLM, recuperável
  ip_hash        text not null,  -- sha256(ip + IP_SALT). O IP cru nunca é gravado
  criado_em      timestamptz not null default now(),
  concluido_em   timestamptz
);

create index if not exists auditorias_ip_hash_idx
  on public.auditorias (ip_hash, criado_em desc);

-- ─────────────────────────────────────────────────────────── leads
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  auditoria_id  uuid references public.auditorias(id) on delete set null,
  nome          text not null,
  email         text,
  whatsapp      text,
  consentimento boolean not null default true,
  origem        text not null default 'resultado'
                  check (origem in ('resultado', 'fila')),
  criado_em     timestamptz not null default now(),
  constraint leads_contato_check check (email is not null or whatsapp is not null)
);

create index if not exists leads_auditoria_idx on public.leads (auditoria_id);

-- ─────────────────────────────────────────────────────────── rate_limit
-- 3 consultas por ip_hash por dia. O teto vem de RATE_LIMIT_DIA (env var), então
-- a checagem é no código da função, não em CHECK — o schema só conta.
create table if not exists public.rate_limit (
  ip_hash   text not null,
  dia       date not null,
  consultas smallint not null default 0,
  primary key (ip_hash, dia)
);

-- ─────────────────────────────────────────────────────────── RLS
-- Ligado em todas. Nenhuma policy é criada: a chave anon/publicável não lê nem
-- escreve nada. As funções Netlify conectam direto no Postgres pelo pooler, como
-- role privilegiada, e por isso não precisam de policy. RLS aqui é defesa em
-- profundidade — e o revoke abaixo mata o caminho do Data API de vez.
alter table public.auditorias enable row level security;
alter table public.leads      enable row level security;
alter table public.rate_limit enable row level security;

revoke all on public.auditorias from anon, authenticated;
revoke all on public.leads      from anon, authenticated;
revoke all on public.rate_limit from anon, authenticated;
