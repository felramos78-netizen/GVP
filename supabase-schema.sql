create extension if not exists "uuid-ossp";

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