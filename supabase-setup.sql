create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 160),
  project text not null default '' check (char_length(project) <= 80),
  owner text not null default '' check (char_length(owner) <= 80),
  status text not null default 'To Do' check (status in ('To Do', 'In Progress', 'Blocked', 'Done')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  due_date date,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "Public can read tasks" on public.tasks;
create policy "Public can read tasks"
on public.tasks for select
to anon
using (true);

drop policy if exists "Public can create tasks" on public.tasks;
create policy "Public can create tasks"
on public.tasks for insert
to anon
with check (true);

drop policy if exists "Public can update tasks" on public.tasks;
create policy "Public can update tasks"
on public.tasks for update
to anon
using (true)
with check (true);

drop policy if exists "Public can delete tasks" on public.tasks;
create policy "Public can delete tasks"
on public.tasks for delete
to anon
using (true);

alter publication supabase_realtime add table public.tasks;
