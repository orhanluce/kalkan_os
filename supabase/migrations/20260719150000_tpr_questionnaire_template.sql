-- M35 sonraki dilim — Doğrulanmış anket şablonu (ThirdPartyQuestionnaire, G4
-- veri modeli; nihai talimat v3.2 §8.0 sonu öncelik #3).
--
-- NE EKLER: mevcut `assessment_questions` (bir DEĞERLENDİRMEYE bağlı, tek
-- kullanımlık sorular) üstüne, tenant'ın KENDİ doğruladığı bir soru BANKASI
-- (şablon). Aynı soru seti her yeni tedarikçi değerlendirmesinde YENİDEN
-- YAZILMAZ — şablondan tek eylemle kopyalanır. Tutarlılık: her vendor'a AYNI
-- standart sorular sorulur (denetlenebilir, karşılaştırılabilir).
--
-- İÇERİK UYDURULMAZ (kural 3/12 ruhu): bu bir "resmî DORA anketi" DEĞİLDİR —
-- kurumun kendi uyum ekibinin yazdığı/onayladığı iç due-diligence sorularıdır.
-- KALKAN_OS hiçbir soru METNİ seed etmez; şablon tamamen tenant girdisidir.
--
-- KOPYALAMA MEKANİĞİ BASİT TUTULDU: yeni bir RPC/guard gerekmez — şablon
-- satırları `assessment_questions`'a düz bir INSERT ile kopyalanır (mevcut
-- RLS zaten admin/uyum yazmasını sınırlıyor). Şablonun kendisi DEĞİŞMEZ
-- (kopyalanan soru artık değerlendirmenin kendi kaydı, şablona bağlı değil —
-- şablon sonradan düzenlenirse geçmiş değerlendirmeler ETKİLENMEZ).

create table public.assessment_question_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tur text not null default 'OPERASYONEL'
    check (tur in ('GUVENLIK', 'GIZLILIK', 'FINANSAL', 'OPERASYONEL', 'DORA')),
  soru text not null,
  sira integer not null default 0,
  -- Aktif değilse yeni kopyalamalarda ÖNERİLMEZ ama geçmiş kullanım silinmez
  -- (kural 2 ruhu: sessiz veri kaybı yok — soft-disable).
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create index assessment_question_templates_idx
  on public.assessment_question_templates (tenant_id, tur, sira);

alter table public.assessment_question_templates enable row level security;

create policy assessment_question_templates_select on public.assessment_question_templates
  for select using (tenant_id = public.current_tenant_id());
create policy assessment_question_templates_write on public.assessment_question_templates
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

create or replace function public.audit_assessment_question_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'anket_sablonu_olusturuldu', 'assessment_question_templates', new.id,
    jsonb_build_object('tur', new.tur));
  return new;
end;
$$;

create trigger audit_assessment_question_template_insert
  after insert on public.assessment_question_templates
  for each row execute function public.audit_assessment_question_template();
