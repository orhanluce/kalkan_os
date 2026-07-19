-- 37 Tez Nihai Uygulama Talimatı — Dikey A (19 Temmuz 2026, docs/adr/PR0-37-
-- tez-kesif-2026-07-19.md, docs/GAP_MAP_37_TEZ.md KOS-8): tedarikçi
-- portalında anket YANITLAMA. §1.54'ün salt-okur vendor-portal dış erişimini
-- BOZMADAN aynı grant/token/audit desenini genişletiyor — ikinci bir dış-
-- erişim mekanizması kurulmadı.
--
-- TOKEN SERTLEŞTİRME (talimat Dikey A'nın kendi asgari invariant'ı):
-- third_party_access_grants ARTIK düz token SAKLAMIYOR — yalnız token_hash
-- (sha256 hex). Token TAMAMEN istemci tarafında üretilir (crypto.getRandomValues,
-- 256 bit), hash'i insert edilir; düz değer yalnız o anki UI state'inde kalır
-- ve linke gömülür — DB/audit/log hiç görmez. Okuma/yazma RPC'leri gelen
-- token'ı KENDİLERİ hash'leyip karşılaştırır (matter_goruntule/tedarikci_
-- goruntule ile aynı "geçersiz/dolmuş/iptal/yanlış kapsam AYNI davranış"
-- disiplini korunur). Not: matter_access_grants (M41/regülatör) bu turda
-- DOKUNULMADI — Dikey A yalnız M35'i kapsıyor (bilinçli, Gap Map'te kayıtlı).
--
-- DURUM MAKİNESİ (talimat §4 Dikey A, repo adlandırmasına uyarlandı):
--   TASLAK -> GONDERILDI -> (kurum incelemesi) -> DEGISIKLIK_ISTENDI ->
--   [YENİ revizyon açılır] -> ... -> KABUL_EDILDI | REDDEDILDI | SURESI_DOLDU
-- Revizyon (surum) bazında append-only: GONDERILDI olmuş bir revizyonun
-- cevapları donuk kalır — değişiklik YENİ revizyon (surum+1) açar, eskisi
-- silinmez/değişmez ("geçmiş append-only korunur").
--
-- YAYIN KAPISI: third_party_assessments.durum zaten var (TASLAK/DEVAM/
-- TAMAMLANDI) — YENİ KOLON AÇILMADI. TASLAK = hâlâ iç hazırlıkta, tedarikçiye
-- GÖRÜNMEZ/erişilemez. DEVAM'a geçiş = "yayınlandı" (en az 1 soru şartı, guard).
--
-- KURUM TEDARİKÇİ ADINA CEVAP ÜRETEMEZ: assessment_response_answers'a
-- authenticated/anon insert/update tamamen REVOKE; yalnız tedarikci_anket_
-- taslak_kaydet (SECURITY DEFINER, token'la kimliklenir) yazar. Kurum tarafı
-- yalnız GONDERILDI durumundaki bir revizyonu inceleyebilir (RLS: durum =
-- 'GONDERILDI' olmayan satırlara UPDATE erişimi YOK) — TASLAK bir revizyonu
-- kurum asla göremeden/dokunamadan geçemez.
--
-- KAPSAM DIŞI (bilinçli, talimatın kendi izniyle): dosya yükleme YOK — anonim
-- token sahibi için güvenli bir imzalı-upload/Storage RLS varyantı bu
-- dilimde KURULMADI (mevcut `evidence` bucket'ı yalnız authenticated tenant
-- kullanıcısı için tasarlı, path'i `{tenant_id}/{sha256}` auth.uid() RLS'ine
-- bağlı). Kanıt bu turda METİN/URL (`kanit_metni`). Bildirim/e-posta
-- gönderimi YOK (repo'da hiçbir e-posta sağlayıcısı yok — icat edilmedi,
-- kural 4 ruhu: taşınamaz/var olmayan altyapı kurulmaz).
--
-- ROLLBACK NOTU: token_hash geçişi hariç tamamen eklemeli, yeni tablolar
-- bağımsız (assessment_response_answers, assessment_response_revisions ters
-- FK sırasıyla drop edilebilir). Token sertleştirmesi GERİ ALINAMAZ (düz
-- token zaten atıldı) — geri dönülecekse yeni bir grant deseni gerekir.

-- =====================================================================
-- 1) Token sertleştirme: third_party_access_grants
-- =====================================================================
alter table public.third_party_access_grants add column token_hash text;

