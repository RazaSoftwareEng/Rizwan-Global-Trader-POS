-- =============================================================
-- 009: allow the Executive and Elegant templates
-- Run in: Supabase > SQL Editor
-- =============================================================

alter table public.companies drop constraint if exists companies_doc_template_check;
alter table public.companies
  add constraint companies_doc_template_check
  check (doc_template in ('classic', 'modern', 'minimal', 'corporate', 'executive', 'elegant'));
