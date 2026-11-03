-- =============================================================
-- 011: products belong to a customer's catalog (null = shared).
-- Names / SKUs are unique within each catalog.
-- Run in: Supabase > SQL Editor
-- =============================================================

alter table public.products
  add column if not exists customer_id uuid references public.customers(id) on delete restrict;

create index if not exists products_customer_idx on public.products (customer_id);

-- old rules were unique across all products
alter table public.products drop constraint if exists products_sku_key;
drop index if exists public.products_name_unique;
drop index if exists public.products_sku_unique;

create unique index products_name_unique
  on public.products (coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

create unique index products_sku_unique
  on public.products (coalesce(customer_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(trim(sku)))
  where sku is not null and trim(sku) <> '';

notify pgrst, 'reload schema';
