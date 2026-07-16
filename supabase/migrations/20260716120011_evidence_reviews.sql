-- Kanıt inceleme ve dört-göz onayı (docs/ROADMAP.md M5.5).
--
-- NEDEN AYRI TABLO: evidences append-only (kural 2), dolayısıyla kanıta
-- "kabul edildi" diye bir durum YAZAMAYIZ. Durum, bu tablodaki son karardan
-- TÜRETİLİR (public.evidence_durumu). Böylece hem append-only korunur hem de
-- kararın kim tarafından, ne zaman, hangi gerekçeyle verildiği kaybolmaz —
-- bir durum sütunu olsaydı, üzerine yazılan her karar geçmişi silerdi.
--
-- DÖRT-GÖZ: yükleyen kendi kanıtını onaylayamaz. Kural trigger'da, RLS'te
-- değil: RLS yalnızca authenticated/anon'a uygulanır, trigger ise service_role
-- dahil HER yola uygular. Bir uyum ürününde görevler ayrılığının, uygulamanın
-- hangi rolle bağlandığına bağlı olmaması gerekir.

create table public.evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  -- Sıra için identity: aynı transaction içindeki tüm now() çağrıları aynı
  -- değeri döndürür, o durumda "son karar" belirsiz kalırdı.
  seq bigint generated always as identity,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  evidence_id uuid not null references public.evidences (id) on delete cascade,
  -- on delete restrict: kararı veren profil silinemez. set null olsaydı
  -- "bu kanıtı kim onayladı" sorusunun cevabı kaybolurdu ve dört-göz
  -- kaydı denetlenemez hale gelirdi.
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  karar text not null check (karar in ('kabul', 'ret')),
  gerekce text,
  created_at timestamptz not null default now()
);

create index evidence_reviews_tenant_id_idx on public.evidence_reviews (tenant_id);
create index evidence_reviews_evidence_id_idx on public.evidence_reviews (evidence_id, seq desc);

create or replace function public.evidence_review_guard()
returns trigger
language plpgsql
-- security definer: kanıtın yükleyenini okumak şart. Çağıranın RLS
-- görünürlüğüne bırakılsaydı, kanıtı göremeyen bir çağıran için
-- v_yukleyen null döner ve dört-göz kontrolü sessizce atlanırdı —
-- 20260716120003'teki tenant_has_profiles ile aynı tuzak.
security definer
set search_path = public
as $$
declare
  v_yukleyen uuid;
  v_tenant uuid;
begin
  select yukleyen, tenant_id into v_yukleyen, v_tenant
  from public.evidences
  where id = new.evidence_id;

  if v_tenant is null then
    raise exception 'Kanit bulunamadi';
  end if;

  -- Kanıt ile inceleme aynı kiracıya ait olmalı. Aksi halde bir kiracı,
  -- başka bir kiracının kanıtına kendi tenant_id'siyle inceleme yazarak
  -- RLS'i delip varlığını doğrulayabilirdi.
  if new.tenant_id is distinct from v_tenant then
    raise exception 'Kanit baska bir kiraciya ait';
  end if;

  if v_yukleyen is not null and new.reviewer_id = v_yukleyen then
    raise exception 'Dort-goz kurali: kullanici kendi yukledigi kaniti onaylayamaz';
  end if;

  return new;
end;
$$;

create trigger evidence_review_guard_before_insert
  before insert on public.evidence_reviews
  for each row execute function public.evidence_review_guard();

alter table public.evidence_reviews enable row level security;

create policy evidence_reviews_select_own_tenant on public.evidence_reviews
  for select
  using (tenant_id = public.current_tenant_id());

-- reviewer_id = auth.uid(): kullanıcı başkası adına karar yazamaz. Bu olmadan
-- dört-göz kuralı anlamsız olurdu — yükleyen, bir meslektaşının kimliğiyle
-- kendi kanıtını onaylayabilirdi.
create policy evidence_reviews_insert_own_tenant on public.evidence_reviews
  for insert
  with check (
    tenant_id = public.current_tenant_id()
    and reviewer_id = auth.uid()
  );

-- Append-only: verilmiş bir karar geri alınmaz, yenisi yazılır (son karar
-- geçerlidir). Kararın değiştirilebilmesi, denetçiye sunulan geçmişin
-- güvenilirliğini ortadan kaldırırdı.
revoke update, delete on public.evidence_reviews from authenticated, anon;

/**
 * Bir kanıtın türetilmiş durumu: son karar, yoksa 'incelemede'.
 *
 * Bilinen sınır: evidences.yukleyen "on delete set null" olduğu için,
 * yükleyenin profili silinirse o kanıtta dört-göz kuralı artık
 * uygulanamaz (kim yüklediği bilinmediğinden kimin onaylayamayacağı da
 * bilinemez). Profil silme akışı eklendiğinde bu yeniden ele alınmalı —
 * bkz. rls-dort-goz.test.ts'teki aynı adlı test.
 */
create or replace function public.evidence_durumu(target_evidence_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select karar
      from public.evidence_reviews
      where evidence_id = target_evidence_id
      order by seq desc
      limit 1
    ),
    'incelemede'
  )
$$;
