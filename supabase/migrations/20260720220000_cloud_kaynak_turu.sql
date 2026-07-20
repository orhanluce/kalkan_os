-- Dikey E, E1 (20 Temmuz 2026, docs/adr/PR0-dikeyE1-cloud-tedarikci-guvence-
-- 2026-07-20.md §5): Cloud Pack sorularına/şablonlarına epistemik kaynak
-- türü. Kurucu kararı: default 'UNKNOWN', 8 değerli kapalı küme, hiçbir
-- otomasyon/seed LEGAL_REQUIREMENT/CONTRACTUAL_REQUIREMENT YAZAMAZ.
--
-- kaynak_turu (dogrulama_durumu'ndan BAĞIMSIZ bir boyut): "bu bilgi NEREDEN
-- geliyor" sorusuna cevap verir — dogrulama_durumu "doğrulandı mı" sorusuna.
-- Bir madde hem VERIFIED hem PROVIDER_ATTESTATION olabilir (tedarikçinin
-- kendi beyanının VAR OLDUĞU doğrulandı, beyanın DOĞRULUĞU değil).
--
-- template_id (ADR §1, bilinçli TEK ek kapsam genişlemesi): assessment_
-- questions'ın assessment_question_templates'e HİÇBİR bağı yoktu (düz
-- kopyalama) — "doğrulama durumu/doğrulayan/doğrulama zamanı"nı soru
-- bazında göstermek bu bağ olmadan UYDURMA ya da İMKANSIZ olurdu. CANLI
-- sorgulanır (kopyalama anında dondurulmaz) — yalnız mühürlenmiş snapshot
-- kendi anını dondurur (roi_export_runs/assurance_claims'in AYNI ilkesi).

alter table public.assessment_question_templates
  add column kaynak_turu text not null default 'UNKNOWN' check (kaynak_turu in (
    'LEGAL_REQUIREMENT', 'REGULATORY_GUIDANCE', 'CONTRACTUAL_REQUIREMENT',
    'INTERNAL_POLICY', 'PROVIDER_ATTESTATION', 'TECHNICAL_OBSERVATION',
    'BEST_PRACTICE', 'UNKNOWN'
  ));

alter table public.assessment_questions
  add column kaynak_turu text not null default 'UNKNOWN' check (kaynak_turu in (
    'LEGAL_REQUIREMENT', 'REGULATORY_GUIDANCE', 'CONTRACTUAL_REQUIREMENT',
    'INTERNAL_POLICY', 'PROVIDER_ATTESTATION', 'TECHNICAL_OBSERVATION',
    'BEST_PRACTICE', 'UNKNOWN'
  )),
  add column template_id uuid references public.assessment_question_templates (id) on delete set null;

create index assessment_questions_template_idx on public.assessment_questions (template_id) where template_id is not null;

-- --- Audit: kaynak_turu değişimi (kurucu kararı: her değişim izlenir) ---
create or replace function public.audit_kaynak_turu_degisimi()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kaynak_turu is distinct from old.kaynak_turu then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'kaynak_turu_degisti', TG_TABLE_NAME, new.id,
      jsonb_build_object('onceki', old.kaynak_turu, 'yeni', new.kaynak_turu));
  end if;
  return new;
end;
$$;

create trigger audit_kaynak_turu_degisimi_templates
  after update on public.assessment_question_templates
  for each row execute function public.audit_kaynak_turu_degisimi();
create trigger audit_kaynak_turu_degisimi_questions
  after update on public.assessment_questions
  for each row execute function public.audit_kaynak_turu_degisimi();
