-- Simülasyon senaryo şablonları (docs/ROADMAP.md M7, simülasyon belgesi §7).
--
-- Simülasyon ayrı bir oyun DEĞİLDİR: her beklenen aksiyon mevcut controls
-- tablosundaki bir kontrole bağlanır, sonuçlar kanıt ve bulgu önerisi üretir.
-- Bu migration yalnızca ŞABLONU kurar; yürütme (simulation_runs) M8'de.
--
-- ŞABLONLAR KİRACIYA AİT DEĞİLDİR: kontrol kütüphanesi gibi ortak referans
-- veridir (frameworks/controls ile aynı desen). Bu yüzden tenant_id yok ve
-- herkes okuyabilir; yazma yalnızca seed script'i (service_role) üzerinden.
-- Kural 1'in "her tabloda tenant_id" şartı müşteri VERİSİ içeren tablolar
-- içindir — senaryo içeriği müşteri verisi değil, kütüphanedir. Kiracıya ait
-- olan şey simülasyonun KENDİSİdir (M8: simulation_runs.tenant_id).

create table public.scenario_templates (
  id uuid primary key default gen_random_uuid(),
  -- Kararlı, insan-okur kimlik (S01..S05): seed idempotent olsun ve YAML ile
  -- DB arasındaki bağ UUID'ye değil bu koda dayansın.
  kod text not null unique,
  ad text not null,
  aciklama text,
  tehdit_kategorisi text not null,
  -- Kural 12 (senaryo içeriği de mevzuat içeriği gibidir): seed edilen her
  -- şablon doğrulanmamış örnektir ve öyle işaretlenir.
  icerik_durumu text not null default 'UNVERIFIED_SAMPLE'
    check (icerik_durumu in ('UNVERIFIED_SAMPLE', 'DOGRULANMIS', 'YURURLUKTEN_KALKTI')),
  created_at timestamptz not null default now()
);

/**
 * Şablon sürümü. YAYINLANMIŞ sürüm IMMUTABLE'dır (kural 10).
 *
 * NEDEN AYRI TABLO: bir tatbikat, oynandığı andaki şablona sabitlenmelidir.
 * Şablon tek tablo olsaydı, sonraki bir düzenleme geçmiş simülasyonun neye
 * göre puanlandığını geriye dönük değiştirirdi — denetime sunulan bir sonuç
 * için bu kabul edilemez.
 */
create table public.scenario_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.scenario_templates (id) on delete cascade,
  surum integer not null,
  durum text not null default 'taslak' check (durum in ('taslak', 'yayinlandi', 'arsiv')),
  -- Süre ve mod bilgisi sürümün parçası: aynı şablonun v1'i 2 saatlik,
  -- v2'si 1 saatlik olabilir ve geçmiş run v1'e göre okunmalı.
  tahmini_dakika integer not null check (tahmini_dakika > 0),
  hedef_roller text[] not null default '{}',
  on_kosullar text,
  yayinlandi_at timestamptz,
  created_at timestamptz not null default now(),
  unique (template_id, surum)
);

create index scenario_template_versions_template_idx
  on public.scenario_template_versions (template_id, surum desc);

/** Zamanlı gelişme (inject). t_dakika: senaryo zamanı, gerçek zaman değil. */
create table public.scenario_injects (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.scenario_template_versions (id) on delete cascade,
  sira integer not null,
  t_dakika integer not null check (t_dakika >= 0),
  baslik text not null,
  icerik text not null,
  -- Boş dizi = herkese açık. Doluysa yalnızca bu roller görür; katılımcının
  -- başka rolün gizli gelişmesini görmemesi M8'de RLS ile zorlanacak.
  gorunur_roller text[] not null default '{}',
  beklenen_davranis text,
  unique (version_id, sira)
);

create table public.scenario_decision_points (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.scenario_template_versions (id) on delete cascade,
  inject_id uuid references public.scenario_injects (id) on delete cascade,
  kod text not null,
  soru text not null,
  -- Karar türleri yalnızca çoktan seçmeli değildir (belge §8.3): seçim,
  -- serbest metin, görev, dosya yükleme ve onay.
  tip text not null check (tip in ('secim', 'serbest_metin', 'gorev', 'dosya', 'onay')),
  secenekler jsonb,
  sure_limiti_dakika integer check (sure_limiti_dakika > 0),
  unique (version_id, kod)
);

create table public.scenario_expected_actions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.scenario_template_versions (id) on delete cascade,
  kod text not null,
  aciklama text not null,
  hedef_dakika integer check (hedef_dakika >= 0),
  unique (version_id, kod)
);

/**
 * Beklenen aksiyon → kontrol. Simülasyonu ana ürüne bağlayan yer BURASIDIR:
 * bu bağ olmadan tatbikat, kontrol değerlendirmesine dokunmayan bir oyun
 * olurdu (belge §7 giriş).
 */
create table public.scenario_control_mappings (
  expected_action_id uuid not null references public.scenario_expected_actions (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete cascade,
  primary key (expected_action_id, control_id)
);

/**
 * Puanlama kuralı. Kural 11: deterministik ve açıklanabilir.
 *
 * `aciklama` zorunlu (not null): her puan satırı NEDEN verildiğini
 * göstermek zorunda — gerekçesiz bir puan, katılımcıya "sistem böyle dedi"
 * demekten ibaret olurdu.
 */
create table public.scenario_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.scenario_template_versions (id) on delete cascade,
  kod text not null,
  -- Kural türleri belgede sabit (§9.2).
  tip text not null check (tip in (
    'ACTION_COMPLETED',
    'ACTION_COMPLETED_WITHIN',
    'ROLE_NOTIFIED_WITHIN',
    'DECISION_SELECTED',
    'EVIDENCE_UPLOADED',
    'TASK_COMPLETED',
    'RTO_WITHIN_TARGET',
    'RPO_WITHIN_TARGET',
    'OBSERVER_RATING',
    'PENALTY_IF',
    'MANDATORY_FAIL_IF'
  )),
  -- Puanlama bileşeni (§9.1): ağırlıklar şablon sürümünde tutulur.
  bilesen text not null check (bilesen in (
    'zaman_hedefleri',
    'zorunlu_aksiyonlar',
    'rol_eskalasyon',
    'kanit_yeterliligi',
    'is_surekliligi',
    'gozlemci'
  )),
  agirlik numeric not null check (agirlik >= 0),
  parametreler jsonb not null default '{}',
  aciklama text not null,
  expected_action_id uuid references public.scenario_expected_actions (id) on delete cascade,
  unique (version_id, kod)
);

