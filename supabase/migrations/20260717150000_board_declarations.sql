-- Yönetim Kurulu Beyanı (docs/ROADMAP.md M10, kurucu spesifikasyonu 17 Temmuz 2026).
--
-- Amaç teknik uzmanlık beyanı almak değildir: YK'nın kritik riskler hakkında
-- zamanında, yeterli ve güvenilir bilgiye dayanarak karar verip vermediğini
-- belgelemektir. TTK m.369/375/392 atıfları BİLGİLENDİRME AMAÇLIDIR,
-- doğrulanmış hukuki eşleme değildir (kural 3'ün ruhu: gerçek hukuki
-- değerlendirme hukuk/GRC uzmanınca yapılmalı, sistem yalnızca beyan ile
-- kanıtı ayrıştırır).

/**
 * Beyan soruları — ortak referans kütüphanesi (controls/scenario_templates
 * ile aynı desen). tenant_id YOK: soru listesi kiracıya özel değildir.
 */
create table public.board_declaration_questions (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  soru text not null,
  beklenen_kanit text not null,
  -- Bilgilendirme amaçlı, doğrulanmamış hukuki not (kural 3/12 ile aynı disiplin).
  mevzuat_notu text,
  sira integer not null unique,
  icerik_durumu text not null default 'UNVERIFIED_SAMPLE'
    check (icerik_durumu in ('UNVERIFIED_SAMPLE', 'DOGRULANMIS', 'YURURLUKTEN_KALKTI')),
  created_at timestamptz not null default now()
);

/** Bir beyan dönemi: kiracıya ait. */
create table public.board_declarations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  donem_etiketi text not null,
  donem_baslangic date,
  donem_bitis date,
  durum text not null default 'taslak' check (durum in ('taslak', 'sunuldu', 'arsiv')),
  sunan uuid references public.profiles (id) on delete set null,
  sunuldu_at timestamptz,
  created_at timestamptz not null default now()
);

create index board_declarations_tenant_idx on public.board_declarations (tenant_id, created_at desc);

/**
 * Soru bazlı cevap. SUNULDUKTAN SONRA IMMUTABLE (aşağıdaki trigger).
 *
 * NEDEN: bir YK beyanı formal bir karardır (TTK m.369 özen yükümlülüğü).
 * Sunulduktan sonra sessizce düzenlenebilseydi, "YK şu tarihte şunu beyan
 * etti" iddiası geçmişe dönük değişebilirdi — scenario_template_versions'daki
 * immutability gerekçesinin aynısı, burada hukuki ağırlığı daha yüksek.
 */
