-- =============================================================
-- 010: 10 templates; each customer has one, and a template belongs
-- to one customer only.
-- Run in: Supabase > SQL Editor
-- =============================================================

alter table public.companies drop constraint if exists companies_doc_template_check;
alter table public.companies
  add constraint companies_doc_template_check
  check (doc_template in ('classic', 'modern', 'minimal', 'corporate', 'executive', 'elegant', 'bold', 'ledger', 'compact', 'premium'));

alter table public.customers
  add column if not exists doc_template text
    check (doc_template is null or doc_template in ('classic', 'modern', 'minimal', 'corporate', 'executive', 'elegant', 'bold', 'ledger', 'compact', 'premium'));

-- One customer per template
create unique index if not exists customers_doc_template_unique
  on public.customers (doc_template)
  where doc_template is not null;

notify pgrst, 'reload schema';
