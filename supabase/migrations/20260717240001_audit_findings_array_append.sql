-- audit_findings: `text[] || 'literal'` yerine array_append (docs/ROADMAP.md M12).
--
-- NEDEN: 20260717090000'deki fonksiyon değişen alanları `degisenler ||
-- 'aksiyonPlani'` ile topluyordu. Gerçek Postgres bunu eleman-ekleme olarak
-- çözer (canlıda sorunsuz çalıştı). Ama PGlite (test harness) `||`'i array-array
-- olarak çözüp sağdaki metni array literal sanıyor ve "malformed array literal"
-- ile patlıyor — findings güncellemelerini testte imkânsız kılıyordu.
--
-- array_append(anyarray, anyelement) her iki motorda da TEK anlamlıdır ve
-- davranış CANLIDA birebir aynıdır. Bu, kural 14'ün verified closure guard'ının
-- PGlite'ta test edilebilmesi için gerekli (findings güncellemesi artık test
-- ortamında da koşuyor).
--
-- create or replace: yalnız fonksiyon gövdesi değişir, trigger'lar aynı kalır.

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
  if new.baslik is distinct from old.baslik then degisenler := array_append(degisenler, 'baslik'); end if;
  if new.onem is distinct from old.onem then degisenler := array_append(degisenler, 'onem'); end if;
  if new.kaynak is distinct from old.kaynak then degisenler := array_append(degisenler, 'kaynak'); end if;
  if new.aksiyon_plani is distinct from old.aksiyon_plani then degisenler := array_append(degisenler, 'aksiyonPlani'); end if;
  if new.hedef_kapama is distinct from old.hedef_kapama then degisenler := array_append(degisenler, 'hedefKapama'); end if;
  if new.yk_onay_tarihi is distinct from old.yk_onay_tarihi then degisenler := array_append(degisenler, 'ykOnayTarihi'); end if;

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
