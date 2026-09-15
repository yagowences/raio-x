-- 0003_estado.sql
-- Estado (sigla de UF) do negócio auditado, ao lado de `cidade`. Sem
-- `not null`: linhas gravadas antes desta coluna não têm valor.
alter table public.auditorias add column if not exists estado text;
