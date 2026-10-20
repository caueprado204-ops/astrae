-- ASTRAE 0002 — investigação estruturada, revisão por pesquisadores e sugestões.
-- Idempotente: pode ser executada mais de uma vez.

alter table public.projects
  add column if not exists justification text not null default '',
  add column if not exists objectives text not null default '',
  add column if not exists data_sources text not null default '',
  add column if not exists methodology text not null default '',
  add column if not exists results text not null default '',
  add column if not exists limitations text not null default '',
  add column if not exists references_text text not null default '',
  add column if not exists next_steps text not null default '',
  add column if not exists axis text not null default 'livre',
  add column if not exists review_status text not null default 'rascunho',
  add column if not exists reviewer_name text not null default '',
  add column if not exists reviewer_note text not null default '',
  add column if not exists reviewed_at timestamptz;

do $$ begin
  alter table public.projects add constraint projects_axis_chk check (axis in ('clima-saude','territorio','livre'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_review_chk check (review_status in ('rascunho','em-revisao','revisado'));
exception when duplicate_object then null; end $$;

-- Sugestões e críticas de pesquisadores (privadas: cada pessoa vê só as próprias; leitura geral só pelo service role)
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page text not null default '',
  kind text not null default 'sugestao' check (kind in ('sugestao','critica-metodologica','fonte-de-dados','erro')),
  message text not null check (char_length(message) between 5 and 5000),
  contact text not null default '',
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated with check (user_id = auth.uid());
drop policy if exists feedback_select_own on public.feedback;
create policy feedback_select_own on public.feedback for select to authenticated using (user_id = auth.uid());
