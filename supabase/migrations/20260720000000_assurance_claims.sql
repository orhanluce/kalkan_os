-- 37 Tez Nihai Uygulama Talimatı — Dikey C (20 Temmuz 2026, docs/adr/PR0-37-
-- tez-dikeyC-claim-guard-2026-07-20.md): Model/Compliance Claim Guard.
--
-- AMAÇ: KALKAN_OS'un AI/kural motoru tarafından üretilen hiçbir uyum, risk,
-- kontrol veya mevzuat iddiası; doğrulanmış kaynak, kapsam, tarih, güven
-- seviyesi ve kanıt bağlantısı olmadan KESİN HÜKÜM olarak gösterilmemeli.
--
-- YENİ MEKANİZMA İCAT EDİLMEDİ (ADR §0): dört-göz durum makinesi `obligations`
-- + `20260718210000_dogrulama_dort_goz.sql`'in GERÇEK dört-göz sürümünün
-- BİREBİR AYNISI (incelemeye_alan ≠ dogrulayan ayrımı DAHİL — bkz. not
-- aşağıda); saf değerlendirme motoru mimarisi `legal-basis.ts` (M23)
-- deseninin AYNISI; kaynak-anı fotoğrafı `execution_legal_snapshots`
-- deseninin (tek kolona küçültülmüş) AYNISI.
--
-- DÜZELTME NOTU (canlı geliştirme sırasında, bu migration HENÜZ pushlanmadan
-- yakalandı): ilk taslak yalnız `obligations`'ın 20260718160000'deki ESKİ
-- (iki-aşamalı, incelemeye_alan'sız) guard'ını kopyalamıştı.
-- 20260718210000 bunu M21'in gerçek "tek kişi mapping hazırlayıp
-- onaylayamaz" şartına yükseltmişti — bu migration DOĞRUDAN o SÜRÜMÜ
-- kopyalıyor. `roi_kaynak_kayitlari` (20260719310000, DÜN ŞİPLENDİ) da AYNI
-- eski deseni kopyalamıştı — forward-fix `20260720000001`'de (bu dilimin
-- parçası) ayrıca düzeltiliyor.
--
-- İÇERİK SEED'İ YOK: bu migration hiçbir claim/obligation verisi INSERT
-- ETMİYOR — yalnız mekanizmayı açıyor.

