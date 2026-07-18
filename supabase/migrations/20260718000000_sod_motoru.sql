-- Görevler Ayrılığı (SoD) motoru (docs/ROADMAP.md M16, SPK notları §5).
--
-- NE İŞE YARAR: kritik bir işlemin talep/icra/onay/doğrulama aşamalarının
-- uygunsuz biçimde aynı kişide/rolde birleşmesini tespit eder. Tam ayrım
-- mümkün değilse (küçük aracı kurumda sık rastlanır) süreli, TEST EDİLEBİLİR
-- bir telafi edici kontrol uygular — "uygunsuz" deyip bırakmaz.
--
-- BU BİR IAM/PAM SİSTEMİ DEĞİLDİR: kullanıcı yetkilerini yönetmez, KALKAN_OS
-- içindeki roller/atamalar üzerinde GÜVENCE DEĞERLENDİRMESİ yapar. Harici
-- IAM/PAM connector'ları bilinçli olarak bu turun kapsamı DIŞINDA (ROADMAP
-- M16 "kapsam dışı").
--
-- KURAL 3'ÜN GENİŞLEMESİ: SPK/SPL çalışma notlarından türetilen hiçbir kural
-- doğrudan VERIFIED doğmaz. `mevzuat_durumu` üç durumlu: INTERNAL (kural
-- KALKAN_OS'un kendi tasarım kararı, SPK kaynaklı değil — doğrulama beklemez),
-- TODO_DOGRULA (SPK notundan türetildi, hukuk/uyum onayı bekliyor), VERIFIED
-- (doğrulandı). Bu geçiş genel edit yetkisiyle yapılamaz (aşağıdaki guard).

create table public.sod_kurallari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kod text not null,
  ad text not null,
  aciklama text,
  -- Bu kural neyi kapsıyor: bugün yalnız 'kontrol_testi' (M12 ile ilişkili
  -- aktivite/rol kodları). İleride 'finansal_islem' vb. eklenebilir.
  kapsam_turu text not null default 'genel',
  onem text not null default 'yuksek'
    check (onem in ('acil', 'kritik', 'yuksek', 'orta', 'dusuk')),
  durum text not null default 'aktif' check (durum in ('aktif', 'pasif')),
  gecerlilik_baslangic date,
  gecerlilik_bitis date,
  -- Kuralın KÖKENİ: 'internal' (KALKAN_OS'un kendi tasarımı) | 'spk_notu'
  -- (SPL 1020/1023 çalışma notlarından). Serbest metin referans (ör. "SPL
  -- 1020 §5, madde X") kaynak_referansi'nda — kural 3: kaynak metin
  -- KOPYALANMAZ, yalnızca özgün kural ifadesi + referans tutulur.
  kaynak_turu text not null default 'internal' check (kaynak_turu in ('internal', 'spk_notu')),
  kaynak_referansi text,
  mevzuat_durumu text not null default 'INTERNAL'
    check (mevzuat_durumu in ('INTERNAL', 'TODO_DOGRULA', 'VERIFIED')),
  olusturan uuid references public.profiles (id) on delete set null,
  onaylayan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, kod)
);

create trigger sod_kurallari_set_updated_at
  before update on public.sod_kurallari
  for each row execute function public.set_updated_at();

/**
 * Kuralın A/B tarafı: iki aktivite/rol kombinasyonu birlikte bulunursa
 * çatışma. İLK SÜRÜM SERBEST KOD ÇALIŞTIRMAZ (kurucu talimatı) — eşleşme
 * yalnızca alan eşitliğiyle kurulur (aktivite_kodu/rol_kodu/sistem_kapsami),
 * motor bunları kanonik olarak karşılaştırır (src/lib/sod.ts).
 */
create table public.sod_kural_taraflari (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.sod_kurallari (id) on delete cascade,
  taraf text not null check (taraf in ('A', 'B')),
  aktivite_kodu text not null,
  rol_kodu text,
  -- NULL = bu tarafta sistem kapsamı belirtilmemiş: "hangi sistemde olursa
  -- olsun geçerli" (çoğu SPK-tarzı kural böyledir). Dolu ise yalnız o
  -- kapsamdaki atamalar bu tarafa aday olur. Asıl çatışma kararı HER ZAMAN
  -- atamaların GERÇEK ORTAK kapsamına göre verilir (src/lib/sod.ts) — bu
  -- alan bir FİLTREDİR, çatışmanın kapsamını sabitlemez.
  sistem_kapsami text,
  unique (rule_id, taraf)
);

/**
 * Kişi-rol-sistem ataması. PII MİNİMİZE: profiles.id zaten var olan bir
 * kullanıcı kaydı, burada TEKRARLANMAZ — yalnızca hangi aktivite/rolü
 * üstlendiği kaydedilir. harici_kullanici_id NULLABLE ve bugün kullanılmıyor;
 * ileride bir IAM/PAM connector bağlanınca profiles.id'siz (KALKAN_OS
 * hesabı olmayan) dış kullanıcılar için açılır.
 */
create table public.sod_atamalari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kullanici_id uuid references public.profiles (id) on delete cascade,
  harici_kullanici_id text,
  aktivite_kodu text not null,
  rol_kodu text,
  sistem_kapsami text not null default 'kalkan_os',
  gecerlilik_baslangic date not null default current_date,
  gecerlilik_bitis date,
  kaynak_sistem text not null default 'kalkan_os',
  son_senkron_at timestamptz,
  created_at timestamptz not null default now(),
  check (kullanici_id is not null or harici_kullanici_id is not null)
);

