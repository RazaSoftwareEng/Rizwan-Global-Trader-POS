-- =============================================================
-- 006: daily bills & expenses
-- Admins see/edit/delete everything; cashiers add and see their own.
-- Run in: Supabase > SQL Editor
-- =============================================================

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default current_date,
  category        text not null,
  reason          text not null check (length(trim(reason)) > 0),
  amount          numeric(12,2) not null check (amount > 0),
  paid_to         text,
  payment_method  text not null default 'Cash',
  reference       text,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc);

alter table public.expenses enable row level security;

drop policy if exists "read: admins all, others own" on public.expenses;
create policy "read: admins all, others own" on public.expenses
  for select to authenticated
  using (public.is_admin() or (public.is_active_user() and created_by = auth.uid()));

drop policy if exists "active users add own" on public.expenses;
create policy "active users add own" on public.expenses
  for insert to authenticated
  with check (public.is_active_user() and created_by = auth.uid());

drop policy if exists "admins update" on public.expenses;
create policy "admins update" on public.expenses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete" on public.expenses;
create policy "admins delete" on public.expenses
  for delete to authenticated using (public.is_admin());
