-- Forward-fix: test_run_immutable() ile test_runs.retest_of_finding_id (Dikey
-- F, F1, 20260720320000) arasındaki gizli çatışma.
--
-- BULUNAN GERÇEK AÇIK (tam e2e suite koşusu sırasında): retest_of_finding_id
-- `references findings(id) on delete set null` taşıyor. Bir bulgu silindiğinde
-- (yalnız e2e fixture reset'i böyle bir şey yapıyor — üretimde findings hiç
-- silinmiyor) Postgres'in KENDİSİ bu FK'yi tatmin etmek için test_runs'a
-- `retest_of_finding_id = null` UPDATE'i uygulamaya çalışıyor. Ama
-- test_run_immutable() (20260717230001) HER UPDATE'i koşulsuz reddediyor —
-- service_role dahil, sistemin kendi FK-cascade UPDATE'i dahil. Sonuç: bu
-- alanı dolu bir test_runs satırına işaret eden HERHANGİ bir bulgu bir daha
-- ASLA silinemiyor (23503 hatası, "still referenced from table findings"
-- olarak yanlış yorumlanabiliyor — asıl neden budur).
--
-- NEDEN test_runs.retest_of_finding_id'yi "on delete restrict"e ÇEVİRMEK
-- YANLIŞ: bulguları silme yeteneği ÜRETİMDE zaten kullanılmıyor ama e2e
-- fixture temizliği (scripts/setup-e2e-fixtures.ts) buna bağımlı — restrict
-- fixture temizliğini kalıcı olarak kırardı.
--
-- ÇÖZÜM (kural 13/2 ruhunu bozmadan, dar bir istisna): UPDATE yalnız
-- retest_of_finding_id'yi dolu-dan null'a çekiyorsa VE satırın BAŞKA HİÇBİR
-- alanı değişmiyorsa izin ver — bu, gerçek bir "test sonucunu değiştirme"
-- değil, referans bütünlüğünün kendi kendini temizlemesidir. Her ŞEY diğer
-- alanlardan biri değişirse (sonuc, gerekce, gozlem, ... retest_of_finding_id
-- dahil BAŞKA bir değere) reddedilmeye devam eder.
create or replace function public.test_run_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.retest_of_finding_id is null
     and old.retest_of_finding_id is not null
     and old.id is not distinct from new.id
     and old.seq is not distinct from new.seq
     and old.tenant_id is not distinct from new.tenant_id
     and old.test_definition_id is not distinct from new.test_definition_id
     and old.control_id is not distinct from new.control_id
     and old.sonuc is not distinct from new.sonuc
     and old.gerekce is not distinct from new.gerekce
     and old.gozlem is not distinct from new.gozlem
     and old.tanim_surumu is not distinct from new.tanim_surumu
     and old.evidence_id is not distinct from new.evidence_id
     and old.calisti_at is not distinct from new.calisti_at
     and old.created_at is not distinct from new.created_at
     and old.baslangic_at is not distinct from new.baslangic_at
     and old.bitis_at is not distinct from new.bitis_at
     and old.beklenen_sonuc is not distinct from new.beklenen_sonuc
     and old.performans_etkisi is not distinct from new.performans_etkisi
     and old.yanlis_pozitif is not distinct from new.yanlis_pozitif
     and old.yanlis_negatif is not distinct from new.yanlis_negatif
     and old.log_referanslari is not distinct from new.log_referanslari
     and old.hazirlayan is not distinct from new.hazirlayan
     and old.sorumlu is not distinct from new.sorumlu
     and old.bagimsiz_onaylayan is not distinct from new.bagimsiz_onaylayan
  then
    -- Yalnız referans temizliği (FK on delete set null) — sonuç/gerekçe/
    -- gözlem/manifest alanlarının HİÇBİRİ değişmedi.
    return new;
  end if;

  raise exception 'Test sonucu degistirilemez (M12, append-only, kural 13)';
end;
$$;
