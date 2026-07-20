-- 37 Tez Dikey B, Faz 2 kalan dilimi (20 Temmuz 2026, docs/adr/PR0-37-tez-
-- dikeyB-faz2-kalan-2026-07-20.md): kurum kimliği + tedarikçi/sözleşme RoI
-- alanları + alt yüklenici zinciri + kritik-fonksiyon eşlemesi.
--
-- YENİ TABLO AİLESİ YOK — third_parties/third_party_contracts/fourth_parties/
-- tenant_legal_identity zaten var (20260719000000, 20260719310000),
-- GENİŞLETİLİYOR. Yalnız BİR yeni tablo: açıkça istenen mapping tablosu
-- (third_party_contract_critical_services) — third_parties.tier ile DORA
-- fonksiyon-kritikliğini ASLA birleştirmemek için (ADR §4).
--
-- DÖRT-GÖZ YOK (ADR §5, dürüst gerekçe): eklenen hiçbir alan yeni bir
-- regülasyon iddiası taşımıyor — tenant'ın kendi operasyonel verisi
-- (third_parties.ulke gibi) ya da ZATEN dört-göz korumalı ict_service_types
-- kataloğuna FK. Dolayısıyla 20260720110000'in düzelttiği INSERT-bypass
-- sınıfı hatanın burada tekrarlanma riski yapısal olarak yok.

-- =====================================================================
-- 1) tenant_legal_identity genişlemesi
-- =====================================================================
alter table public.tenant_legal_identity
  -- "Ulusal kurum kimliği" (EUID'nin AB-dışı muadili, TR ticaret sicili).
  -- SOURCE_PENDING — format uydurulmuyor, serbest metin.
  add column ticaret_sicil_no text,
  -- B_01.01 "Entity maintaining the register": NULL = tenant kendi kaydını
  -- kendi tutuyor (yaygın durum). Dolu ise kayıt BAŞKA bir kuruluş (örn.
  -- grup ana ortaklığı) tarafından konsolide tutuluyor.
  add column kayit_tutan_kurulus_lei text check (kayit_tutan_kurulus_lei is null or kayit_tutan_kurulus_lei ~ '^[A-Z0-9]{20}$'),
  add column kayit_tutan_kurulus_adi text;

comment on column public.tenant_legal_identity.hiyerarsi_seviyesi is
  'B_01.02.0050 "Hierarchy of the financial entity within the group" (≈konsolidasyon seviyesi) — kapalı kümenin 5 seçeneği artık birebir biliniyor (Faz 1, docs/arastirma/DORA_RoI_ITS_2024_2956_Kaynak_Ozeti.md §3b) ama CHECK constraint YAPILMADI (kural 3: henüz VERIFIED değil).';

-- =====================================================================
-- 2) third_party_contracts genişlemesi (B_02.02'nin çekirdek alt kümesi)
-- =====================================================================
alter table public.third_party_contracts
  -- B_02.02.0030/0040: ICT hizmet sağlayıcısının kimlik kodu + kod türü.
  add column tedarikci_kimlik_kodu text,
  add column tedarikci_kimlik_kodu_turu text,
  -- B_02.02.0060: Annex III hizmet türü — Faz 2 ilk dilimin kataloğuna GERÇEK bağ.
  add column ict_hizmet_turu_kod text references public.ict_service_types (kod) on delete set null,
  -- B_02.02.0140/0150/0160: veri lokasyonu.
  add column veri_saklaniyor_mu boolean,
  add column veri_saklama_ulkesi text check (veri_saklama_ulkesi is null or veri_saklama_ulkesi ~ '^[A-Z]{2}$'),
  add column veri_isleme_ulkesi text check (veri_isleme_ulkesi is null or veri_isleme_ulkesi ~ '^[A-Z]{2}$'),
  -- B_02.02.0090: sona erme nedeni (6 seçenek birebir biliniyor, Faz 1 §3b —
  -- CHECK constraint YAPILMADI, aynı kural 3 ilkesi).
  add column sona_erme_nedeni text,
  -- B_02.02.0100/0110: bildirim süreleri (gün).
  add column bildirim_suresi_kurum_gun integer check (bildirim_suresi_kurum_gun is null or bildirim_suresi_kurum_gun >= 0),
  add column bildirim_suresi_saglayici_gun integer check (bildirim_suresi_saglayici_gun is null or bildirim_suresi_saglayici_gun >= 0);

-- =====================================================================
-- 3) fourth_parties genişlemesi (B_05.02 tedarik zinciri)
-- =====================================================================
alter table public.fourth_parties
  -- Alt yüklenicinin HANGİ sözleşmeye bağlı olduğu (B_05.02.0010).
  add column third_party_contract_id uuid references public.third_party_contracts (id) on delete set null,
  -- B_05.02.0050: doğrudan sağlayıcı=1 (third_party'nin kendisi, örtük),
  -- alt yüklenici=2+.
  add column sira integer check (sira is null or sira >= 2),
  -- B_05.02.0020: alt yüklenicinin sağladığı hizmet türü.
  add column ict_hizmet_turu_kod text references public.ict_service_types (kod) on delete set null;

create index fourth_parties_contract_idx on public.fourth_parties (third_party_contract_id) where third_party_contract_id is not null;

-- =====================================================================
-- 4) Açık mapping tablosu: sözleşme ↔ kritik/önemli fonksiyon
--    (third_parties.tier ile ASLA birleştirilmez — ADR §4)
-- =====================================================================
create table public.third_party_contract_critical_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_contract_id uuid not null references public.third_party_contracts (id) on delete cascade,
  critical_service_id uuid not null references public.critical_business_services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (third_party_contract_id, critical_service_id)
);

comment on table public.third_party_contract_critical_services is
  'DORA RoI B_02.02.0050 (Function identifier) türünden sözleşme↔kritik-fonksiyon eşlemesi. third_parties.tier ile OTOMATİK BİRLEŞTİRİLMEZ (ADR §4) — ayrı, açık bir mapping tablosu.';

create index tpccs_contract_idx on public.third_party_contract_critical_services (third_party_contract_id);
create index tpccs_service_idx on public.third_party_contract_critical_services (critical_service_id);

alter table public.third_party_contract_critical_services enable row level security;

create policy tpccs_select on public.third_party_contract_critical_services
  for select using (tenant_id = public.current_tenant_id());
create policy tpccs_write on public.third_party_contract_critical_services
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));

-- --- Audit: eşleme oluşturma/silme (tenant-scoped) ---
create or replace function public.audit_tpccs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, auth.uid(), 'sozlesme_kritik_fonksiyon_eslendi', 'third_party_contract_critical_services', new.id,
      jsonb_build_object('third_party_contract_id', new.third_party_contract_id, 'critical_service_id', new.critical_service_id));
    return new;
  end if;
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (old.tenant_id, auth.uid(), 'sozlesme_kritik_fonksiyon_esleme_kaldirildi', 'third_party_contract_critical_services', old.id,
    jsonb_build_object('third_party_contract_id', old.third_party_contract_id, 'critical_service_id', old.critical_service_id));
  return old;
end;
$$;

create trigger audit_tpccs_insert after insert on public.third_party_contract_critical_services
  for each row execute function public.audit_tpccs();
create trigger audit_tpccs_delete after delete on public.third_party_contract_critical_services
  for each row execute function public.audit_tpccs();
