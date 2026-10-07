-- ════════════════════════════════════════════════════════════════════════
-- ASTRAE — esquema PostgreSQL (Supabase)
-- Princípio: API oficial → backend → cache/banco → frontend.
-- Datasets grandes NÃO são copiados: guardamos metadados, referências e URLs.
-- Dados pessoais são privados por padrão (RLS: dono = auth.uid()).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── users (perfil ligado ao auth.users) ───────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  institution text,
  units text not null default 'metric',
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── catálogo público de fontes e datasets (somente metadados) ─────────
create table if not exists public.sources (
  id text primary key,
  institution text not null,
  api_name text not null,
  docs_url text not null,
  requires_key boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id text primary key,                          -- ex.: 'noaa:oni', 'cmr:C2586786218-POCLOUD'
  source_id text references public.sources(id),
  title text not null,
  kind text not null check (kind in ('OBSERVED','FORECAST','MODEL','ESTIMATE','SIMULATION','INDEX','CATALOG','IMAGERY','DEMO')),
  variables text[] not null default '{}',
  unit text,
  spatial_coverage text,
  time_start date,
  time_end date,
  original_url text not null,
  api_endpoint text,
  methodology text,
  updated_at timestamptz not null default now()
);

-- séries pequenas cacheadas (ex.: ONI mensal) — leitura pública, escrita só pelo backend
create table if not exists public.observations (
  dataset_id text not null references public.datasets(id) on delete cascade,
  variable text not null,
  location text not null default 'global',
  t timestamptz not null,
  value double precision,
  unit text,
  kind text not null,
  fetched_at timestamptz not null default now(),
  primary key (dataset_id, variable, location, t)
);

-- cache persistente das respostas de APIs (somente service role)
create table if not exists public.api_cache (
  key text primary key,
  value jsonb not null,
  stored_at timestamptz not null default now(),
  ttl_ms bigint not null
);

-- ─── espaço pessoal do pesquisador ─────────────────────────────────────
create table if not exists public.projects (            -- "researches" / MY RESEARCH
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  hypothesis text not null default '',
  questions text[] not null default '{}',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_items (      -- dados, gráficos, mapas e referências salvos num projeto
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_type text not null check (item_type in ('dataset','timeseries','image','map','article','document','chart','reference','video')),
  title text not null,
  source text not null,
  institution text,
  original_url text not null,
  provenance jsonb not null,          -- {source, dataset, kind, accessedAt, unit, period, location, ...}
  payload jsonb,                      -- ex.: configuração do gráfico ou parâmetros de consulta (nunca o dataset inteiro)
  created_at timestamptz not null default now()
);

create table if not exists public.notes (               -- ASTRAE NOTEBOOK
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Sem título',
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  external_id text not null,
  title text not null,
  source text not null,
  institution text,
  kind text not null,
  original_url text not null,
  provenance jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  query text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  unique (user_id, name)
);

create table if not exists public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists research_items_project_idx on public.research_items(project_id);
create index if not exists notes_user_idx on public.notes(user_id, updated_at desc);
create index if not exists saved_datasets_user_idx on public.saved_datasets(user_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.research_items enable row level security;
alter table public.notes enable row level security;
alter table public.saved_datasets enable row level security;
alter table public.saved_searches enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
alter table public.sources enable row level security;
alter table public.datasets enable row level security;
alter table public.observations enable row level security;
alter table public.api_cache enable row level security;   -- sem políticas: só service role

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['projects','research_items','notes','saved_datasets','saved_searches','tags','note_tags'] loop
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('create policy "owner all" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- projeto só fica visível a terceiros se o dono marcar explicitamente como público
create policy "public projects readable" on public.projects for select using (is_public = true);

-- research_items só podem apontar para projetos do próprio usuário
create policy "items in own project" on public.research_items as restrictive for insert
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "catalog read" on public.sources for select using (true);
create policy "catalog read" on public.datasets for select using (true);
create policy "observations read" on public.observations for select using (true);

-- ─── catálogo inicial de fontes ───────────────────────────────────────
insert into public.sources (id, institution, api_name, docs_url, requires_key) values
  ('nasa-apod','NASA','APOD','https://api.nasa.gov',true),
  ('nasa-images','NASA','Image and Video Library','https://images.nasa.gov',false),
  ('nasa-cmr','NASA Earthdata','CMR','https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html',false),
  ('nasa-ntrs','NASA STI','NTRS','https://ntrs.nasa.gov/api/openapi/',false),
  ('nasa-gibs','NASA ESDIS','GIBS WMTS','https://nasa-gibs.github.io/gibs-api-docs/',false),
  ('nasa-power','NASA Langley','POWER','https://power.larc.nasa.gov/docs/services/api/',false),
  ('nasa-msl','NASA/JPL · CAB','MSL REMS weather','https://mars.nasa.gov/msl/weather/',false),
  ('noaa-cpc','NOAA','CPC indices','https://www.cpc.ncep.noaa.gov/data/indices/',false),
  ('noaa-cdo','NOAA NCEI','Climate Data Online v2','https://www.ncdc.noaa.gov/cdo-web/webservices/v2',true),
  ('inpe-cptec','CPTEC/INPE','XML de previsão','http://servicos.cptec.inpe.br/XML/',false)
on conflict (id) do nothing;

insert into public.datasets (id, source_id, title, kind, variables, unit, spatial_coverage, time_start, original_url, api_endpoint, methodology) values
  ('noaa:oni','noaa-cpc','Oceanic Niño Index (ONI)','INDEX','{sst_anomaly}','°C','Niño 3.4','1950-01-01',
   'https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php','https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
   'Média móvel de 3 meses da anomalia de TSM ERSST.v5'),
  ('nasa:msl-rems','nasa-msl','Curiosity REMS — resumo por sol','OBSERVED','{air_temp_min,air_temp_max,ground_temp,pressure}','°C, Pa','Cratera Gale, Marte','2012-08-15',
   'https://mars.nasa.gov/msl/weather/','https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json','Estação REMS a bordo do rover'),
  ('nasa:power-daily','nasa-power','POWER Daily (ponto)','MODEL','{T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,PS,RH2M,WS10M,ALLSKY_SFC_SW_DWN}',null,'Global (0,5°)','1981-01-01',
   'https://power.larc.nasa.gov/','https://power.larc.nasa.gov/api/temporal/daily/point','Reanálise MERRA-2 / GEOS FP-IT / CERES')
on conflict (id) do nothing;