-- =====================================================================
-- 1) assurance_claims (tenant-scoped)
-- =====================================================================
create table public.assurance_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  iddia_turu text not null check (iddia_turu in ('UYUM', 'RISK', 'KONTROL', 'MEVZUAT')),

  -- Polimorfik hedef: iddia NE hakkında (controls/third_parties/findings/...).
  -- FK YOK (hedef tablo çeşitliliği) — kural: hedef_id varsa hedef_tablo da dolu olmalı.
  hedef_tablo text,
  hedef_id uuid,
  constraint assurance_claims_hedef_tutarli check ((hedef_tablo is null) = (hedef_id is null)),

  iddia_metni text not null,
  -- Sonuç yönü: AÇIK/KAPALI küme, serbest metinden ÇIKARILMAZ (kural 11 —
  -- "iddia_metni"nin anlamını NLP/AI ile yorumlamak sahte kesinlik üretirdi).
  -- İddiayı yazan bunu AÇIKÇA seçer; kural 8'in çatışma tespiti bu alanı
  -- karşılaştırır (bkz. src/lib/claim-guard.ts catismaTespitEt).
  sonuc text not null check (sonuc in ('OLUMLU', 'OLUMSUZ', 'KOSULLU')),
  -- Kapsam (talimat kural 6: "açıkça koşullu gösterilmeli") — iddianın sınırı.
  kapsam text,
  -- Yargı alanı (jurisdiction) — serbest metin, regulatory_sources.jurisdiction
  -- ile eşitlik DB'de zorlanmıyor (ADR §5 açık karar).
  yargi_alani text,
  yururluk_tarihi date,

  -- Güven seviyesi: SAYISAL DEĞİL (talimat kapsam dışı: "yapay kesinlik puanı
  -- üretmek"). Kapalı küme + zorunlu gerekçe (kural 11 "gerekçesiz puan yok").
  guven_seviyesi text not null default 'ORTA' check (guven_seviyesi in ('DUSUK', 'ORTA', 'YUKSEK')),
  guven_gerekcesi text not null,

  -- Kaynak: obligations'a FK + değerlendirme ANINDAKİ durumun donmuş fotoğrafı
  -- (execution_legal_snapshots deseni). Kaynaksız iddia caiz (RISK/KONTROL
  -- claim'leri her zaman resmi hükme dayanmaz) ama VERIFIED'e ASLA giremez
  -- (guard, aşağıda).
  kaynak_obligation_id uuid references public.obligations (id) on delete set null,
  kaynak_durumu_anlik text
    check (kaynak_durumu_anlik is null or kaynak_durumu_anlik in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),

  -- Kanıt referansları: HAM İÇERİK DEĞİL, yalnız işaretçi (kural 22).
  kanit_referanslari jsonb not null default '[]'::jsonb,

  -- Dört-göz (20260718210000 vokabüleri, birebir — incelemeye_alan ≠
  -- dogrulayan: inceleme sunan kişi kendi sunumunu doğrulayamaz, M21).
  dogrulama_durumu text not null default 'DRAFT_RESEARCH'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  incelemeye_alan uuid references public.profiles (id) on delete restrict,
  incelemeye_alinma_zamani timestamptz,
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,

  -- Üretim kaynağı (kural 11 AI karar sınırı): AI/kural motoru iddia
  -- ÖNEREBİLİR ama kendi önerisini VERIFIED YAPAMAZ (guard, aşağıda).
  olusturan_tur text not null default 'insan' check (olusturan_tur in ('insan', 'ai_taslak', 'kural_motoru')),
  olusturan uuid references public.profiles (id) on delete set null,

  -- Süre-dolumu kuyruğu (kural 9) — cron doldurur, insan temizler.
  yeniden_inceleme_gerekli boolean not null default false,
  yeniden_inceleme_nedeni text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger assurance_claims_set_updated_at
  before update on public.assurance_claims
  for each row execute function public.set_updated_at();

create index assurance_claims_tenant_idx on public.assurance_claims (tenant_id, created_at desc);
create index assurance_claims_hedef_idx on public.assurance_claims (tenant_id, hedef_tablo, hedef_id) where hedef_tablo is not null;
create index assurance_claims_inceleme_idx on public.assurance_claims (tenant_id, yeniden_inceleme_gerekli) where yeniden_inceleme_gerekli;

/**
 * KAYNAK FOTOĞRAFI: kaynak_obligation_id set edilir/değişirse, o obligation'ın
 * O ANKİ dogrulama_durumu'nu kaynak_durumu_anlik'e KOPYALAR (execution_legal_
 * snapshots deseni — "neye dayandığımız" donmuş kalır, obligation SONRADAN
 * VERIFIED/SUPERSEDED olsa bile bu satırın o anki dayanağı değişmez; süre-
 * dolumu cron'u bunu ayrıca izler).
 */
create or replace function public.assurance_claim_kaynak_fotografi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
begin
  if new.kaynak_obligation_id is null then
    new.kaynak_durumu_anlik := null;
    return new;
  end if;
  if TG_OP = 'INSERT' or new.kaynak_obligation_id is distinct from old.kaynak_obligation_id then
    select dogrulama_durumu into v_durum from public.obligations where id = new.kaynak_obligation_id;
    new.kaynak_durumu_anlik := v_durum;
  end if;
  return new;
end;
$$;

create trigger assurance_claim_kaynak_fotografi_trg
  before insert or update on public.assurance_claims
  for each row execute function public.assurance_claim_kaynak_fotografi();

/**
 * KİMLİK ATFI: olusturan istemci bağlamında oturum sahibine sabit (service/
 * cron muaf — M16 #9 deseni). AI/kural motoru üretimi (olusturan_tur AI ise)
 * olusturan'ı DOLDURMAZ (auth.uid() zaten insan oturumu olmadan null olur).
 */
create or replace function public.assurance_claim_olusturan_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and auth.uid() is not null then
    new.olusturan := auth.uid();
  end if;
  return new;
end;
$$;

create trigger assurance_claim_olusturan_guard_trg
  before insert on public.assurance_claims
  for each row execute function public.assurance_claim_olusturan_guard();

/**
 * DOĞRULAMA DURUMU GUARD'I — `20260718210000_dogrulama_dort_goz.sql`'in
 * GERÇEK dört-göz mantığının BİREBİR AYNISI (incelemeye_alan ≠ dogrulayan
 * DAHİL) + Dikey C'ye özgü İKİ EK KURAL:
 *
 *  (M21 dört-göz) LEGAL_REVIEW'e geçiş incelemeye_alan+zaman ister; VERIFIED'de
 *    dogrulayan ≠ incelemeye_alan (inceleyen kendi sunumunu doğrulayamaz);
 *    REJECTED yalnız LEGAL_REVIEW'den + karar atfıyla.
 *  (kural 3/4) VERIFIED'e geçiş yalnız kaynak_obligation_id DOLU VE o
 *    obligation'ın O ANKİ dogrulama_durumu = 'VERIFIED' İSE mümkündür.
 *    Kaynaksız veya kaynağı doğrulanmamış iddia asla VERIFIED olamaz.
 *  (kural 6) VERIFIED'e geçiş kanit_referanslari BOŞ OLMAYAN bir dizi
 *    gerektirir — kanıtsız "uyumlu/zorunlu/ihlal yok" iddiası engellenir.
 */
create or replace function public.assurance_claim_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kaynak_durumu text;
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'iddia VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'LEGAL_REVIEW' and old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
    if new.incelemeye_alan is null or new.incelemeye_alinma_zamani is null then
      raise exception 'LEGAL_REVIEW gecisi incelemeye_alan ve zaman olmadan yapilamaz (dort goz)';
    end if;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
    if new.dogrulayan = new.incelemeye_alan then
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21)';
    end if;

    if new.kaynak_obligation_id is null then
      raise exception 'kaynaksiz iddia VERIFIED olamaz (kural 4: resmi kaynak yoksa yalniz UNVERIFIED/LEGAL_REVIEW)';
    end if;
    select dogrulama_durumu into v_kaynak_durumu from public.obligations where id = new.kaynak_obligation_id;
    if v_kaynak_durumu is distinct from 'VERIFIED' then
      raise exception 'kaynak yukumluluk VERIFIED degilken (%) iddia VERIFIED olamaz (kural 3)', v_kaynak_durumu;
    end if;

    if jsonb_array_length(new.kanit_referanslari) = 0 then
      raise exception 'kanitsiz iddia VERIFIED olamaz (kural 6)';
    end if;
  end if;

  if new.dogrulama_durumu = 'REJECTED' and old.dogrulama_durumu is distinct from 'REJECTED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'REJECTED karari yalniz LEGAL_REVIEW uzerinden verilebilir';
    end if;
    if new.dogrulayan is null then
      raise exception 'REJECTED karari karar sahibi (dogrulayan) olmadan yazilamaz';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.iddia_turu is distinct from old.iddia_turu
      or new.iddia_metni is distinct from old.iddia_metni
      or new.sonuc is distinct from old.sonuc
      or new.kapsam is distinct from old.kapsam
      or new.kaynak_obligation_id is distinct from old.kaynak_obligation_id
      or new.kanit_referanslari is distinct from old.kanit_referanslari then
      raise exception 'VERIFIED iddianin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger assurance_claims_dogrulama_guard
  before insert or update on public.assurance_claims
  for each row execute function public.assurance_claim_dogrulama_guard();

-- --- Audit: durum değişimi (tenant-scoped, gate şartı) ---
create or replace function public.audit_assurance_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'iddia_olusturuldu', 'assurance_claims', new.id,
      jsonb_build_object('iddia_turu', new.iddia_turu, 'olusturan_tur', new.olusturan_tur));
    return new;
  end if;
  if new.dogrulama_durumu is distinct from old.dogrulama_durumu then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'iddia_durum_degisti', 'assurance_claims', new.id,
      jsonb_build_object('durum_onceki', old.dogrulama_durumu, 'durum', new.dogrulama_durumu));
  end if;
  return new;
