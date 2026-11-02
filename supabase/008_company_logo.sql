-- =============================================================
-- 008: company logo (small image stored as a data URL)
-- Run in: Supabase > SQL Editor
-- =============================================================

alter table public.companies
  add column if not exists logo text
    check (logo is null or (logo like 'data:image/%' and length(logo) < 1500000));
