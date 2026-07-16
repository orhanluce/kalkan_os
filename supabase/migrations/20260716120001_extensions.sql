-- Extensions required by later migrations. Pure Postgres extensions only
-- (no Supabase-specific services) to keep the schema portable to
-- self-hosted Postgres per docs/ROADMAP.md data-localization note.
create extension if not exists pgcrypto;