-- digest() Supabase'de extensions şemasında, PGlite'ta public'te kurulur
-- (bkz. src/lib/__tests__/helpers/pg.ts AUTH_STUB notu) — search_path ikisini
-- de kapsar ki bu tek seferlik UPDATE her iki ortamda da çalışsın.
set local search_path = public, extensions;
update public.third_party_access_grants set token_hash = encode(digest(token, 'sha256'), 'hex');

alter table public.third_party_access_grants alter column token_hash set not null;
alter table public.third_party_access_grants add constraint third_party_access_grants_token_hash_key unique (token_hash);
drop index if exists third_party_access_grants_token_idx;
alter table public.third_party_access_grants drop column token;
create index third_party_access_grants_token_hash_idx on public.third_party_access_grants (token_hash);

-- =====================================================================
-- 2) Anket yayın kapısı: third_party_assessments.durum'a mevcut anlam
-- =====================================================================
create or replace function public.assessment_yayinla_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum = 'DEVAM' and old.durum = 'TASLAK' then
    if not exists (select 1 from public.assessment_questions where assessment_id = new.id) then
      raise exception 'En az bir soru olmadan anket tedarikciye yayinlanamaz';
    end if;
  end if;
  return new;
end;
$$;

create trigger assessment_yayinla_guard_trg
  before update on public.third_party_assessments
  for each row execute function public.assessment_yayinla_guard();

-- =====================================================================
-- 3) Yanıt revizyonları (append-only durum makinesi)
-- =====================================================================
create table public.assessment_response_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  assessment_id uuid not null references public.third_party_assessments (id) on delete cascade,
  surum integer not null,
  durum text not null default 'TASLAK'
    check (durum in ('TASLAK', 'GONDERILDI', 'DEGISIKLIK_ISTENDI', 'KABUL_EDILDI', 'REDDEDILDI', 'SURESI_DOLDU')),
  gonderen_email text,
  gonderildi_at timestamptz,
  inceleyen uuid references public.profiles (id) on delete restrict,
  inceleme_gerekcesi text,
  inceleme_zamani timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, surum)
);

create trigger assessment_response_revisions_set_updated_at
  before update on public.assessment_response_revisions
  for each row execute function public.set_updated_at();

create index assessment_response_revisions_assessment_idx on public.assessment_response_revisions (assessment_id, surum desc);

-- =====================================================================
-- 4) Revizyon içi cevaplar
-- =====================================================================
create table public.assessment_response_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  revizyon_id uuid not null references public.assessment_response_revisions (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete restrict,
  cevap text,
  kanit_metni text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revizyon_id, question_id)
);

create trigger assessment_response_answers_set_updated_at
  before update on public.assessment_response_answers
  for each row execute function public.set_updated_at();

/**
 * REVİZYON DONMA GUARD'I: TASLAK dışı bir revizyonun cevapları INSERT/UPDATE
 * edilemez — "SUBMITTED cevap sessizce değiştirilemez". service_role dahil
 * (RPC'ler bile TASLAK dışına yazamaz — yeni revizyon açmak zorundadır).
 */
create or replace function public.assessment_response_answer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_durum text;
begin
  select durum into v_durum from public.assessment_response_revisions where id = coalesce(new.revizyon_id, old.revizyon_id);
  if v_durum is distinct from 'TASLAK' then
    raise exception 'Yalniz TASLAK revizyonun cevaplari degistirilebilir (revizyon donuk: %)', v_durum;
  end if;
  return new;
end;
$$;

create trigger assessment_response_answer_guard_trg
  before insert or update on public.assessment_response_answers
  for each row execute function public.assessment_response_answer_guard();

