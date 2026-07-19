-- M17 Audit Workspace — "sonraki dilim" borcunun üçüncü maddesi (20260719050000
-- notu: "formal independence_declarations bağı (G7 tablosu)"). §1.29'un
-- talimatı AÇIK: yeni tablo değil, MEVCUT G7 tablosu (independence_declarations,
-- 20260719030000) genelleştirilir.
--
-- ÖNCESİ: independence_declarations yalnız regulatory_matters'a bağlıydı
-- (matter_id not null) — dış uzmanın regülatör meselesi için bağımsızlık
-- beyanı. SONRASI: AYNI tablo audit_engagements'e de bağlanabilir (denetim
-- ekibinin bu denetim işi için bağımsızlık/çıkar-çatışması beyanı) — tablo
-- alanları (external_email/beyan_eden_ad/cikar_catismasi_yok) her iki bağlam
-- için de anlamlı, o yüzden ikinci bir tablo AÇILMADI.
--
-- İNVARYANT: bir beyan TAM OLARAK bir bağlama aittir (matter YA DA engagement,
-- ikisi birden ya da hiçbiri değil) — check constraint.
--
-- ROLLBACK NOTU: `matter_id` NOT NULL'a geri dönmeden önce engagement_id dolu
-- satırlar silinmeli (ya da matter_id'siz kayıt kuralı ihlal olur).

alter table public.independence_declarations
  alter column matter_id drop not null,
  add column engagement_id uuid references public.audit_engagements (id) on delete cascade,
  add constraint independence_declarations_baglam check (
    (matter_id is not null and engagement_id is null) or (matter_id is null and engagement_id is not null)
  );

create index independence_declarations_engagement_idx on public.independence_declarations (engagement_id, external_email);
