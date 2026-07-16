-- Denetim izini uygulamadan alıp şemaya verir.
--
-- NEDEN: audit kaydını istemci yazdığında iki ayrı istek oluyordu (ana tablo,
-- sonra audit_log). PostgREST'te transaction yok — ilki başarılı olup ikincisi
-- düşerse iz sessizce kopar. Bir uyum ürününde "denetim izi çoğu zaman
-- doğrudur" diye bir şey yoktur.
--
-- Trigger'la iz artık yazmanın KENDİSİYLE aynı transaction'da oluşur: ana
-- yazma geri alınırsa audit kaydı da geri alınır, ana yazma başarılıysa
-- audit kaydı kesinlikle vardır. Ayrıca yeni bir kod yolu (script, başka bir
-- istemci, elle SQL) audit yazmayı ATLAYAMAZ — unutulabilecek bir adım olmaktan
-- çıkar.
--
-- İSTEMCİ ARTIK audit_log'A YAZAMAZ: insert politikası kaldırılıyor. Önceki
-- politika actor_id = auth.uid() şartıyla istemciye yazma izni veriyordu; bu,
-- kimliği doğru ama İÇERİĞİ uydurma bir kaydın (olmayan bir eylem) yazılmasına
-- açıktı. Artık ne yazılacağına şema karar veriyor.

-- security definer: audit_log'a yazabilmek için. Politika kaldırıldığı ve
-- sistem eylemlerinde actor_id null olabileceği için invoker hakları yetmez.
-- Kullanıcı girdisi bu fonksiyonlara doğrudan geçmiyor; yazdıkları yalnızca
-- OLD/NEW satırlarından türetiliyor.
create or replace function public.audit_tenant_controls()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'durum_degisti', 'tenant_controls', new.control_id,
      jsonb_build_object('onceki', old.durum, 'durum', new.durum)
    );
  end if;

  if new.sorumlu_user_id is distinct from old.sorumlu_user_id then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'sorumlu_atandi', 'tenant_controls', new.control_id,
      jsonb_build_object('onceki', old.sorumlu_user_id, 'yeni', new.sorumlu_user_id)
    );
  end if;

  if new.not_metni is distinct from old.not_metni then
    -- Not İÇERİĞİ detaya YAZILMAZ (CLAUDE.md kural 7: loglara PII/kanıt
    -- içeriği yazılmaz) — yalnızca değiştiği bilgisi tutulur.
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'not_guncellendi', 'tenant_controls', new.control_id, null);
  end if;

  return null;
end;
$$;

create trigger tenant_controls_audit_after_update
  after update on public.tenant_controls
  for each row execute function public.audit_tenant_controls();

create or replace function public.audit_evidences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Kanıt içeriği/dosya adı loglanmaz; hash ve tip, kaydın hangi kanıta ait
  -- olduğunu göstermeye yeter (kural 7).
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'kanit_eklendi', 'evidences', new.id,
    jsonb_build_object('controlId', new.control_id, 'tip', new.tip, 'hashSha256', new.hash_sha256)
  );
  return null;
end;
$$;

create trigger evidences_audit_after_insert
  after insert on public.evidences
  for each row execute function public.audit_evidences();

create or replace function public.audit_findings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  degisenler text[] := '{}';
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'bulgu_eklendi', 'findings', new.id,
      jsonb_build_object('kaynak', new.kaynak, 'onem', new.onem)
    );
    return null;
  end if;

  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'bulgu_durumu_degisti', 'findings', new.id,
      jsonb_build_object('onceki', old.durum, 'yeni', new.durum)
    );
  end if;

  -- Serbest metin alanlarının İÇERİĞİ değil, yalnızca hangilerinin değiştiği
  -- kaydedilir (kural 7): aksiyon planı metni bir denetim logunda durmamalı.
  if new.baslik is distinct from old.baslik then degisenler := degisenler || 'baslik'; end if;
  if new.onem is distinct from old.onem then degisenler := degisenler || 'onem'; end if;
  if new.kaynak is distinct from old.kaynak then degisenler := degisenler || 'kaynak'; end if;
  if new.aksiyon_plani is distinct from old.aksiyon_plani then degisenler := degisenler || 'aksiyonPlani'; end if;
  if new.hedef_kapama is distinct from old.hedef_kapama then degisenler := degisenler || 'hedefKapama'; end if;
  if new.yk_onay_tarihi is distinct from old.yk_onay_tarihi then degisenler := degisenler || 'ykOnayTarihi'; end if;

  if array_length(degisenler, 1) > 0 then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'bulgu_durumu_degisti', 'findings', new.id,
      jsonb_build_object('degisenAlanlar', to_jsonb(degisenler))
    );
  end if;

  return null;
end;
$$;

create trigger findings_audit_after_insert
  after insert on public.findings
  for each row execute function public.audit_findings();

create trigger findings_audit_after_update
  after update on public.findings
  for each row execute function public.audit_findings();

create or replace function public.audit_share_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Token detaya YAZILMAZ: logdan okunabilseydi paylaşım linkinin gizliliği
  -- anlamsızlaşırdı (kural 7).
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'paylasim_linki_olusturuldu', 'share_links', new.id,
    jsonb_build_object('frameworkId', new.kapsam ->> 'frameworkId', 'sonGecerlilik', new.son_gecerlilik)
  );
  return null;
end;
$$;

create trigger share_links_audit_after_insert
  after insert on public.share_links
  for each row execute function public.audit_share_links();

-- İstemcinin audit_log'a yazma yolu kapatılıyor. Kayıtları artık yalnızca
-- yukarıdaki trigger'lar üretir; hash zinciri (audit_log_seal) de zaten
-- istemciden gelen hash değerlerini eziyordu.
drop policy if exists audit_log_insert_own_tenant on public.audit_log;
revoke insert on public.audit_log from authenticated, anon;
