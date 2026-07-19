-- Nihai talimat v3.3 §8.0 Dikey 5, ilk yarı: M21/M42 dayanıklılık taksonomisi +
-- etki grafiği genişlemesi. Yeni graf DB YOK — M13'ün mevcut kritik-hizmet
-- grafını (critical_business_services/service_dependencies, 20260719040000)
-- yeni bir kenar türüyle GENİŞLETİYORUZ: kritik hizmet → kontrol.
--
-- TAKSONOMİ (tezden 8 üst alan — kurucunun nihai talimatı, THESIS_DERIVED):
-- yönetişim, öngörü/hazırlık/tanımlama, önleme/koruma, izleme/tespit,
-- müdahale, kurtarma, tehdit istihbaratı/paylaşım, üçüncü taraf yönetimi.
-- Tezin 29 alt kategorisi bu dilimde DOĞRUDAN BAĞLANMAZ (kapsam bilinçli dar).
-- Kural 3 + obligations deseni (20260718160000): bir kontrolün bu 8 alandan
-- hangisine hizmet ettiği iddiası TODO_DOGRULA DOĞAR; VERIFIED'a ancak insan
-- doğrulayıcı (dogrulayan + zaman, yalnız LEGAL_REVIEW'den) ile geçer — AI/
-- seed/service_role VERIFIED üretemez. VERIFIED seed YOK (kural 3).
--
-- ROLLBACK NOTU: eklemeli, bağımsız tablolar. Ters FK sırasıyla drop
-- (critical_service_controls, control_resilience_domains). Üretim verisi yok.
--
-- BİLİNÇLİ SONRAKİ DİLİM: 29 alt kategori, tez kaynak künyesi/sayfa referansı,
-- alan başına olgunluk skoru (nihai talimat "tek sahte skor YOK" der — bu
-- dilim skor ÜRETMİYOR, yalnız kapsam/faktör listesi; skorlama ayrı kurucu
-- kararı ister).

-- --- Kontrol → dayanıklılık alanı sınıflandırması (GLOBAL katalog, obligations deseni) ---
create table public.control_resilience_domains (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.controls (id) on delete restrict,
  kategori text not null check (kategori in (
    'YONETISIM', 'ONGORU_HAZIRLIK', 'ONLEME_KORUMA', 'IZLEME_TESPIT',
    'MUDAHALE', 'KURTARMA', 'TEHDIT_ISTIHBARATI', 'UCUNCU_TARAF'
  )),
  gerekce text,

  dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('DRAFT_RESEARCH', 'TODO_DOGRULA', 'LEGAL_REVIEW', 'VERIFIED', 'SUPERSEDED', 'REJECTED')),
  -- İnceleme atfı (dört-göz zincirinin ilk halkası — obligations deseni,
  -- 20260718210000): LEGAL_REVIEW'e geçişte kim sundu kayıtsız kalamaz.
  incelemeye_alan uuid references public.profiles (id) on delete restrict,
  incelemeye_alinma_zamani timestamptz,
  dogrulayan uuid references public.profiles (id) on delete restrict,
  dogrulama_zamani timestamptz,
  eklenme_kaynagi text not null default 'manuel'
    check (eklenme_kaynagi in ('manuel', 'connector', 'ai_taslak')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (control_id, kategori)
);

create trigger control_resilience_domains_set_updated_at
  before update on public.control_resilience_domains
  for each row execute function public.set_updated_at();

create index crd_control_idx on public.control_resilience_domains (control_id);
create index crd_kategori_idx on public.control_resilience_domains (kategori);

/**
 * DOĞRULAMA DURUMU GUARD'I (kural 3, obligations dört-göz deseninin aynısı —
 * 20260718210000; ayrı fonksiyon: alan adları farklı).
 *
 * INSERT: VERIFIED doğamaz. LEGAL_REVIEW'e geçiş inceleme atfı ister (dört-göz
 * ilk halka). VERIFIED'e geçiş yalnız LEGAL_REVIEW'den + dogrulayan/zaman
 * doluyken VE dogrulayan ≠ incelemeye_alan (inceleyen kendi sunumunu
 * doğrulayamaz). REJECTED yalnız LEGAL_REVIEW'den + karar atfıyla. VERIFIED
 * kayıtta kategori/control_id donuk (önce doğrulama geri alınır).
 */
create or replace function public.resilience_dogrulama_guard()
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
      raise exception 'Incelemeye alan kendi sunumunu dogrulayamaz (dort goz, M21 deseni)';
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
    if new.control_id is distinct from old.control_id or new.kategori is distinct from old.kategori then
      raise exception 'VERIFIED siniflandirma degistirilemez: once dogrulama geri alinmali';
    end if;
  end if;

  return new;
end;
$$;

create trigger control_resilience_domains_dogrulama_guard
  before insert or update on public.control_resilience_domains
  for each row execute function public.resilience_dogrulama_guard();

-- --- Etki grafiği kenarı: kritik hizmet → kontrol (M13 grafının GENİŞLEMESİ) ---
-- TENANT'A ÖZGÜ: hangi kontrolün hangi kritik hizmeti koruduğu kurumun kendi
-- operasyonel haritasıdır (service_dependencies deseniyle aynı katman).
create table public.critical_service_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  critical_service_id uuid not null references public.critical_business_services (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete restrict,
  gerekce text,
  created_at timestamptz not null default now(),
  unique (critical_service_id, control_id)
);

create index csc_service_idx on public.critical_service_controls (critical_service_id);
create index csc_control_idx on public.critical_service_controls (control_id);

-- --- RLS ---
alter table public.control_resilience_domains enable row level security;
alter table public.critical_service_controls enable row level security;

-- Global katalog: obligations deseni — authenticated okur, yazma policy YOK
-- (küratör/service_role ilerideki bir dilimde; bugün yazma yolu yok).
create policy control_resilience_domains_select on public.control_resilience_domains
  for select using (auth.role() = 'authenticated');

-- Tenant'a özgü kenar: service_dependencies deseni.
create policy critical_service_controls_select on public.critical_service_controls
  for select using (tenant_id = public.current_tenant_id());
create policy critical_service_controls_write on public.critical_service_controls
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