end;
$$;

create trigger audit_assurance_claim_insert after insert on public.assurance_claims
  for each row execute function public.audit_assurance_claim();
create trigger audit_assurance_claim_update after update on public.assurance_claims
  for each row execute function public.audit_assurance_claim();

-- =====================================================================
-- 2) Süre-dolumu / kaynak-değişimi yeniden inceleme kuyruğu (kural 9)
-- =====================================================================
create or replace function public.assurance_claims_yeniden_inceleme_isle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim record;
begin
  for v_claim in
    select c.id, c.tenant_id
    from public.assurance_claims c
    left join public.obligations o on o.id = c.kaynak_obligation_id
    where c.yeniden_inceleme_gerekli = false
      and c.dogrulama_durumu not in ('SUPERSEDED', 'REJECTED')
      and (
        (c.yururluk_tarihi is not null and c.yururluk_tarihi < current_date)
        or (c.kaynak_obligation_id is not null and o.dogrulama_durumu in ('SUPERSEDED', 'REJECTED') and c.kaynak_durumu_anlik is distinct from o.dogrulama_durumu)
      )
    for update of c skip locked
  loop
    begin
      update public.assurance_claims
        set yeniden_inceleme_gerekli = true,
            yeniden_inceleme_nedeni = 'Otomatik: yururluk tarihi gecti veya kaynak yukumluluk durumu degisti'
        where id = v_claim.id;
      insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
      values (v_claim.tenant_id, null, 'iddia_yeniden_inceleme_kuyruguna_alindi', 'assurance_claims', v_claim.id, '{}'::jsonb);
    exception when others then
      raise notice 'assurance_claims_yeniden_inceleme_isle: % icin hata: %', v_claim.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.assurance_claims_yeniden_inceleme_isle() from authenticated, anon;

do $$
begin
  perform cron.schedule('kalkan-iddia-yeniden-inceleme', '0 4 * * *', 'select public.assurance_claims_yeniden_inceleme_isle();');
exception when others then
  raise notice 'pg_cron schedule atlandi (PGlite/local ortam): %', sqlerrm;
end;
$$;

-- =====================================================================
-- 3) RLS
-- =====================================================================
alter table public.assurance_claims enable row level security;

create policy assurance_claims_select on public.assurance_claims
  for select using (tenant_id = public.current_tenant_id());
create policy assurance_claims_write on public.assurance_claims
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