/**
 * Yayınlanmış sürümü ve ona bağlı içeriği dondurur (kural 10).
 *
 * Trigger'da, RLS'te değil: RLS yalnızca authenticated/anon'a uygulanır ve
 * seed/bakım işleri service_role ile koşar — yani kuralın RLS'te olması onu
 * tam da atlatılabileceği yolda bırakırdı (evidence_review_guard ile aynı
 * gerekçe).
 */
create or replace function public.scenario_version_immutable()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.durum = 'yayinlandi' then
      raise exception 'Yayinlanmis senaryo surumu silinemez: yeni surum olusturun';
    end if;
    return old;
  end if;

  -- Yayınlanmış sürümde yalnızca arşive alma serbest: içerik donar ama
  -- şablonun kullanımdan kaldırılabilmesi gerekir.
  if old.durum = 'yayinlandi' and new.durum is not distinct from old.durum then
    raise exception 'Yayinlanmis senaryo surumu degistirilemez: yeni surum olusturun';
  end if;

  if old.durum = 'yayinlandi' and new.durum not in ('yayinlandi', 'arsiv') then
    raise exception 'Yayinlanmis surum yalnizca arsive alinabilir';
  end if;

  return new;
end;
$$;

create trigger scenario_version_immutable_guard
  before update or delete on public.scenario_template_versions
  for each row execute function public.scenario_version_immutable();

/** Yayınlanmış sürümün ALT içeriği de donar — aksi halde immutability bir kelimeden ibaret kalırdı. */
create or replace function public.scenario_child_immutable()
returns trigger
language plpgsql
as $$
declare
  v_version_id uuid;
  v_durum text;
begin
  v_version_id := coalesce(new.version_id, old.version_id);

  select durum into v_durum
  from public.scenario_template_versions
  where id = v_version_id;

  if v_durum = 'yayinlandi' then
    raise exception 'Yayinlanmis senaryo surumunun icerigi degistirilemez (%): yeni surum olusturun', TG_TABLE_NAME;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger scenario_injects_immutable
  before insert or update or delete on public.scenario_injects
  for each row execute function public.scenario_child_immutable();

create trigger scenario_decision_points_immutable
  before insert or update or delete on public.scenario_decision_points
  for each row execute function public.scenario_child_immutable();

create trigger scenario_expected_actions_immutable
  before insert or update or delete on public.scenario_expected_actions
  for each row execute function public.scenario_child_immutable();

create trigger scenario_scoring_rules_immutable
  before insert or update or delete on public.scenario_scoring_rules
  for each row execute function public.scenario_child_immutable();

alter table public.scenario_templates enable row level security;
alter table public.scenario_template_versions enable row level security;
alter table public.scenario_injects enable row level security;
alter table public.scenario_decision_points enable row level security;
alter table public.scenario_expected_actions enable row level security;
alter table public.scenario_control_mappings enable row level security;
alter table public.scenario_scoring_rules enable row level security;

-- Kütüphane herkese açık okunur (frameworks/controls ile aynı desen).
-- DİKKAT: scenario_injects burada tüm kiracılara okunur — bu ŞABLON içeriği,
-- yani "senaryoda 20. dakikada şu olur" bilgisi. Katılımcının tatbikat
-- SIRASINDA başka rolün gelişmesini görmemesi ayrı bir sorundur ve M8'de
-- simulation_inject_deliveries üzerinden çözülür; şablonu okuyabilmek
-- tatbikatı bozmaz çünkü tatbikat yöneticisi zaten senaryoyu bilir.
create policy scenario_templates_read on public.scenario_templates
  for select using (true);
create policy scenario_template_versions_read on public.scenario_template_versions
  for select using (true);
create policy scenario_injects_read on public.scenario_injects
  for select using (true);
create policy scenario_decision_points_read on public.scenario_decision_points
  for select using (true);
create policy scenario_expected_actions_read on public.scenario_expected_actions
  for select using (true);
create policy scenario_control_mappings_read on public.scenario_control_mappings
  for select using (true);
create policy scenario_scoring_rules_read on public.scenario_scoring_rules
  for select using (true);

-- Yazma yolu yok: senaryo içeriği yalnızca seed script'iyle (service_role),
-- insan onayından geçmiş YAML'dan yazılır — controls tablosuyla aynı
-- disiplin (kural 3 ve 12).
revoke insert, update, delete on public.scenario_templates from authenticated, anon;
revoke insert, update, delete on public.scenario_template_versions from authenticated, anon;
revoke insert, update, delete on public.scenario_injects from authenticated, anon;
revoke insert, update, delete on public.scenario_decision_points from authenticated, anon;
revoke insert, update, delete on public.scenario_expected_actions from authenticated, anon;
revoke insert, update, delete on public.scenario_control_mappings from authenticated, anon;
revoke insert, update, delete on public.scenario_scoring_rules from authenticated, anon;
