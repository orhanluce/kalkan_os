-- 37 Tez Nihai Uygulama Talimatı — Dikey B ilk dilim (19 Temmuz 2026,
-- docs/adr/PR0-37-tez-dikeyB-roi-mapping-2026-07-19.md, docs/arastirma/
-- DORA_RoI_ITS_2024_2956_Kaynak_Ozeti.md): DORA Register of Information
-- (Commission Implementing Regulation (EU) 2024/2956) için VERİ MODELİ
-- HAZIRLIĞI. Export mekanizması, S01-S19 alan genişletmesi ve dört-göz
-- yayın onayı BU DİLİMDE YOK — kurucunun kendi talimatı gereği küçük,
-- test edilebilir bir ilk PR: (1) kurumun kendi yasal kimlik profili,
-- (2) RoI şablon/alan bazlı kaynak+doğrulama durumu kataloğu.
--
-- İÇERİK SEED'İ YOK (kural 3 + kurucunun açık şartı): bu migration hiçbir
-- RoI şablon/alan/kapalı-küme satırı INSERT ETMİYOR. Kaynak özetindeki
-- (LEGAL_REVIEW_REQUIRED işaretli) alanlar bile burada VERİ olarak
-- yazılmadı — DRAFT_RESEARCH'ten başlayarak bir sonraki dilimde (veya
-- ayrı bir küratörlük script'iyle) insan/hukuk sürecinden geçerek girilir.
--
-- DURUM SÖZLÜĞÜ YENİDEN KULLANILDI (mapping ADR §0): ikinci bir dört-göz
-- deseni İCAT EDİLMEDİ — `obligations.dogrulama_durumu` (20260718160000)
-- İLE BİREBİR AYNI altı durum + AYNI guard mantığı: DRAFT_RESEARCH →
-- TODO_DOGRULA → LEGAL_REVIEW → VERIFIED (+ SUPERSEDED/REJECTED). VERIFIED
-- doğrudan doğamaz; VERIFIED'e geçiş yalnız LEGAL_REVIEW'den + dogrulayan/
-- zaman atfıyla; VERIFIED içerik donuk.

-- =====================================================================
-- 1) Kurum yasal kimlik profili (tenant-scoped, tek satır/tenant)
-- =====================================================================
create table public.tenant_legal_identity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade unique,

  -- B_01.01.0010/B_01.02.0010 (LEGAL_REVIEW_REQUIRED — EUR-Lex'ten birebir
  -- doğrulandı: "LEI, 20-character, alpha-numeric code based on ISO 17442").
  -- Format kontrolü UYGULANIR (uluslararası standart, DORA yorumu değil);
  -- İÇERİK doğruluğu (gerçek GLEIF kaydı) bu dilimin kapsamı DIŞINDA.
  lei text check (lei is null or lei ~ '^[A-Z0-9]{20}$'),

  -- EUID: kaynak özetinin kendi dürüstlüğü (§5) — B_01.01/B_01.02'nin
  -- EUR-Lex'ten fetch edilen birebir metninde YALNIZ LEI isteniyor; EUID
  -- yalnız ikincil kaynakta (B_05.01.0020 sağlayıcı kimlik kodu bağlamında)
  -- geçti. Alan buraya EKLENDİ (kurucunun açık talebi) ama "kurum kimliği"
  -- bağlamındaki resmi zorunluluğu SOURCE_PENDING kalıyor — format kontrolü
  -- de UYGULANMIYOR (Directive (EU) 2017/1132 madde 16 formatı bu turda
  -- doğrulanmadı, uydurma regex açılmadı).
  euid text,

  -- B_01.01.0030/B_01.02.0030 (LEGAL_REVIEW_REQUIRED): ISO 3166-1 alpha-2.
  ulke_kodu text check (ulke_kodu is null or ulke_kodu ~ '^[A-Z]{2}$'),

  -- B_01.02.0100 (LEGAL_REVIEW_REQUIRED): ISO 4217 alfabetik kod.
  para_birimi text check (para_birimi is null or para_birimi ~ '^[A-Z]{3}$'),

  -- B_01.01.0040/B_01.02.0040 kapalı kümesi (22 madde, LEGAL_REVIEW_REQUIRED
  -- — kaynak özetinde tam liste var) BİLİNÇLİ OLARAK CHECK CONSTRAINT
  -- YAPILMADI: kurucunun şartı "resmi/hukuki doğrulama olmadan alan içeriği
  -- uydurulmayacak" — bir listeyi DB şemasına kilitlemek, henüz VERIFIED
  -- olmayan bir iddiayı BAĞLAYICI hale getirmek olurdu. Serbest metin;
  -- gelecekte roi_kaynak_kayitlari'ndaki VERIFIED satıra referans ile
  -- resmileştirilebilir (bu dilimde o bağ kurulmadı).
  kurulus_turu text,

  -- B_01.02.0050 "Hierarchy of the financial entity within the group":
  -- kapalı kümenin 5 seçeneği SOURCE_PENDING (kaynak özeti §5) — serbest
  -- metin, CHECK yok.
  hiyerarsi_seviyesi text,

  -- B_01.02.0060 (LEGAL_REVIEW_REQUIRED): doğrudan ana kuruluşun LEI'si.
  ana_kurulus_lei text check (ana_kurulus_lei is null or ana_kurulus_lei ~ '^[A-Z0-9]{20}$'),

  guncelleyen uuid references public.profiles (id) on delete set null,
  guncelleme_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenant_legal_identity_set_updated_at
  before update on public.tenant_legal_identity
  for each row execute function public.set_updated_at();

/**
 * KİMLİK ATFI: guncelleyen istemci bağlamında oturum sahibine sabitlenir
 * (service/cron muaf — M16 #9 deseninin aynısı). Uydurma "kim güncelledi"
 * iddiası önlenir.
 */
