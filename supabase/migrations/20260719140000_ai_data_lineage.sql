-- AI eval veri-soyağacı (nihai talimat v3.2 §8.0 sonu, sıradaki öncelik #2;
-- G5 veri modelinde adı geçen AIDataLineage).
--
-- NE İSPATLAR: bir değerlendirme (ai_evaluations — bias/robustluk/doğruluk/...)
-- "PASSED" dediğinde, denetçinin sorabileceği soruyu yanıtlar — "HANGİ veri
-- kümesine/model sürümüne karşı ölçüldü?" Değerlendirme sonucu artık izole bir
-- iddia değil, KAYNAĞI izlenebilir bir iddia.
--
-- VERİ MİNİMİZASYONU (kural 22): ham eğitim/değerlendirme VERİSİ buraya
-- GİRMEZ — yalnız kaynak REFERANSI (ad + dış tanımlayıcı) + opsiyonel sha256
-- hash (tenant'ın kendi veri kümesini içerik-adresli izleyebilmesi için).
--
-- İÇERİK UYDURULMAZ (kural 3): tür/ad/açıklama tenant tarafından girilir;
-- KALKAN_OS bir metodoloji veya veri kümesi İDDİA ETMEZ.

create table public.ai_data_lineage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ai_evaluation_id uuid not null references public.ai_evaluations (id) on delete cascade,
  tur text not null check (tur in ('EGITIM_VERISI', 'DEGERLENDIRME_VERISI', 'MODEL_SURUMU', 'REFERANS_KIYAS')),
  ad text not null,
  kaynak_ref text,
  -- Opsiyonel içerik-adresli hash — ham veri DEĞİL, yalnız bütünlük referansı.
  veri_hash text check (veri_hash is null or veri_hash ~ '^[0-9a-f]{64}$'),
  aciklama text,
  created_at timestamptz not null default now()
);

create index ai_data_lineage_eval_idx on public.ai_data_lineage (ai_evaluation_id);

/** Tutarlılık: soyağacı kaydı, işaret ettiği eval ile AYNI kiracıya ait olmalı. */
create or replace function public.ai_data_lineage_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.ai_evaluations where id = new.ai_evaluation_id;
  if v_tenant is null then
    raise exception 'Degerlendirme (ai_evaluation) bulunamadi';
  end if;
  if v_tenant is distinct from new.tenant_id then
    raise exception 'Soyagaci kaydi, isaret ettigi degerlendirmeyle ayni kiraciya ait olmalidir';
  end if;
  return new;
end;
$$;

create trigger ai_data_lineage_guard_trg
  before insert on public.ai_data_lineage
  for each row execute function public.ai_data_lineage_guard();

create or replace function public.audit_ai_data_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (new.tenant_id, auth.uid(), 'ai_soyagaci_eklendi', 'ai_data_lineage', new.id,
    jsonb_build_object('tur', new.tur, 'ai_evaluation_id', new.ai_evaluation_id));
  return new;
end;
$$;

create trigger audit_ai_data_lineage_insert
  after insert on public.ai_data_lineage
  for each row execute function public.audit_ai_data_lineage();

alter table public.ai_data_lineage enable row level security;

create policy ai_data_lineage_select on public.ai_data_lineage
  for select using (tenant_id = public.current_tenant_id());
create policy ai_data_lineage_write on public.ai_data_lineage
  for all using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