/**
 * REVİZYON DURUM GEÇİŞ GUARD'I:
 *  - TASLAK -> GONDERILDI | SURESI_DOLDU (doğrudan başka yere atlama yok).
 *  - GONDERILDI -> DEGISIKLIK_ISTENDI | KABUL_EDILDI | REDDEDILDI | SURESI_DOLDU.
 *  - DEGISIKLIK_ISTENDI -> yalnız SURESI_DOLDU (yeni cevap YENİ revizyon açar,
 *    bu satır donuk kalır).
 *  - Terminal durumlardan (KABUL_EDILDI/REDDEDILDI/SURESI_DOLDU) ÇIKIŞ yok.
 *  - DEGISIKLIK_ISTENDI/REDDEDILDI gerekçesiz olamaz (override/red kuralı).
 *  - İnceleme kararı (DEGISIKLIK_ISTENDI/KABUL_EDILDI/REDDEDILDI) inceleyen +
 *    zaman ister; kimlik atfı oturum sahibine sabit (service/cron muaf —
 *    SURESI_DOLDU cron'dan gelir, inceleyen istemez).
 *  - Aynı durumdan aynı duruma (idempotent no-op) guard'ı hiç görmez — çift-
 *    submit/çift-karar burada zaten zararsız (RLS/RPC seviyesinde de korunur).
 */
create or replace function public.assessment_response_revision_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and new.durum is distinct from old.durum then
    if old.durum in ('KABUL_EDILDI', 'REDDEDILDI', 'SURESI_DOLDU') then
      raise exception 'Terminal durumdan (%) gecis yapilamaz', old.durum;
    end if;
    if old.durum = 'TASLAK' and new.durum not in ('GONDERILDI', 'SURESI_DOLDU') then
      raise exception 'TASLAK yalnizca GONDERILDI veya SURESI_DOLDU olabilir';
    end if;
    if old.durum = 'GONDERILDI' and new.durum not in ('DEGISIKLIK_ISTENDI', 'KABUL_EDILDI', 'REDDEDILDI', 'SURESI_DOLDU') then
      raise exception 'GONDERILDI yalniz inceleme kararina veya sure-dolumuna gecebilir';
    end if;
    if old.durum = 'DEGISIKLIK_ISTENDI' and new.durum <> 'SURESI_DOLDU' then
      raise exception 'DEGISIKLIK_ISTENDI icin tek gecis SURESI_DOLDU''dur (yeni cevap YENI revizyon acar)';
    end if;
    if new.durum in ('DEGISIKLIK_ISTENDI', 'REDDEDILDI') and (new.inceleme_gerekcesi is null or btrim(new.inceleme_gerekcesi) = '') then
      raise exception 'Degisiklik istegi/red gerekce ister';
    end if;
    if new.durum in ('DEGISIKLIK_ISTENDI', 'KABUL_EDILDI', 'REDDEDILDI') then
      if new.inceleyen is null or new.inceleme_zamani is null then
        raise exception 'Inceleme karari inceleyen + zaman ister';
      end if;
      if auth.uid() is not null and new.inceleyen is distinct from auth.uid() then
        raise exception 'Inceleme ancak oturum sahibi adina yapilabilir (kimlik atfi)';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger assessment_response_revision_guard_trg
  before update on public.assessment_response_revisions
  for each row execute function public.assessment_response_revision_guard();

-- =====================================================================
-- 5) Süre-dolumu cron (SoD/TPR/eğitim deseninin aynısı, kural 4: pg_cron)
-- =====================================================================
create or replace function public.tedarikci_anket_suresi_dolanlari_isle()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev record;
begin
  for v_rev in
    select r.id
    from public.assessment_response_revisions r
    join public.third_party_assessments a on a.id = r.assessment_id
    where r.durum in ('TASLAK', 'GONDERILDI', 'DEGISIKLIK_ISTENDI')
      and not exists (
        select 1 from public.third_party_access_grants g
        where g.third_party_id = a.third_party_id
          and g.son_gecerlilik >= now()
          and not g.iptal_edildi
      )
    for update of r skip locked
  loop
    begin
      update public.assessment_response_revisions set durum = 'SURESI_DOLDU' where id = v_rev.id;
      insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
      select tenant_id, null, 'tedarikci_anket_suresi_doldu', 'assessment_response_revisions', id, '{}'::jsonb
      from public.assessment_response_revisions where id = v_rev.id;
    exception when others then
      raise notice 'tedarikci_anket_suresi_dolanlari_isle: % icin hata: %', v_rev.id, sqlerrm;
    end;
  end loop;