create table public.board_declaration_answers (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references public.board_declarations (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  question_id uuid not null references public.board_declaration_questions (id) on delete restrict,
  beyan text not null check (beyan in ('evet', 'hayir', 'kismen', 'uygulanamaz')),
  aciklama text,
  tarih date,
  sorumlu_yonetici uuid references public.profiles (id) on delete set null,
  yk_karar_referansi text,
  son_dogrulama_tarihi date,
  created_at timestamptz not null default now(),
  unique (declaration_id, question_id)
);

create index board_declaration_answers_declaration_idx on public.board_declaration_answers (declaration_id);

/** Bir cevabın dayandığı kanıt(lar) — çapraz denetimin girdisi. */
create table public.board_declaration_evidence_links (
  answer_id uuid not null references public.board_declaration_answers (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  primary key (answer_id, evidence_id)
);

/** Bir cevabın dayandığı simülasyon sonucu (örn. "son tatbikat RTO'yu karşıladı"). */
create table public.board_declaration_simulation_links (
  answer_id uuid not null references public.board_declaration_answers (id) on delete cascade,
  run_id uuid not null references public.simulation_runs (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  primary key (answer_id, run_id)
);

/**
 * Çapraz denetim kuralları — referans veri (CR-001..CR-008).
 *
 * degerlendirme_tipi: bu kodun bilfiil hangi TS değerlendiricisi tarafından
 * işlendiğini belirler (bkz. src/lib/board-declaration-audit.ts). Yeni bir
 * tip eklemek hem burada hem TS tarafında karşılık ister — biri eksik
 * kalırsa kural sessizce hiçbir şey yapmaz.
 *
 * DÜRÜST SINIR: CR-004/005/006 için gereken veri modelleri (tedarikçi
 * envanteri, IAM erişim incelemesi, güvenlik açığı SLA takibi) KALKAN-OS'ta
 * henüz yok. Bu kurallar yine de seed edilir (kurucunun tasarımı kaybolmasın)
 * ama `veri_kaynagi_durumu` bunu açıkça söyler ve değerlendirici bunlar için
 * sahte bir karşılaştırma üretmez, İNCELEME GEREKLİ döner.
 */
create table public.board_cross_audit_rules (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  question_id uuid references public.board_declaration_questions (id) on delete set null,
  aciklama text not null,
  tetikleyici text not null,
  degerlendirme_tipi text not null check (degerlendirme_tipi in (
    'KANIT_YOK_ISE_TUTARSIZ',
    'KANIT_SURESI_GECMISSE',
    'HEDEF_ASILDIYSA',
    'TEDARIKCI_ENVANTERINDE_YOK',
    'ERISIM_INCELEME_GECMIS',
    'SLA_ASILMIS',
    'RAPORLAMA_IZI_YOK',
    'SIMULASYON_KRITIK_ESIK_ALTI'
  )),
  parametreler jsonb not null default '{}',
  onerilen_bulgu text not null,
  risk_seviyesi text not null check (risk_seviyesi in ('dusuk', 'orta', 'orta_yuksek', 'yuksek', 'kritik')),
  -- Kural üç değerden biri: gerçek veri modeli var (calisir), yok (incelemeye
  -- düşer), veya kısmen var. Değerlendirici bu alana bakıp karar verir.
  veri_kaynagi_durumu text not null default 'MEVCUT'
    check (veri_kaynagi_durumu in ('MEVCUT', 'MODEL_YOK', 'KISMI')),
  icerik_durumu text not null default 'UNVERIFIED_SAMPLE'
    check (icerik_durumu in ('UNVERIFIED_SAMPLE', 'DOGRULANMIS', 'YURURLUKTEN_KALKTI')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Immutability: scenario_version_immutable ile aynı desen.
-- ---------------------------------------------------------------------

create or replace function public.board_declaration_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.durum = 'sunuldu' then
      raise exception 'Sunulmus YK beyani silinemez: yeni donem olusturun';
    end if;
    return old;
  end if;

  if old.durum = 'sunuldu' and new.durum is not distinct from old.durum then
    raise exception 'Sunulmus YK beyani degistirilemez: yeni donem olusturun';
  end if;

  if old.durum = 'sunuldu' and new.durum not in ('sunuldu', 'arsiv') then
    raise exception 'Sunulmus beyan yalnizca arsive alinabilir';
  end if;

  return new;
end;
$$;

create trigger board_declaration_immutable_guard
  before update or delete on public.board_declarations
  for each row execute function public.board_declaration_immutable();

/** Sunulmuş beyanın cevapları ve bağlı kanıt/simülasyon linkleri de donar. */
create or replace function public.board_declaration_child_immutable()
returns trigger
language plpgsql
as $$
declare
  v_declaration_id uuid;
  v_durum text;
begin
  if TG_TABLE_NAME = 'board_declaration_answers' then
    v_declaration_id := coalesce(new.declaration_id, old.declaration_id);
  else
    -- evidence_links / simulation_links: answer_id üzerinden declaration'a ulaş.
    select declaration_id into v_declaration_id from public.board_declaration_answers
    where id = coalesce(new.answer_id, old.answer_id);
  end if;

  select durum into v_durum from public.board_declarations where id = v_declaration_id;

  if v_durum = 'sunuldu' then
    raise exception 'Sunulmus beyanin icerigi degistirilemez (%): yeni donem olusturun', TG_TABLE_NAME;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger board_declaration_answers_immutable
  before insert or update or delete on public.board_declaration_answers
  for each row execute function public.board_declaration_child_immutable();

create trigger board_declaration_evidence_links_immutable
  before insert or update or delete on public.board_declaration_evidence_links
  for each row execute function public.board_declaration_child_immutable();

create trigger board_declaration_simulation_links_immutable
  before insert or update or delete on public.board_declaration_simulation_links
  for each row execute function public.board_declaration_child_immutable();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.board_declaration_questions enable row level security;
alter table public.board_declarations enable row level security;
alter table public.board_declaration_answers enable row level security;
alter table public.board_declaration_evidence_links enable row level security;
alter table public.board_declaration_simulation_links enable row level security;
alter table public.board_cross_audit_rules enable row level security;

-- Kütüphaneler herkese açık okunur (controls/scenario_templates deseni).
create policy board_declaration_questions_read on public.board_declaration_questions
  for select using (true);
create policy board_cross_audit_rules_read on public.board_cross_audit_rules
  for select using (true);

revoke insert, update, delete on public.board_declaration_questions from authenticated, anon;
revoke insert, update, delete on public.board_cross_audit_rules from authenticated, anon;

-- NOT: SELECT ve yazma komutları (insert/update/delete) İÇİN AYRI politikalar
-- kullanılır, "for all" + ayrı "for insert" KOMBİNASYONU KULLANILMAZ — Postgres
-- birden fazla permissive politikayı OR'lar, yani bir "for all" politikası
-- zaten var olduğunda ayrı bir "for insert" kısıtlaması hiçbir şeyi kısıtlamaz
-- (ikisinden biri geçerse yeterli olur). Rol kısıtlamasının fiilen işlemesi
-- için select dışındaki her komut kendi politikasında rolü de kontrol eder.
--
-- Denetçi misafir rolü (denetci_misafir) beyan OLUŞTURAMAZ/DEĞİŞTİREMEZ: bu
-- YK'nın kendi kararıdır, dış bir gözlemcinin girdisi değil.

create policy board_declarations_select on public.board_declarations
  for select using (tenant_id = public.current_tenant_id());
create policy board_declarations_insert on public.board_declarations
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
create policy board_declarations_update on public.board_declarations
  for update using (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
create policy board_declarations_delete on public.board_declarations
  for delete using (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );

create policy board_declaration_answers_select on public.board_declaration_answers
  for select using (tenant_id = public.current_tenant_id());
create policy board_declaration_answers_insert on public.board_declaration_answers
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
create policy board_declaration_answers_update on public.board_declaration_answers
  for update using (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
create policy board_declaration_answers_delete on public.board_declaration_answers
  for delete using (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );

create policy board_declaration_evidence_links_select on public.board_declaration_evidence_links
  for select using (tenant_id = public.current_tenant_id());
create policy board_declaration_evidence_links_insert on public.board_declaration_evidence_links
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
create policy board_declaration_evidence_links_delete on public.board_declaration_evidence_links
  for delete using (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );

create policy board_declaration_simulation_links_select on public.board_declaration_simulation_links
  for select using (tenant_id = public.current_tenant_id());
create policy board_declaration_simulation_links_insert on public.board_declaration_simulation_links
  for insert with check (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
create policy board_declaration_simulation_links_delete on public.board_declaration_simulation_links
  for delete using (
    tenant_id = public.current_tenant_id() and public.current_role() in ('admin', 'uyum')
  );
