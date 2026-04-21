-- Recipe Agent — Supabase schema
-- Run once in the Supabase SQL editor to create all tables.

create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  created_at timestamptz default now()
);

create table if not exists preferences (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references users(id) on delete cascade,
  diet                 text[],
  disliked_ingredients text[],
  favorite_cuisines    text[]
);

create table if not exists feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  recipe_name text,
  rating      integer,
  ingredients text[],
  cuisine     text,
  model_used  text,
  created_at  timestamptz default now()
);

create table if not exists chat_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  session_id    uuid,
  role          text,
  content       text,
  checkpoint_id text,
  model_used    text,
  tokens_used   integer,
  created_at    timestamptz default now()
);

create table if not exists checkpoints (
  id         text primary key,
  user_id    uuid references users(id) on delete cascade,
  session_id uuid,
  state_json jsonb,
  created_at timestamptz default now()
);

-- Seed two demo users
insert into users (name, email) values
  ('Alice', 'alice@example.com'),
  ('Bob',   'bob@example.com')
on conflict do nothing;
