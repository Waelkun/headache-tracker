create table public.intervention_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  default_unit text check (default_unit is null or char_length(default_unit) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index intervention_templates_user_name_idx
  on public.intervention_templates (user_id, lower(trim(name)));

alter table public.intervention_templates enable row level security;

create policy intervention_templates_select_own
  on public.intervention_templates for select to authenticated
  using ((select auth.uid()) = user_id);

create policy intervention_templates_insert_own
  on public.intervention_templates for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy intervention_templates_update_own
  on public.intervention_templates for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy intervention_templates_delete_own
  on public.intervention_templates for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.intervention_templates to authenticated;
revoke all on public.intervention_templates from anon;

create trigger intervention_templates_set_updated_at
before update on public.intervention_templates
for each row execute function app_private.set_updated_at();
