-- execution_legal_snapshots silme disiplini düzeltmesi (V2 PR-4b adım 4b).
--
-- SORUN: 20260718180000 DELETE'i service_role dahil HERKESE kapatmıştı ve
-- test_run_id FK'sı ON DELETE RESTRICT idi. Oysa e2e fixture'ı her koşuda
-- kiracının control_test_definitions kayıtlarını siler ve test_runs'ın
-- CASCADE ile gitmesine güvenir (setup-e2e-fixtures.ts §4). Fotoğraf satırı
-- silinemeyince bu zincir kırılır: tanım silme İSTEĞİ patlar, fixture çöker.
--
-- DÜZELTME — test_runs ile AYNI disiplin (M12 deseni):
--   * UPDATE yasağı KALIYOR (service_role dahil): fotoğraf DEĞİŞTİRİLEMEZ.
--   * İstemci DELETE'i zaten imkânsız (revoke + delete politikası yok).
--   * Service bağlamının silmesi serbest — test verisi resetleri ve tanım/koşu
--     cascade'i, koşu kaydı (test_runs) neyse fotoğrafı da odur: birlikte
--     yaşar, birlikte silinir. Kalıcılık güvencesi üretim verisinde RLS +
--     revoke ile aynen sürer.

drop trigger if exists els_immutable_delete on public.execution_legal_snapshots;

-- test_run_id: restrict → cascade (koşu kaydı silinirse fotoğrafı da gider;
-- tanım silme cascade'i test_runs üzerinden artık ELS'e takılmaz).
alter table public.execution_legal_snapshots
  drop constraint execution_legal_snapshots_test_run_id_fkey;
alter table public.execution_legal_snapshots
  add constraint execution_legal_snapshots_test_run_id_fkey
  foreign key (test_run_id) references public.test_runs (id) on delete cascade;
