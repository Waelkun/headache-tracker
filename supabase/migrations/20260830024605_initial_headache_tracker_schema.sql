create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en' check (locale in ('ar', 'en')),
  timezone text not null default 'Europe/Berlin',
  tracking_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.headache_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed')),
  started_at timestamptz not null,
  ended_at timestamptz,
  onset_kind text not null default 'unknown' check (onset_kind in ('sudden', 'gradual', 'on_waking', 'unknown')),
  start_precision text not null default 'exact' check (start_precision in ('exact', 'approximate', 'unknown')),
  pain_character text[] not null default '{}',
  notes text,
  ai_source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint headache_episodes_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint headache_episodes_status_consistent check (
    (status = 'active' and ended_at is null) or
    (status = 'completed' and ended_at is not null)
  )
);

create table public.intensity_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.headache_episodes(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  intensity smallint not null check (intensity between 0 and 10),
  is_approximate boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  constraint intensity_segments_end_after_start check (ended_at is null or ended_at > started_at)
);

create table public.pain_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.headache_episodes(id) on delete cascade,
  mark_type text not null check (mark_type in ('point', 'area')),
  region_code text,
  points jsonb not null default '[]'::jsonb,
  intensity smallint check (intensity between 0 and 10),
  created_at timestamptz not null default now(),
  constraint pain_locations_points_array check (jsonb_typeof(points) = 'array')
);

create table public.episode_symptoms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.headache_episodes(id) on delete cascade,
  symptom_code text not null,
  severity smallint check (severity between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  unique (episode_id, symptom_code)
);

create table public.episode_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.headache_episodes(id) on delete cascade,
  intervention_type text not null check (intervention_type in ('medication', 'coffee', 'sleep', 'rest', 'head_wrap', 'water', 'dark_room', 'custom')),
  label text,
  amount numeric(8,2),
  unit text,
  performed_at timestamptz not null,
  intensity_before smallint check (intensity_before between 0 and 10),
  intensity_after smallint check (intensity_after between 0 and 10),
  effect text check (effect is null or effect in ('much_better', 'slightly_better', 'no_change', 'worse', 'unknown')),
  effect_delay_minutes integer check (effect_delay_minutes is null or effect_delay_minutes >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.episode_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.headache_episodes(id) on delete cascade,
  context_code text not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (episode_id, context_code)
);

create table public.ai_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid references public.headache_episodes(id) on delete set null,
  raw_text text not null,
  parsed_payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'applied', 'rejected')),
  created_at timestamptz not null default now()
);

create index headache_episodes_user_started_idx on public.headache_episodes (user_id, started_at desc);
create unique index headache_episodes_one_active_per_user_idx on public.headache_episodes (user_id) where status = 'active';
create index intensity_segments_user_episode_started_idx on public.intensity_segments (user_id, episode_id, started_at);
create index intensity_segments_episode_id_idx on public.intensity_segments (episode_id);
create index pain_locations_user_episode_idx on public.pain_locations (user_id, episode_id);
create index pain_locations_episode_id_idx on public.pain_locations (episode_id);
create index episode_symptoms_user_episode_idx on public.episode_symptoms (user_id, episode_id);
create index episode_symptoms_episode_id_idx on public.episode_symptoms (episode_id);
create index episode_interventions_user_episode_time_idx on public.episode_interventions (user_id, episode_id, performed_at);
create index episode_interventions_episode_id_idx on public.episode_interventions (episode_id);
create index episode_contexts_user_episode_idx on public.episode_contexts (user_id, episode_id);
create index episode_contexts_episode_id_idx on public.episode_contexts (episode_id);
create index ai_intakes_user_created_idx on public.ai_intakes (user_id, created_at desc);
create index ai_intakes_episode_id_idx on public.ai_intakes (episode_id) where episode_id is not null;

alter table public.profiles enable row level security;
alter table public.headache_episodes enable row level security;
alter table public.intensity_segments enable row level security;
alter table public.pain_locations enable row level security;
alter table public.episode_symptoms enable row level security;
alter table public.episode_interventions enable row level security;
alter table public.episode_contexts enable row level security;
alter table public.ai_intakes enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy episodes_select_own on public.headache_episodes for select to authenticated using ((select auth.uid()) = user_id);
create policy episodes_insert_own on public.headache_episodes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy episodes_update_own on public.headache_episodes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy episodes_delete_own on public.headache_episodes for delete to authenticated using ((select auth.uid()) = user_id);

create policy intensity_select_own on public.intensity_segments for select to authenticated using ((select auth.uid()) = user_id);
create policy intensity_insert_own on public.intensity_segments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy intensity_update_own on public.intensity_segments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy intensity_delete_own on public.intensity_segments for delete to authenticated using ((select auth.uid()) = user_id);

create policy locations_select_own on public.pain_locations for select to authenticated using ((select auth.uid()) = user_id);
create policy locations_insert_own on public.pain_locations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy locations_update_own on public.pain_locations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy locations_delete_own on public.pain_locations for delete to authenticated using ((select auth.uid()) = user_id);

create policy symptoms_select_own on public.episode_symptoms for select to authenticated using ((select auth.uid()) = user_id);
create policy symptoms_insert_own on public.episode_symptoms for insert to authenticated with check ((select auth.uid()) = user_id);
create policy symptoms_update_own on public.episode_symptoms for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy symptoms_delete_own on public.episode_symptoms for delete to authenticated using ((select auth.uid()) = user_id);

create policy interventions_select_own on public.episode_interventions for select to authenticated using ((select auth.uid()) = user_id);
create policy interventions_insert_own on public.episode_interventions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy interventions_update_own on public.episode_interventions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy interventions_delete_own on public.episode_interventions for delete to authenticated using ((select auth.uid()) = user_id);

create policy contexts_select_own on public.episode_contexts for select to authenticated using ((select auth.uid()) = user_id);
create policy contexts_insert_own on public.episode_contexts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy contexts_update_own on public.episode_contexts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy contexts_delete_own on public.episode_contexts for delete to authenticated using ((select auth.uid()) = user_id);

create policy ai_intakes_select_own on public.ai_intakes for select to authenticated using ((select auth.uid()) = user_id);
create policy ai_intakes_insert_own on public.ai_intakes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ai_intakes_update_own on public.ai_intakes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ai_intakes_delete_own on public.ai_intakes for delete to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.headache_episodes to authenticated;
grant select, insert, update, delete on public.intensity_segments to authenticated;
grant select, insert, update, delete on public.pain_locations to authenticated;
grant select, insert, update, delete on public.episode_symptoms to authenticated;
grant select, insert, update, delete on public.episode_interventions to authenticated;
grant select, insert, update, delete on public.episode_contexts to authenticated;
grant select, insert, update, delete on public.ai_intakes to authenticated;

revoke all on public.profiles from anon;
revoke all on public.headache_episodes from anon;
revoke all on public.intensity_segments from anon;
revoke all on public.pain_locations from anon;
revoke all on public.episode_symptoms from anon;
revoke all on public.episode_interventions from anon;
revoke all on public.episode_contexts from anon;
revoke all on public.ai_intakes from anon;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function app_private.set_updated_at();
create trigger episodes_set_updated_at before update on public.headache_episodes for each row execute function app_private.set_updated_at();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function app_private.set_updated_at() from public, anon, authenticated;
revoke execute on function app_private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();
