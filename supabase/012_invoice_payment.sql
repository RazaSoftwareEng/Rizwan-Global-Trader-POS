-- =============================================================
-- 012: payment at invoice creation
--   Pay later -> unpaid, with a due date
--   Paid now  -> paid, with method (Cash, Bank Transfer...); non-cash needs a reference no.
-- Run in: Supabase > SQL Editor
-- =============================================================

alter table public.invoices
  add column if not exists due_date       date,
  add column if not exists payment_method text,
  add column if not exists payment_ref    text,
  add column if not exists payment_details text,
  add column if not exists paid_at        timestamptz;

-- Replace create_invoice with a version that takes the payment choice
drop function if exists public.create_invoice(uuid, uuid, jsonb, date, numeric, numeric, text);

create or replace function public.create_invoice(
  p_company_id     uuid,
  p_customer_id    uuid,
  p_items          jsonb,
  p_invoice_date   date    default current_date,
  p_discount       numeric default 0,
  p_tax_percent    numeric default 0,
  p_notes          text    default null,
  p_status         text    default 'unpaid',
  p_due_date       date    default null,
  p_payment_method text    default null,
  p_payment_ref    text    default null,
  p_payment_details text   default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_subtotal numeric(12,2);
  v_taxable  numeric(12,2);
  v_tax      numeric(12,2);
  v_inserted int;
begin
  if not public.is_active_user() then
    raise exception 'Your account is not active';
  end if;

  p_discount    := coalesce(p_discount, 0);
  p_tax_percent := coalesce(p_tax_percent, 0);
  p_status      := coalesce(p_status, 'unpaid');

  if p_status not in ('paid', 'unpaid') then
    raise exception 'Status must be paid or unpaid';
  end if;
  if p_status = 'paid' and nullif(trim(p_payment_method), '') is null then
    raise exception 'Choose how the payment was received';
  end if;
  if p_status = 'paid' and trim(p_payment_method) <> 'Cash' and nullif(trim(p_payment_ref), '') is null then
    raise exception 'Enter the transaction / reference number for this payment';
  end if;
  if p_status = 'unpaid' and p_due_date is not null and p_due_date < coalesce(p_invoice_date, current_date) then
    raise exception 'Due date cannot be before the invoice date';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where coalesce((i->>'qty')::numeric, 0) <= 0
       or coalesce((i->>'unit_price')::numeric, -1) < 0
  ) then
    raise exception 'Every item needs qty > 0 and a price of 0 or more';
  end if;

  select coalesce(sum(round((i->>'qty')::numeric * (i->>'unit_price')::numeric, 2)), 0)
    into v_subtotal from jsonb_array_elements(p_items) i;

  if p_discount < 0 or p_discount > v_subtotal then
    raise exception 'Discount must be between 0 and the subtotal';
  end if;
  if p_tax_percent < 0 or p_tax_percent > 100 then
    raise exception 'Tax %% must be between 0 and 100';
  end if;

  v_taxable := v_subtotal - p_discount;
  v_tax     := round(v_taxable * p_tax_percent / 100, 2);

  insert into invoices (invoice_no, company_id, customer_id, invoice_date,
                        subtotal, discount, tax_percent, tax_amount, total, notes,
                        status, due_date, payment_method, payment_ref, payment_details, paid_at)
  values ('RGT-INV-' || to_char(coalesce(p_invoice_date, current_date), 'YYMM') || '-' || lpad(nextval('invoice_no_seq')::text, 4, '0'),
          p_company_id, p_customer_id, coalesce(p_invoice_date, current_date),
          v_subtotal, p_discount, p_tax_percent, v_tax, v_taxable + v_tax, p_notes,
          p_status,
          case when p_status = 'unpaid' then p_due_date end,
          case when p_status = 'paid' then trim(p_payment_method) end,
          case when p_status = 'paid' then nullif(trim(p_payment_ref), '') end,
          case when p_status = 'paid' then nullif(trim(p_payment_details), '') end,
          case when p_status = 'paid' then now() end)
  returning id into v_id;

  insert into invoice_items (invoice_id, product_id, product_name, unit, qty, unit_price, line_total, sort_order)
  select v_id, p.id, p.name, p.unit,
         (t.i->>'qty')::numeric, (t.i->>'unit_price')::numeric,
         round((t.i->>'qty')::numeric * (t.i->>'unit_price')::numeric, 2), t.ord::int
    from jsonb_array_elements(p_items) with ordinality as t(i, ord)
    join products p on p.id = (t.i->>'product_id')::uuid;

  get diagnostics v_inserted = row_count;
  if v_inserted <> jsonb_array_length(p_items) then
    raise exception 'One or more products were not found';
  end if;

  return v_id;
end;
$$;

revoke execute on function public.create_invoice(uuid, uuid, jsonb, date, numeric, numeric, text, text, date, text, text, text) from public, anon;
grant  execute on function public.create_invoice(uuid, uuid, jsonb, date, numeric, numeric, text, text, date, text, text, text) to authenticated;

notify pgrst, 'reload schema';
