-- M12 standart test/tatbikat manifesti (nihai talimat v3.3 §8.0 Dikey 2).
-- Mevcut M12 test altyapısını BÜYÜTÜR — yeni paralel test motoru KURMAZ.
--
-- test_runs zaten append-only/immutable (20260717230000): eklenen alanlar
-- INSERT anında YAZILIR ve bir daha değişmez (revoke update/delete korunur) —
-- yani "immutable snapshot" garantisi zaten var, yalnız snapshot'ın İÇERİĞİ
-- zenginleşiyor. Hepsi NULLABLE (geriye dönük uyum): bu migration öncesi eski
-- koşularda alanlar null'dır ve "kaydedilmedi" demektir — uydurulmaz.
--
-- SABİT KAPSAM (control_test_definitions'a): amaç/kapsam/hedef varlık/kritik
-- hizmet/senaryo kimliği+sürümü — tanım boyunca sabit, her koşuda tekrar
-- yazılmaz. KOŞU-ANI GÖZLEM (test_runs'a): başlangıç/bitiş/beklenen sonuç/
-- performans etkisi/FP-FN/log referansları+hash'leri/hazırlayan/sorumlu/
-- bağımsız onaylayan.
--
-- Manifest (kontrol-test-ledger.ts) bu alanları BİRLEŞTİRİP kanonik hash'ler
-- (V2); mühür zaten §1.42/§1.37 ile OTOMATİK (CONTROL_TEST_RUN outbox trigger).

-- --- Tanım: sabit test kapsamı ---
alter table public.control_test_definitions
  add column amac text,
  add column kapsam text,
  add column hedef_varlik text,
  add column kritik_hizmet_adi text,
  add column senaryo_kimligi text,
  add column senaryo_surumu integer check (senaryo_surumu is null or senaryo_surumu > 0);

-- --- Koşu: koşu-anı gözlem snapshot'ı ---
alter table public.test_runs
  add column baslangic_at timestamptz,
  add column bitis_at timestamptz,
  add column beklenen_sonuc text,
  add column performans_etkisi text,
  add column yanlis_pozitif boolean,
  add column yanlis_negatif boolean,
  -- Log/gözlem referansları + hash'leri: [{ad, hash}] — HAM log girmez (kural
  -- 22), yalnız referans + içerik-adresli hash.
  add column log_referanslari jsonb not null default '[]',
  add column hazirlayan uuid references public.profiles (id) on delete set null,
  add column sorumlu uuid references public.profiles (id) on delete set null,
  add column bagimsiz_onaylayan uuid references public.profiles (id) on delete set null;

/**
 * HAZIRLAYAN/ONAYLAYAN AYRIMI (kural 4): bir koşunun bağımsız onaylayanı,
 * onu hazırlayan/çalıştıran kişi OLAMAZ. İkisi de doluysa farklı olmalı.
 * BEFORE INSERT (test_runs append-only — UPDATE zaten yok).
 */
create or replace function public.test_run_bagimsiz_onay_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bagimsiz_onaylayan is not null and new.hazirlayan is not null
     and new.bagimsiz_onaylayan = new.hazirlayan then
    raise exception 'Bagimsiz onaylayan, kosuyu hazirlayan ile ayni kisi olamaz (kural 4)';
  end if;
  return new;
end;
$$;

create trigger test_run_bagimsiz_onay_guard_trg
  before insert on public.test_runs
  for each row execute function public.test_run_bagimsiz_onay_guard();