create index sod_atamalari_tenant_idx on public.sod_atamalari (tenant_id, aktivite_kodu);

/**
 * Değerlendirme koşusu — motorun HER çalışmasının kaydı (kurucu talimatı
 * 2.4). `kural_seti_hash`/`atama_snapshot_hash`, aynı girdinin aynı sonucu
 * verdiğini SONRADAN kanıtlamak için tutulur (kural 11: determinizm iddiası
 * "güvenin" değil, yeniden hesaplanabilir bir hash'e dayanır).
 */
create table public.sod_degerlendirme_calistirmalari (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  baslama_at timestamptz not null default now(),
  bitis_at timestamptz,
  kural_seti_hash text,
  atama_snapshot_hash text,
  bulunan_sayisi integer,
  yeni_sayisi integer,
  cozulen_sayisi integer,
  hata text,
  calistiran uuid references public.profiles (id) on delete set null
);

create index sod_degerlendirme_calistirmalari_tenant_idx
  on public.sod_degerlendirme_calistirmalari (tenant_id, baslama_at desc);

alter table public.sod_degerlendirme_calistirmalari enable row level security;
create policy sod_degerlendirme_calistirmalari_own_tenant on public.sod_degerlendirme_calistirmalari
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

/**
 * Tespit edilen çatışma. Tekrar değerlendirme DUPLICATE üretmez: aynı
 * (tenant, rule, kullanıcı, sistem_kapsamı) kombinasyonu tek bir açık kayda
 * karşılık gelir (fingerprint + unique index). Kaldırılan çatışma KANITSIZ
 * SİLİNMEZ — motor onu silmez, yalnızca durumunu günceller (append-only'nin
 * ruhu: geçmişte tespit edilmiş bir olgu sessizce yok olmaz).
 */
create table public.sod_catismalari (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  rule_id uuid not null references public.sod_kurallari (id) on delete cascade,
  kullanici_id uuid references public.profiles (id) on delete cascade,
  harici_kullanici_id text,
  sistem_kapsami text not null,
  onem text not null check (onem in ('acil', 'kritik', 'yuksek', 'orta', 'dusuk')),
  durum text not null default 'OPEN' check (durum in (
    'OPEN', 'UNDER_REVIEW', 'EXCEPTION_REQUESTED', 'EXCEPTION_APPROVED',
    'MITIGATED', 'RESOLVED', 'REOPENED', 'EXPIRED', 'FALSE_POSITIVE'
  )),
  -- Dedup anahtarı: sha256(tenant_id||rule_id||kullanici_id||sistem_kapsami),
  -- src/lib/sod.ts'te hesaplanır. Aynı kombinasyon iki kez AÇILMAZ.
  fingerprint text not null,
  ilk_gorulme_at timestamptz not null default now(),
  son_gorulme_at timestamptz not null default now(),
  -- Hangi değerlendirme koşusunda tespit/güncellendi — determinizm kanıtı.
  degerlendirme_calistirma_id uuid references public.sod_degerlendirme_calistirmalari (id) on delete set null,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, fingerprint)
);

create index sod_catismalari_tenant_durum_idx on public.sod_catismalari (tenant_id, durum);

