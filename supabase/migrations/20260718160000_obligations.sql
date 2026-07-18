-- Yükümlülükler + yükümlülük→kontrol eşlemeleri (V2 PR-4b adım 2, M21).
-- Zincir: source_artifact → provision → OBLIGATION → CONTROL MAPPING → kontrol.
--
-- ORTAK REFERANS VERİSİ, TENANT'SIZ (ADR-T3): bir hükümden türeyen yükümlülük
-- ve onun katalog kontrolüne eşlemesi her kiracı için AYNIDIR — provisions /
-- regulatory_sources gibi global kataloğdur, tenant_id TAŞIMAZ. Tenant'a özgü
-- KARAR (bu yükümlülük bu kuruma uygulanır mı) PR-4b adım 3'te ayrı tenant
-- tablosunda (applicability_decisions).
--
-- KURAL 3 + DEVAM §2: yükümlülük metni/eşlemesi uydurulamaz-doğrulanmış
-- sayılamaz. Altı durum: DRAFT_RESEARCH (AI/araştırma taslağı), TODO_DOGRULA
-- (aday, doğrulama bekliyor), LEGAL_REVIEW (hukuk incelemesinde), VERIFIED
-- (hukuk yetkisiyle doğrulandı), SUPERSEDED (yeni sürüm geldi), REJECTED
-- (incelemede reddedildi). DB guard'ları (aşağıda):
--   * hiçbir kayıt VERIFIED DOĞAMAZ (AI/parser/seed VERIFIED yapamaz);
--   * VERIFIED'e geçiş yalnız LEGAL_REVIEW'den + dogrulayan atfı zorunlu;
--   * VERIFIED kaydın içerik alanları donuk — değişiklik için önce doğrulama
--     geri alınır (durum VERIFIED'den çıkar), sessiz içerik kayması olamaz.
-- "Ayrı hukuk yetkisi" rol kontrolü route seviyesinde (bugün admin; hukuk/
-- küratör rolü K8 AÇIK KARAR — uydurulmadı).

create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  -- Yükümlülüğün türediği hüküm. on delete restrict: soy zinciri korunur.
  provision_id uuid not null references public.provisions (id) on delete restrict,
  -- Değişmez, insan-okur iç kod (SPK notu §2.2 obligation_id), ör. "YUK-VII12810-26-1".
  kod text not null,
  baslik text not null,
  -- Beklenen sonuç (control_objective). Hüküm METNİ buraya kopyalanmaz —
  -- metin provisions'ta; burada özgün yükümlülük ifadesi durur.
  amac text not null,
  -- Zorunluluk mu iyi uygulama mı (SPK notu §2.2 mandatory_or_guidance).
  nitelik text not null default 'zorunlu' check (nitelik in ('zorunlu', 'rehber')),
  -- Sıklık/son tarih kuralı: yapılandırılmış sözlük değil serbest metin —
  -- makine-işlenebilir deadline motoru bu dilimin kapsamı dışında (uydurma
  -- şema açmıyoruz; ihtiyaç netleşince ayrı taş).
  siklik text,
  son_tarih_kurali text,
  kanit_gereksinimi text,

  dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  -- VERIFIED atfı: kim, ne zaman. Guard VERIFIED geçişinde dolu olmasını zorlar.
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  eklenme_kaynagi text not null default 'manuel'
    check (eklenme_kaynagi in ('manuel', 'connector', 'ai_taslak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provision_id, kod)
);

create trigger obligations_set_updated_at
  before update on public.obligations
  for each row execute function public.set_updated_at();

create index obligations_provision_idx on public.obligations (provision_id);

-- Yükümlülük → katalog kontrolü eşlemesi. Eşlemenin KENDİSİ de doğrulanır
-- (aynı altı durum): hukuk onayı olmayan eşleme, adım 4'teki legal-basis
-- guard'da zorunlu kontrol koşusuna dayanak OLAMAZ.
create table public.obligation_control_mappings (
  id uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.obligations (id) on delete restrict,
  control_id uuid not null references public.controls (id) on delete restrict,
  -- Eşleme iddiasının kapsam notu: kontrol yükümlülüğü TAM mı KISMEN mi
  -- karşılıyor. Kısmi eşleme "karşılanıyor" yanılsaması üretmesin diye ayrı.
  kapsam text not null default 'tam' check (kapsam in ('tam', 'kismi')),
  gerekce text,

  dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  eklenme_kaynagi text not null default 'manuel'
    check (eklenme_kaynagi in ('manuel', 'connector', 'ai_taslak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (obligation_id, control_id)
);

create trigger obligation_control_mappings_set_updated_at
  before update on public.obligation_control_mappings
  for each row execute function public.set_updated_at();

create index ocm_obligation_idx on public.obligation_control_mappings (obligation_id);
create index ocm_control_idx on public.obligation_control_mappings (control_id);

/**
 * DOĞRULAMA DURUMU GUARD'I (kural 3) — obligations ve mappings ortak.
 *
 * INSERT: VERIFIED doğamaz. Hangi kaynaktan gelirse gelsin (manuel/connector/
 * ai_taslak) kayıt en fazla LEGAL_REVIEW ile doğabilir; VERIFIED yalnız
 * incelemeden geçerek kazanılır.
 *
 * UPDATE:
 *   * VERIFIED'e geçiş yalnız LEGAL_REVIEW'den ve dogrulayan + dogrulama_zamani
 *     doluyken — DB'nin zorlayabildiği asgari iz (SoD mevzuat guard deseni).
 *     Rol kontrolü ("ayrı hukuk yetkisi") route'ta; bugün admin, K8 açık.
 *   * VERIFIED kayıtta içerik değişikliği (obligations: kod/baslik/amac/nitelik/
 *     provision_id; mappings: obligation_id/control_id/kapsam) REDDEDİLİR —
 *     doğrulanmış iddia sessizce başka bir iddiaya dönüşemez. Önce durum
 *     VERIFIED'den çıkarılır (ör. TODO_DOGRULA/SUPERSEDED), sonra düzenlenir.
 */
create or replace function public.obligation_dogrulama_guard()
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
    if TG_TABLE_NAME = 'obligations' then
      if new.kod is distinct from old.kod
        or new.baslik is distinct from old.baslik
        or new.amac is distinct from old.amac
        or new.nitelik is distinct from old.nitelik
        or new.provision_id is distinct from old.provision_id then
        raise exception 'VERIFIED yukumlulugun icerigi degistirilemez: once dogrulama geri alinmali';
      end if;
    else
      if new.obligation_id is distinct from old.obligation_id
        or new.control_id is distinct from old.control_id
        or new.kapsam is distinct from old.kapsam then
        raise exception 'VERIFIED eslemenin icerigi degistirilemez: once dogrulama geri alinmali';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger obligations_dogrulama_guard
  before insert or update on public.obligations
  for each row execute function public.obligation_dogrulama_guard();

create trigger ocm_dogrulama_guard
  before insert or update on public.obligation_control_mappings
  for each row execute function public.obligation_dogrulama_guard();

-- --- RLS: global referans — authenticated okur, yazma seed/service ---
-- (provisions/regulatory_sources deseni: istemci global hukuk verisi yazamaz.)
alter table public.obligations enable row level security;
alter table public.obligation_control_mappings enable row level security;

create policy obligations_select on public.obligations
  for select using (auth.role() = 'authenticated');
create policy ocm_select on public.obligation_control_mappings
  for select using (auth.role() = 'authenticated');
-- Yazma politikası YOK: ingest/knowledge-graph rotaları service_role ile yazar.