end;
$$;

revoke execute on function public.tedarikci_anket_suresi_dolanlari_isle() from authenticated, anon;

do $$
begin
  perform cron.schedule('kalkan-tedarikci-anket-suresi-dolumu', '*/5 * * * *', 'select public.tedarikci_anket_suresi_dolanlari_isle();');
exception when others then
  raise notice 'pg_cron schedule atlandi (PGlite/local ortam): %', sqlerrm;
end;
$$;

-- =====================================================================
-- 6) Oturumsuz RPC'ler (tedarikci_goruntule ile AYNI token disiplini)
-- =====================================================================

-- tedarikci_goruntule'a anket LİSTESİ eklendi (geriye uyumlu — mevcut alanlar
-- korunur, yalnız yeni 'anketler' alanı eklendi).
create or replace function public.tedarikci_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grant record;
  v_tp record;
  v_degerlendirme record;
  v_bulgular jsonb;
  v_anketler jsonb;
begin
  select * into v_grant from public.third_party_access_grants
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_grant is null or v_grant.son_gecerlilik < now() or v_grant.iptal_edildi then
    return null;
  end if;

  select id, ad, tier, karar into v_tp
  from public.third_parties where id = v_grant.third_party_id and tenant_id = v_grant.tenant_id;
  if v_tp is null then
    return null;
  end if;

  select tur, durum, tamamlandi_at into v_degerlendirme
  from public.third_party_assessments
  where third_party_id = v_tp.id
  order by baslangic_at desc
  limit 1;

  select coalesce(jsonb_agg(b order by b."hedefTarih" nulls last), '[]'::jsonb) into v_bulgular
  from (
    select f.baslik, f.ciddiyet, f.durum, f.hedef_tarih as "hedefTarih"
    from public.assessment_findings f
    where f.third_party_id = v_tp.id and f.durum <> 'KAPANDI'
  ) b;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'tur', a.tur, 'durum', a.durum) order by a.baslangic_at desc), '[]'::jsonb)
    into v_anketler
    from public.third_party_assessments a
    where a.third_party_id = v_tp.id and a.durum in ('DEVAM', 'TAMAMLANDI');

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_grant.tenant_id, null, 'tedarikci_dis_goruntulendi', 'third_party_access_grants', v_grant.id,
    jsonb_build_object('third_party_id', v_tp.id));

  return jsonb_build_object(
    'ad', v_tp.ad, 'tier', v_tp.tier, 'karar', v_tp.karar,
    'sonGecerlilik', v_grant.son_gecerlilik,
    'degerlendirme', case when v_degerlendirme is null then null else
      jsonb_build_object('tur', v_degerlendirme.tur, 'durum', v_degerlendirme.durum, 'tamamlandiAt', v_degerlendirme.tamamlandi_at)
    end,
    'acikBulgular', v_bulgular,
    'anketler', v_anketler
  );
end;
$$;

