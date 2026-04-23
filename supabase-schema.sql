create extension if not exists "uuid-ossp";

-- Tabla de abonos de manutención
create table if not exists public.mantencion_entries (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null default 'Nuevo abono',
  monto       numeric(15,2) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.mantencion_entries enable row level security;
create policy "mantencion_self" on public.mantencion_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            varchar(100) not null,
  age             smallint,
  weight_kg       numeric(5,2),
  height_cm       numeric(5,1),
  activity_level  varchar(20)  default 'moderado'
                  check (activity_level in ('sedentario','moderado','activo')),
  goal            varchar(50)  default 'recomposicion'
                  check (goal in ('recomposicion','bajar','ganar')),
  monthly_income  integer      check (monthly_income >= 0),
  pay_day         smallint     default 5
                  check (pay_day between 1 and 31),
  city            varchar(80),
  pets            jsonb        default '[]'::jsonb,
  preferences     jsonb        default '{}'::jsonb,
  created_at      timestamptz  not null default now()
);

create table if not exists public.suppliers (
  id                  uuid primary key default uuid_generate_v4(),
  name                varchar(80) not null unique,
  type                varchar(30) check (type in ('supermercado','feria','online')),
  base_url            text,
  search_url_pattern  text,
  logo_url            text,
  is_active           boolean default true
);

insert into public.suppliers (name, type, base_url, search_url_pattern) values
  ('Líder',  'supermercado', 'https://www.lider.cl',  'https://www.lider.cl/supermercado/search?Ntt={query}'),
  ('Tottus', 'supermercado', 'https://www.tottus.cl', 'https://www.tottus.cl/search?q={query}'),
  ('Jumbo',  'supermercado', 'https://www.jumbo.cl',  'https://www.jumbo.cl/search?q={query}'),
  ('Feria',  'feria',        null,                    null)
on conflict (name) do nothing;