/**
 * İstisna. SÜRESİZ İSTİSNA OLAMAZ (bitis not null). Talep eden kendi
 * istisnasını onaylayamaz — bu DB'de de zorlanır (aşağıdaki guard), yalnız
 * route'a bırakılmaz.
 */
create table public.sod_istisnalari (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.sod_catismalari (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  gerekce text not null,
  risk_sahibi_id uuid references public.profiles (id) on delete set null,
  talep_eden_id uuid not null references public.profiles (id) on delete set null,
  onaylayan_id uuid references public.profiles (id) on delete set null,
  baslangic date not null default current_date,
  bitis date not null,
  risk_degerlendirmesi text,
  durum text not null default 'talep_edildi'
    check (durum in ('talep_edildi', 'onaylandi', 'reddedildi', 'iptal', 'suresi_doldu')),
  -- Onay/red GEREKÇESİ (kurucu talimatı: "Onay/red gerekçesi zorunlu
  -- olmalı"). Zorunluluk route'ta kontrol edilir (route boş metni reddeder);
  -- DB seviyesinde zorlanmıyor çünkü otomatik süre-dolma (suresi_doldu) bir
  -- insan kararı değildir ve gerekçesiz olabilir.
  karar_notu text,
  iptal_nedeni text,
  iptal_eden uuid references public.profiles (id) on delete set null,
  iptal_at timestamptz,
  created_at timestamptz not null default now(),
  check (bitis > baslangic)
);

create index sod_istisnalari_conflict_idx on public.sod_istisnalari (conflict_id);

/**
 * Telafi edici kontrol bağı. YENİ BİR TEST ALTYAPISI DEĞİL: test_definition_id
 * mevcut control_test_definitions'a (M12) işaret eder; motor testDegerlendir'i
 * (control-test.ts) YENİDEN KULLANIR. Bu tablo yalnızca "hangi çatışma hangi
 * teste bağlı, ne sıklıkla, son/sıradaki çalışma ne zaman" ilişkisini tutar.
 */
create table public.sod_telafi_edici_kontroller (
  id uuid primary key default gen_random_uuid(),
  conflict_id uuid not null references public.sod_catismalari (id) on delete cascade,
  exception_id uuid references public.sod_istisnalari (id) on delete set null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  control_id uuid references public.controls (id) on delete set null,
  test_definition_id uuid not null references public.control_test_definitions (id) on delete restrict,
  gereken_siklik_gun integer check (gereken_siklik_gun is null or gereken_siklik_gun > 0),
  son_basarili_calisma_at timestamptz,
  sonraki_calisma_at timestamptz,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create index sod_telafi_edici_kontroller_conflict_idx
  on public.sod_telafi_edici_kontroller (conflict_id);

-- --- RLS: kural 1, hiçbir tablo bunsuz "bitti" sayılmaz ---
alter table public.sod_kurallari enable row level security;
alter table public.sod_kural_taraflari enable row level security;
alter table public.sod_atamalari enable row level security;
alter table public.sod_catismalari enable row level security;
alter table public.sod_istisnalari enable row level security;
alter table public.sod_telafi_edici_kontroller enable row level security;

create policy sod_kurallari_own_tenant on public.sod_kurallari
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- sod_kural_taraflari kendi tenant_id taşımaz (rule_id üzerinden dolaylı) —
-- join ile kısıtlanır: yalnızca kendi kiracısının kuralına ait taraflar.
create policy sod_kural_taraflari_own_tenant on public.sod_kural_taraflari
  for all using (
    exists (
      select 1 from public.sod_kurallari r
      where r.id = sod_kural_taraflari.rule_id and r.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.sod_kurallari r
      where r.id = sod_kural_taraflari.rule_id and r.tenant_id = public.current_tenant_id()
    )
  );

create policy sod_atamalari_own_tenant on public.sod_atamalari
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy sod_catismalari_own_tenant on public.sod_catismalari
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy sod_istisnalari_own_tenant on public.sod_istisnalari
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy sod_telafi_edici_kontroller_own_tenant on public.sod_telafi_edici_kontroller
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

/**
 * MEVZUAT DURUMU GEÇİŞ GUARD'I.
 *
 * TODO_DOGRULA -> VERIFIED yalnızca `onaylayan` doluyken mümkün — bu DB'nin
 * zorlayabildiği asgari iz. Gerçek "ayrı hukuk/uyum yetkisi" kontrolü route
 * seviyesinde (bu turda: admin rolüne sıkıştırıldı, ROADMAP M16 "açık
 * kurucu kararı #1"). VERIFIED'den geriye (TODO_DOGRULA'ya) dönüş serbest —
 * bir kuralın doğrulaması geri alınabilir (ör. mevzuat değişti).
 */
create or replace function public.sod_kural_mevzuat_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.mevzuat_durumu = 'VERIFIED' and old.mevzuat_durumu is distinct from 'VERIFIED' then
    if new.onaylayan is null then
      raise exception 'TODO_DOGRULA -> VERIFIED gecisi onaylayan olmadan yapilamaz (kural 3)';
    end if;
  end if;
  return new;
end;
$$;

create trigger sod_kural_mevzuat_guard_before_update
  before update on public.sod_kurallari
  for each row execute function public.sod_kural_mevzuat_guard();

/**
 * ÇATIŞMA DURUM GEÇİŞ GUARD'I — M12'nin verified-closure guard'ıyla aynı
 * disiplin (bir DB invariant, uygulama koduna bırakılmayan bir garanti).
 *
 *   -> EXCEPTION_APPROVED : bağlı bir istisna 'onaylandi' olmalı VE
 *                            onaylayan, talep edenden FARKLI olmalı
 *                            (kendi kendine emsal yasak — istisna tablosunun
 *                            kendi guard'ı da bunu zorlar, burada ikinci kez).
 *   -> MITIGATED          : bağlı bir telafi edici kontrolün EN SON test_run'ı
 *                            (M12) PASSED olmalı.
 *   -> RESOLVED           : resolved_by dolu olmalı VE önceki durum MITIGATED
 *                            veya EXCEPTION_APPROVED olmalı (OPEN'dan direkt
 *                            RESOLVED'e sıçrama yok — ya mitigasyon ya
 *                            istisna onayı geçmiş olmalı).
 */
create or replace function public.sod_catisma_durum_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_istisna record;
  v_son_test text;
begin
  if new.durum = old.durum then
    return new;
  end if;

  if new.durum = 'EXCEPTION_APPROVED' then
    select onaylayan_id, talep_eden_id into v_istisna
    from public.sod_istisnalari
    where conflict_id = new.id and durum = 'onaylandi'
    order by created_at desc limit 1;

    if v_istisna is null then
      raise exception 'EXCEPTION_APPROVED: onaylanmis bir istisna bulunamadi';
    end if;
    if v_istisna.onaylayan_id = v_istisna.talep_eden_id then
      raise exception 'Talep eden kendi istisnasini onaylayamaz';
    end if;
  end if;

  if new.durum = 'MITIGATED' then
    select r.sonuc into v_son_test
    from public.sod_telafi_edici_kontroller cc
    join public.test_runs r on r.test_definition_id = cc.test_definition_id
    where cc.conflict_id = new.id and cc.aktif
    order by r.calisti_at desc limit 1;

    if v_son_test is distinct from 'PASSED' then
      raise exception 'MITIGATED: baglanan telafi edici kontrolun son test sonucu PASSED degil (%)',
        coalesce(v_son_test, 'kosu yok');
    end if;
  end if;

  if new.durum = 'RESOLVED' then
    if new.resolved_by is null then
      raise exception 'RESOLVED: bagimsiz kapanisi onaylayan (resolved_by) zorunlu';
    end if;
    if old.durum not in ('MITIGATED', 'EXCEPTION_APPROVED') then
      raise exception 'RESOLVED: yalnizca MITIGATED veya EXCEPTION_APPROVED durumundan ulasilir (once mitigasyon veya istisna onayi gerekir)';
    end if;
  end if;

  return new;
end;
$$;

create trigger sod_catisma_durum_guard_before_update
  before update on public.sod_catismalari
  for each row execute function public.sod_catisma_durum_guard();

/**
 * İSTİSNA ONAY GUARD'I: talep eden kendi istisnasını onaylayamaz. Çatışma
 * guard'ı bunu ikinci kez sınar (EXCEPTION_APPROVED geçişinde); burada da
 * zorlanması, istisna UPDATE'inin KENDİSİNİN bu kuralı hiçbir yoldan
 * atlayamamasını sağlar.
 */
create or replace function public.sod_istisna_onay_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'onaylandi' and new.onaylayan_id is not null
     and new.onaylayan_id = new.talep_eden_id then
    raise exception 'Talep eden kendi istisnasini onaylayamaz';
  end if;
  if new.durum = 'onaylandi' and new.onaylayan_id is null then
    raise exception 'Onaylanan istisnada onaylayan_id zorunlu';
  end if;
  return new;
end;
$$;

create trigger sod_istisna_onay_guard_before_update
  before update on public.sod_istisnalari
  for each row execute function public.sod_istisna_onay_guard();

create trigger sod_istisna_onay_guard_before_insert
  before insert on public.sod_istisnalari
  for each row execute function public.sod_istisna_onay_guard();

-- --- Denetim izi (kurucu talimatı: "her mutasyon immutable audit kaydı
-- üretmeli") — 20260717090000'deki audit_tenant_controls/audit_findings
-- deseninin aynısı: trigger'da, istemci audit_log'a YAZAMAZ (politika yok),
-- ne yazılacağına şema karar verir. Serbest metin (gerekce, aciklama vb.)
-- İÇERİĞİ audit_log'a YAZILMAZ (kural 7) — yalnızca hangi alanın değiştiği.

create or replace function public.audit_sod_kural()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sod_kural_olusturuldu', 'sod_kurallari', new.id,
      jsonb_build_object('kod', new.kod, 'kaynak_turu', new.kaynak_turu, 'mevzuat_durumu', new.mevzuat_durumu)
    );
    return new;
  end if;

  if new.durum is distinct from old.durum or new.mevzuat_durumu is distinct from old.mevzuat_durumu then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sod_kural_guncellendi', 'sod_kurallari', new.id,
      jsonb_build_object(
        'durum_onceki', old.durum, 'durum', new.durum,
        'mevzuat_durumu_onceki', old.mevzuat_durumu, 'mevzuat_durumu', new.mevzuat_durumu
      )
    );
  end if;
  return new;
end;
$$;

create trigger audit_sod_kural_after_insert
  after insert on public.sod_kurallari
  for each row execute function public.audit_sod_kural();
create trigger audit_sod_kural_after_update
  after update on public.sod_kurallari
  for each row execute function public.audit_sod_kural();

create or replace function public.audit_sod_catisma()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sod_catisma_tespit_edildi', 'sod_catismalari', new.id,
      jsonb_build_object('rule_id', new.rule_id, 'onem', new.onem)
    );
    return new;
  end if;

  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sod_catisma_durumu_degisti', 'sod_catismalari', new.id,
      jsonb_build_object('onceki', old.durum, 'durum', new.durum)
    );
  end if;
  return new;