-- --- Anket detayı (sorular + mevcut revizyon + cevaplar) ---
create or replace function public.tedarikci_anket_getir(p_token text, p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grant record;
  v_assessment record;
  v_revizyon record;
  v_sorular jsonb;
  v_cevaplar jsonb;
begin
  select * into v_grant from public.third_party_access_grants
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_grant is null or v_grant.son_gecerlilik < now() or v_grant.iptal_edildi then
    return null;
  end if;

  select id, tur, durum into v_assessment
    from public.third_party_assessments
    where id = p_assessment_id and third_party_id = v_grant.third_party_id and tenant_id = v_grant.tenant_id
      and durum in ('DEVAM', 'TAMAMLANDI');
  if v_assessment.id is null then
    return null;
  end if;

  select id, surum, durum, gonderildi_at, inceleme_gerekcesi, inceleme_zamani into v_revizyon
    from public.assessment_response_revisions
    where assessment_id = v_assessment.id
    order by surum desc
    limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'soru', q.soru, 'sira', q.sira) order by q.sira), '[]'::jsonb)
    into v_sorular
    from public.assessment_questions q where q.assessment_id = v_assessment.id;

  v_cevaplar := '[]'::jsonb;
  if v_revizyon.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('questionId', a.question_id, 'cevap', a.cevap, 'kanitMetni', a.kanit_metni)), '[]'::jsonb)
      into v_cevaplar
      from public.assessment_response_answers a where a.revizyon_id = v_revizyon.id;
  end if;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_grant.tenant_id, null, 'tedarikci_anket_goruntulendi', 'third_party_assessments', v_assessment.id,
    jsonb_build_object('assessment_id', v_assessment.id));

  return jsonb_build_object(
    'assessmentId', v_assessment.id, 'tur', v_assessment.tur, 'assessmentDurum', v_assessment.durum,
    'sorular', v_sorular,
    'revizyon', case when v_revizyon.id is null then null else
      jsonb_build_object('surum', v_revizyon.surum, 'durum', v_revizyon.durum, 'gonderildiAt', v_revizyon.gonderildi_at,
        'incelemeGerekcesi', v_revizyon.inceleme_gerekcesi, 'incelemeZamani', v_revizyon.inceleme_zamani)
    end,
    'cevaplar', v_cevaplar
  );
end;
$$;

-- --- Taslak kaydet (idempotent upsert; DEGISIKLIK_ISTENDI'den sonra YENİ revizyon açar) ---
create or replace function public.tedarikci_anket_taslak_kaydet(p_token text, p_assessment_id uuid, p_cevaplar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grant record;
  v_assessment record;
  v_revizyon record;
  v_item jsonb;
begin
  select * into v_grant from public.third_party_access_grants
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_grant is null or v_grant.son_gecerlilik < now() or v_grant.iptal_edildi then
    return null;
  end if;

  select id into v_assessment
    from public.third_party_assessments
    where id = p_assessment_id and third_party_id = v_grant.third_party_id and tenant_id = v_grant.tenant_id
      and durum in ('DEVAM', 'TAMAMLANDI');
  if v_assessment.id is null then
    return null;
  end if;

  select * into v_revizyon
    from public.assessment_response_revisions
    where assessment_id = v_assessment.id
    order by surum desc
    limit 1
    for update;

  if v_revizyon.id is null then
    insert into public.assessment_response_revisions (tenant_id, assessment_id, surum, durum, gonderen_email)
      values (v_grant.tenant_id, v_assessment.id, 1, 'TASLAK', v_grant.external_email)
      returning * into v_revizyon;
  elsif v_revizyon.durum = 'DEGISIKLIK_ISTENDI' then
    insert into public.assessment_response_revisions (tenant_id, assessment_id, surum, durum, gonderen_email)
      values (v_grant.tenant_id, v_assessment.id, v_revizyon.surum + 1, 'TASLAK', v_grant.external_email)
      returning * into v_revizyon;
  elsif v_revizyon.durum <> 'TASLAK' then
    return jsonb_build_object('hata', 'BU_ASAMADA_DUZENLENEMEZ', 'durum', v_revizyon.durum);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_cevaplar, '[]'::jsonb))
  loop
    if not exists (select 1 from public.assessment_questions where id = (v_item->>'questionId')::uuid and assessment_id = v_assessment.id) then
      continue;
    end if;
    insert into public.assessment_response_answers (tenant_id, revizyon_id, question_id, cevap, kanit_metni)
      values (v_grant.tenant_id, v_revizyon.id, (v_item->>'questionId')::uuid, v_item->>'cevap', v_item->>'kanitMetni')
    on conflict (revizyon_id, question_id) do update set cevap = excluded.cevap, kanit_metni = excluded.kanit_metni;
  end loop;

  return jsonb_build_object('revizyon', v_revizyon.surum, 'durum', 'TASLAK');
