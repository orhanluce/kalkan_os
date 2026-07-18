-- Kontrol paketleri + yükümlülük dayanak türü (docs/ROADMAP.md V2 PR-2b,
-- ADR-V2-2). İki ürün hattı (Regulated + CFO Kalkanı) aynı kontrol kataloğunu
-- paylaşır; PAKET, kontrollerin AUDIENCE'a göre sürümlü demetlenmesidir —
-- kontrol DUPLICATE EDİLMEZ (frameworks/controls global katalog deseni).
--
-- DAYANAK KONTROLÜN KENDİSİNE DEĞİL PAKET-BAĞINA yazılır (ADR-V2-2): aynı
-- kontrol bir pakette LEGAL_MANDATORY, başkasında BEST_PRACTICE olabilir.
--
-- KATALOG DESENI (frameworks/controls gibi): tenant'sız global referans;
-- authenticated okur, yazma yalnız seed/service (istemci politikası YOK).
-- İçerik uydurulmaz (kural 3) — paket metinleri data/packs/*.yaml'dan seed.

create table public.control_packs (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  ad text not null,
  aciklama text,
  audience text not null check (audience in ('REGULATED', 'CORPORATE_FINANCE', 'BOTH')),
  created_at timestamptz not null default now()
);

-- Sürümlü paket (kural 10 ruhu: yayınlanmış sürüm immutable, değişiklik yeni
-- sürüm doğurur). aktif yayın seçimi tek satır.
create table public.control_pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.control_packs (id) on delete cascade,
  surum integer not null check (surum > 0),
  yayin_durumu text not null default 'taslak'
    check (yayin_durumu in ('taslak', 'yayinlandi', 'arsivlendi')),
  yayinlandi_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pack_id, surum)
);

/**
 * PAKET-KONTROL BAĞI + DAYANAK. basis türü:
 *   LEGAL_MANDATORY  — doğrulanmış hüküm + applicability ister (M21'e dek
 *                      TODO_DOGRULA disipliniyle; kaynak_referansi zorunlu değil
 *                      ama hüküm bağı geldiğinde doldurulur).
 *   CONTRACTUAL      — sözleşme/talep kaynağı OLMADAN geçerli sayılamaz →
 *                      kaynak_referansi ZORUNLU (guard).
 *   BOARD_POLICY     — karar/politika sürümüne bağlanır → kaynak_referansi
 *                      ZORUNLU (guard).
 *   BEST_PRACTICE    — iyi uygulama; ARAYÜZDE MEVZUAT GİBİ GÖSTERİLEMEZ (UI
 *                      semantiği ayrı), referans opsiyonel.
 */
create table public.pack_controls (
  id uuid primary key default gen_random_uuid(),
  pack_version_id uuid not null references public.control_pack_versions (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete restrict,
  basis text not null check (basis in (
    'LEGAL_MANDATORY', 'CONTRACTUAL', 'BOARD_POLICY', 'BEST_PRACTICE'
  )),
  kaynak_referansi text,
  created_at timestamptz not null default now(),
  unique (pack_version_id, control_id)
);

create index pack_controls_version_idx on public.pack_controls (pack_version_id);

/**
 * DAYANAK GUARD'I (ADR-V2-2): CONTRACTUAL ve BOARD_POLICY, kaynak referansı
 * OLMADAN yazılamaz — sözleşme/karar kaynağı gösterilmeden bu dayanaklar
 * doğrulanmış sayılamaz. LEGAL_MANDATORY/BEST_PRACTICE referans zorunlu değil.
 */
create or replace function public.pack_control_basis_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.basis in ('CONTRACTUAL', 'BOARD_POLICY')
     and (new.kaynak_referansi is null or btrim(new.kaynak_referansi) = '') then
    raise exception '% dayanagi kaynak referansi (sozlesme/karar) olmadan yazilamaz', new.basis;
  end if;
  return new;
end;
$$;

create trigger pack_control_basis_guard_before_insert
  before insert on public.pack_controls
  for each row execute function public.pack_control_basis_guard();
create trigger pack_control_basis_guard_before_update
  before update on public.pack_controls
  for each row execute function public.pack_control_basis_guard();

-- RLS: katalog — authenticated okur, istemci yazamaz (seed/service).
alter table public.control_packs enable row level security;
alter table public.control_pack_versions enable row level security;
alter table public.pack_controls enable row level security;

create policy control_packs_select_authenticated on public.control_packs
  for select using (auth.role() = 'authenticated');
create policy control_pack_versions_select_authenticated on public.control_pack_versions
  for select using (auth.role() = 'authenticated');
create policy pack_controls_select_authenticated on public.pack_controls
  for select using (auth.role() = 'authenticated');
