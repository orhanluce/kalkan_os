-- SoD kimlik atfı guard'ları (docs/ROADMAP.md M16 #9 güvenlik testleri).
--
-- BULUNAN AÇIKLAR (rls-guvenlik-sod.test.ts bu migration'suz KIRMIZI —
-- "dolaylı özdeşlikle kendi istisnasını onaylama", kurucunun tam öngörüsü):
--   (1) İstisna BAŞKASI adına talep edilebiliyordu (talep_eden_id serbest):
--       A, talebi B adına açıp kendisi "farklı kişi" olarak onaylayarak
--       maker-checker'ı TERSİNDEN atlatabilirdi.
--   (2) Onay atfı sahtelenebiliyordu: A kendi istisnasını "B onayladı"
--       (onaylayan_id=B) diyerek 'onaylandi'ye taşıyabilirdi — çatışma
--       guard'ı da bu sahte onaya güvenip EXCEPTION_APPROVED'a geçerdi.
--   (3) Bağımsız kapanış atfı sahtelenebiliyordu (resolved_by=B).
--
-- DÜZELTME İLKESİ: kimlik atfı alanları OTURUM SAHİBİNE sabitlenir —
-- auth.uid() doluysa (istemci bağlamı) atıf alanı ona eşit OLMAK ZORUNDA.
-- auth.uid() NULL olan service/cron bağlamı etkilenmez: süre-dolumu işi
-- 'suresi_doldu' yazar ('onaylandi' değil), rotalar zaten gerçek kullanıcı
-- kimliğiyle yazıyor — meşru hiçbir yol bu guard'a takılmaz.

create or replace function public.sod_istisna_onay_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (1) Talep, oturum sahibi adına açılır — başkası adına talep sahtelenemez.
  if TG_OP = 'INSERT' and auth.uid() is not null
     and new.talep_eden_id is distinct from auth.uid() then
    raise exception 'Istisna talebi ancak oturum sahibi adina acilabilir (kimlik atfi)';
  end if;

  if new.durum = 'onaylandi' and new.onaylayan_id is not null
     and new.onaylayan_id = new.talep_eden_id then
    raise exception 'Talep eden kendi istisnasini onaylayamaz';
  end if;
  if new.durum = 'onaylandi' and new.onaylayan_id is null then
    raise exception 'Onaylanan istisnada onaylayan_id zorunlu';
  end if;
  -- (2) Onay atfı oturum sahibine sabit — "B onayladı" iddiası B'nin
  -- oturumundan gelmek zorunda.
  if new.durum = 'onaylandi' and auth.uid() is not null
     and new.onaylayan_id is distinct from auth.uid() then
    raise exception 'Onay ancak oturum sahibi adina yazilabilir (kimlik atfi)';
  end if;
  return new;
end;
$$;

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
    -- (3) Kapanış atfı oturum sahibine sabit (M16 #9): "B kapattı" iddiası
    -- B'nin oturumundan gelmek zorunda. Service bağlamı (auth.uid null) muaf.
    if auth.uid() is not null and new.resolved_by is distinct from auth.uid() then
      raise exception 'Kapanis ancak oturum sahibi adina yazilabilir (kimlik atfi)';
    end if;
    if old.durum not in ('MITIGATED', 'EXCEPTION_APPROVED') then
      raise exception 'RESOLVED: yalnizca MITIGATED veya EXCEPTION_APPROVED durumundan ulasilir (once mitigasyon veya istisna onayi gerekir)';
    end if;
  end if;

  return new;
end;
$$;