end;
$$;

-- --- Gönder (idempotent: zaten gönderilmişse mevcut durumu sessizce döner) ---
create or replace function public.tedarikci_anket_gonder(p_token text, p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grant record;
  v_assessment record;
  v_revizyon record;
  v_cevap_sayisi integer;
begin
  select * into v_grant from public.third_party_access_grants
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_grant is null or v_grant.son_gecerlilik < now() or v_grant.iptal_edildi then
    return null;
  end if;

  select id into v_assessment
    from public.third_party_assessments
    where id = p_assessment_id and third_party_id = v_grant.third_party_id and tenant_id = v_grant.tenant_id
      and durum in ('DEVAM', 'TAMAMLANDI');
  if v_assessment.id is null then
    return null;
  end if;

  select * into v_revizyon
    from public.assessment_response_revisions
    where assessment_id = v_assessment.id
    order by surum desc
    limit 1
    for update;

  if v_revizyon.id is null then
    return jsonb_build_object('hata', 'TASLAK_YOK');
  end if;

  if v_revizyon.durum <> 'TASLAK' then
    return jsonb_build_object('revizyon', v_revizyon.surum, 'durum', v_revizyon.durum);
  end if;

  select count(*) into v_cevap_sayisi from public.assessment_response_answers
    where revizyon_id = v_revizyon.id and cevap is not null and btrim(cevap) <> '';
  if v_cevap_sayisi = 0 then
    return jsonb_build_object('hata', 'BOS_ANKET_GONDERILEMEZ');
  end if;

  update public.assessment_response_revisions
    set durum = 'GONDERILDI', gonderildi_at = now(), gonderen_email = v_grant.external_email
    where id = v_revizyon.id;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_grant.tenant_id, null, 'tedarikci_anket_gonderildi', 'assessment_response_revisions', v_revizyon.id,
    jsonb_build_object('assessment_id', v_assessment.id, 'surum', v_revizyon.surum, 'cevaplanan', v_cevap_sayisi));

  return jsonb_build_object('revizyon', v_revizyon.surum, 'durum', 'GONDERILDI');
end;
$$;

grant execute on function public.tedarikci_anket_getir(text, uuid) to anon, authenticated;
grant execute on function public.tedarikci_anket_taslak_kaydet(text, uuid, jsonb) to anon, authenticated;
grant execute on function public.tedarikci_anket_gonder(text, uuid) to anon, authenticated;

-- =====================================================================
-- 7) RLS
-- =====================================================================
alter table public.assessment_response_revisions enable row level security;
alter table public.assessment_response_answers enable row level security;

create policy assessment_response_revisions_select on public.assessment_response_revisions
  for select using (tenant_id = public.current_tenant_id());
-- KURUM YALNIZ GONDERILDI DURUMUNU İNCELEYEBİLİR: TASLAK bir revizyona
-- authenticated kullanıcı hiçbir yoldan UPDATE atamaz (USING satırı zaten
-- durum='GONDERILDI' değilse eşleşmez) — "kurum tedarikçi adına cevap
-- üretemez" invariant'ı burada RLS seviyesinde de kilitli.
create policy assessment_response_revisions_inceleme on public.assessment_response_revisions
  for update
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum') and durum = 'GONDERILDI')
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
-- INSERT/DELETE yok: yalnız tedarikci_anket_taslak_kaydet (SECURITY DEFINER) yeni revizyon açar.
revoke insert, delete on public.assessment_response_revisions from authenticated, anon;

create policy assessment_response_answers_select on public.assessment_response_answers
  for select using (tenant_id = public.current_tenant_id());
-- YAZMA YOK: yalnız tedarikci_anket_taslak_kaydet (SECURITY DEFINER) yazar —
-- kurum tedarikçinin cevap METNİNİ asla düzenleyemez, yalnız karar verebilir.
revoke insert, update, delete on public.assessment_response_answers from authenticated, anon;
