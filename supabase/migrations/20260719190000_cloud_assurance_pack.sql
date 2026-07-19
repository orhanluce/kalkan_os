-- M35 Cloud & Critical Third-Party Assurance Pack (nihai talimat v3.3 §8.0
-- Dikey 3). Mevcut assessment_question_templates motorunu (§1.40) ZENGİNLEŞTİRİR
-- — ilk satılabilir bulut paketi.
--
-- ONBİR BULUT ALANI (kategori): bulut envanteri, shared-responsibility, SLA/
-- güvenlik, dördüncü-taraf zinciri, veri lokasyonu/transfer, IAM/PAM+merkezi
-- log, olay bildirim süresi, yedekleme/kurtarma/dayanıklılık testi, güvenli
-- imha/sona-erme, çıkış/ikame planı, DDoS/kapasite testi.
--
-- İÇERİK UYDURULMAZ (kural 3): KALKAN_OS hiçbir soru METNİ veya "resmî" DORA/
-- standart iddiası seed ETMEZ — soru + kaynak künyesi tamamen tenant girdisi.
-- DOĞRULAMA DİSİPLİNİ (kural 6, obligations VERIFIED deseni): bir pak maddesi
-- TODO_DOGRULA DOĞAR; VERIFIED'a ancak İNSAN doğrulayıcı (dogrulayan) + zaman
-- ile geçer — AI/otomasyon doğrulanmış SAYAMAZ (guard, service_role dahil).

alter table public.assessment_question_templates
  add column kategori text check (kategori is null or kategori in (
    'BULUT_ENVANTERI', 'SHARED_RESPONSIBILITY', 'SLA_GUVENLIK', 'DORDUNCU_TARAF',
    'VERI_LOKASYON', 'IAM_LOG', 'OLAY_BILDIRIM', 'YEDEKLEME_KURTARMA',
    'VERI_IMHA', 'CIKIS_PLANI', 'DDOS_KAPASITE'
  )),
  add column kaynak_citation text,
  add column kaynak_surumu text,
  add column dogrulama_durumu text not null default 'TODO_DOGRULA'
    check (dogrulama_durumu in ('TODO_DOGRULA', 'VERIFIED', 'YURURLUKTEN_KALKTI')),
  add column dogrulayan uuid references public.profiles (id) on delete restrict,
  add column dogrulama_zamani timestamptz;

-- Kopyalanan değerlendirme sorusu da kaynak künyesini + uygulanabilirliğini
-- taşır. UNKNOWN != NOT_APPLICABLE (kural 7): sessiz "uygulanabilir değil" yok.
alter table public.assessment_questions
  add column kaynak_citation text,
  add column uygulanabilirlik text not null default 'UNKNOWN'
    check (uygulanabilirlik in ('APPLICABLE', 'NOT_APPLICABLE', 'UNKNOWN'));

/**
 * DOĞRULAMA GUARD'I (kural 6): VERIFIED'a geçiş ancak dogrulayan + zaman ile
 * (obligations dogrulama guard'ının aynısı). İçerik VERIFIED doğamaz; AI/
 * service bunu atlayamaz (security definer'da auth.uid null iken de zorlanır —
 * dogrulayan zaten NOT NULL şartıyla dolu olmalı). Kimlik atfı: istemci
 * bağlamında dogrulayan = oturum sahibi.
 */
create or replace function public.cloud_pack_dogrulama_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and new.dogrulama_durumu = 'VERIFIED' then
    raise exception 'Pak maddesi VERIFIED DOGAMAZ (once TODO_DOGRULA, sonra insan dogrular)';
  end if;
  if new.dogrulama_durumu = 'VERIFIED' then
    if new.dogrulayan is null or new.dogrulama_zamani is null then
      raise exception 'VERIFIED gecisi dogrulayan + zaman ister (icerik otomatik dogrulanamaz, kural 6)';
    end if;
    if auth.uid() is not null and new.dogrulayan is distinct from auth.uid() then
      raise exception 'Dogrulama ancak oturum sahibi adina yapilabilir (kimlik atfi)';
    end if;
  end if;
  return new;
end;
$$;

create trigger cloud_pack_dogrulama_guard_trg
  before insert or update on public.assessment_question_templates
  for each row execute function public.cloud_pack_dogrulama_guard();

create or replace function public.audit_cloud_pack_dogrulama()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dogrulama_durumu is distinct from old.dogrulama_durumu then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'bulut_pak_dogrulama_degisti', 'assessment_question_templates', new.id,
      jsonb_build_object('durum_onceki', old.dogrulama_durumu, 'durum', new.dogrulama_durumu, 'kategori', new.kategori));
  end if;
  return new;
end;
$$;

create trigger audit_cloud_pack_dogrulama_update
  after update on public.assessment_question_templates
  for each row execute function public.audit_cloud_pack_dogrulama();