end;
$$;

create trigger audit_sod_catisma_after_insert
  after insert on public.sod_catismalari
  for each row execute function public.audit_sod_catisma();
create trigger audit_sod_catisma_after_update
  after update on public.sod_catismalari
  for each row execute function public.audit_sod_catisma();

create or replace function public.audit_sod_istisna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sod_istisna_talep_edildi', 'sod_istisnalari', new.id,
      -- gerekce/risk_degerlendirmesi İÇERİĞİ yazılmaz (kural 7) — yalnızca
      -- hangi çatışma için, ne zamana kadar istisna talep edildiği.
      jsonb_build_object('conflict_id', new.conflict_id, 'bitis', new.bitis)
    );
    return new;
  end if;

  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sod_istisna_karar_verildi', 'sod_istisnalari', new.id,
      jsonb_build_object('onceki', old.durum, 'durum', new.durum, 'onaylayan_id', new.onaylayan_id)
    );
  end if;
  return new;
end;
$$;

create trigger audit_sod_istisna_after_insert
  after insert on public.sod_istisnalari
  for each row execute function public.audit_sod_istisna();
create trigger audit_sod_istisna_after_update
  after update on public.sod_istisnalari
  for each row execute function public.audit_sod_istisna();

create or replace function public.audit_sod_telafi_kontrol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'sod_telafi_kontrol_atandi', 'sod_telafi_edici_kontroller', new.id,
    jsonb_build_object('conflict_id', new.conflict_id, 'test_definition_id', new.test_definition_id)
  );
  return new;
end;
$$;

create trigger audit_sod_telafi_kontrol_after_insert
  after insert on public.sod_telafi_edici_kontroller
  for each row execute function public.audit_sod_telafi_kontrol();
