-- Migration: rename preferences.dietary_restrictions -> preferences.diet
-- Run in the Supabase SQL editor on existing databases.
-- Safe to re-run (guarded by IF EXISTS).

alter table preferences
  rename column dietary_restrictions to diet;
