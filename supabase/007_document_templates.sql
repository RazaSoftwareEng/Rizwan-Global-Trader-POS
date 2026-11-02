-- =============================================================
-- 007: invoice / quotation template + accent colour (per company)
-- Run in: Supabase > SQL Editor
-- =============================================================

alter table public.companies
  add column if not exists doc_template text not null default 'classic'
    check (doc_template in ('classic', 'modern', 'minimal', 'corporate')),
  add column if not exists doc_accent text not null default '#1c5cab'
    check (doc_accent ~ '^#[0-9a-fA-F]{6}$');
