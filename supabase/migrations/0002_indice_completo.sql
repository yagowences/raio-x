-- 0002_indice_completo.sql
-- `indice` (smallint) guarda só o valor 0..100, útil para query direta. O front
-- precisa do objeto Indice inteiro (pilares, teto, confiança por pilar) para
-- desenhar as barras — isso vai em `indice_completo`, jsonb.
alter table public.auditorias add column if not exists indice_completo jsonb;