create or replace function public.tenant_legal_identity_atif_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.guncelleme_zamani := now();
  if auth.uid() is not null then
    new.guncelleyen := auth.uid();
  end if;
  return new;
end;
$$;

create trigger tenant_legal_identity_atif_guard_trg
  before insert or update on public.tenant_legal_identity
  for each row execute function public.tenant_legal_identity_atif_guard();

-- --- Audit: kurum kimlik profili değişimi (tenant-scoped, gate şartı) ---
create or replace function public.audit_tenant_legal_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'kurum_yasal_kimlik_olusturuldu', 'tenant_legal_identity', new.id, '{}'::jsonb);
    return new;
  end if;
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'kurum_yasal_kimlik_guncellendi', 'tenant_legal_identity', new.id,
    jsonb_build_object(
      'lei_degisti', new.lei is distinct from old.lei,
      'ulke_kodu_degisti', new.ulke_kodu is distinct from old.ulke_kodu,
      'kurulus_turu_degisti', new.kurulus_turu is distinct from old.kurulus_turu
    ));
  return new;
end;
$$;

create trigger audit_tenant_legal_identity_insert after insert on public.tenant_legal_identity
  for each row execute function public.audit_tenant_legal_identity();
create trigger audit_tenant_legal_identity_update after update on public.tenant_legal_identity
  for each row execute function public.audit_tenant_legal_identity();

-- =====================================================================
-- 2) RoI kaynak durum kataloğu (GLOBAL referans, obligations deseninin AYNISI)
-- =====================================================================
create table public.roi_kaynak_kayitlari (
  id uuid primary key default gen_random_uuid(),
  -- Çoklu regülasyon genişlemesine hazır sabit kimlik (bugün tek değer).
  regulasyon_kimligi text not null default 'CIR_2024_2956',
  sablon_kodu text not null,
  -- NULL = satır şablonun TAMAMINI tanımlıyor (alan değil).
  alan_kodu text,
  alan_adi text not null,
  veri_tipi text,
  zorunluluk_aciklamasi text not null,
  -- Kapalı küme değerleri (varsa) — VERIFIED olmadan bağlayıcı DEĞİLDİR,
  -- yalnız aday/taslak liste olarak taşınır.
  kapali_kume_degerleri jsonb,
  kaynak_url text not null,
  kaynak_alintisi text,

  dogrulama_durumu text not null default 'DRAFT_RESEARCH'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  eklenme_kaynagi text not null default 'ai_taslak'
    check (eklenme_kaynagi in ('manuel', 'connector', 'ai_taslak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (regulasyon_kimligi, sablon_kodu, alan_kodu)
);

create trigger roi_kaynak_kayitlari_set_updated_at
  before update on public.roi_kaynak_kayitlari
  for each row execute function public.set_updated_at();

create index roi_kaynak_kayitlari_sablon_idx on public.roi_kaynak_kayitlari (regulasyon_kimligi, sablon_kodu);

/**
 * DOĞRULAMA DURUMU GUARD'I — obligation_dogrulama_guard'ın (20260718160000)
 * BİREBİR AYNI mantığı, roi_kaynak_kayitlari'na uyarlandı (kural: var olan
 * mekanizmayı ikinci kez kurma — fonksiyon KOPYALANDI çünkü Postgres trigger
 * fonksiyonları farklı tablo şemalarına parametrik bağlanamaz, ama davranış
 * BİREBİR aynı tutuldu).
 */
create or replace function public.roi_kaynak_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.dogrulama_durumu = 'VERIFIED' then
      raise exception 'kayit VERIFIED dogamaz: dogrulama yalniz incelemeyle kazanilir (kural 3)';
    end if;
    return new;
  end if;

  if new.dogrulama_durumu = 'VERIFIED' and old.dogrulama_durumu is distinct from 'VERIFIED' then
    if old.dogrulama_durumu is distinct from 'LEGAL_REVIEW' then
      raise exception 'VERIFIED gecisi yalniz LEGAL_REVIEW uzerinden yapilabilir (kural 3)';
    end if;
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan ve dogrulama_zamani olmadan yapilamaz (kural 3)';
    end if;
  end if;

  if old.dogrulama_durumu = 'VERIFIED' and new.dogrulama_durumu = 'VERIFIED' then
    if new.sablon_kodu is distinct from old.sablon_kodu
      or new.alan_kodu is distinct from old.alan_kodu
      or new.alan_adi is distinct from old.alan_adi
      or new.zorunluluk_aciklamasi is distinct from old.zorunluluk_aciklamasi
      or new.kapali_kume_degerleri is distinct from old.kapali_kume_degerleri then
      raise exception 'VERIFIED RoI kaydinin icerigi degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger roi_kaynak_kayitlari_dogrulama_guard
  before insert or update on public.roi_kaynak_kayitlari
  for each row execute function public.roi_kaynak_dogrulama_guard();

-- =====================================================================
-- 3) RLS
-- =====================================================================
alter table public.tenant_legal_identity enable row level security;
alter table public.roi_kaynak_kayitlari enable row level security;

create policy tenant_legal_identity_select on public.tenant_legal_identity
  for select using (tenant_id = public.current_tenant_id());
create policy tenant_legal_identity_write on public.tenant_legal_identity
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

-- roi_kaynak_kayitlari: GLOBAL referans (obligations/provisions deseni) —
-- authenticated okur, yazma yalnız service_role/ingest yolu (istemci
-- global regülasyon kataloğuna yazamaz — ADR-T3 disiplini).
create policy roi_kaynak_kayitlari_select on public.roi_kaynak_kayitlari
  for select using (auth.role() = 'authenticated');
