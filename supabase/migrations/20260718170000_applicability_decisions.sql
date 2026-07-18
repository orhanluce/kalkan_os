-- Uygulanabilirlik kararları (V2 PR-4b adım 3, M22). Zincirin TENANT'A ÖZGÜ
-- halkası: global yükümlülük (obligations) bu KURUMA uygulanır mı?
--
-- DÖRT DURUM (SPK notu §2.2-2.3 + DEVAM §2): APPLICABLE / NOT_APPLICABLE /
-- CONDITIONAL / UNKNOWN. `UNKNOWN != NOT_APPLICABLE` DB İNVARYANTI (kural 13'ün
-- kapsam karşılığı): profil eksikse "değerlendiremedik" (UNKNOWN) denir,
-- "uygulanmaz" DENMEZ. NOT_APPLICABLE bir İDDİADIR ve kanıt ister — gerekçe +
-- insan onayı olmadan yazılamaz (SPK §2.3: "not applicable sonucu kontrol
-- sahibi ve uyum onayı ile kanıtlanmalı").
--
-- KARAR KAYDI DEĞİŞMEZDİR (append-only, kural 2 ruhu): yeniden değerlendirme
-- eski kararı DÜZENLEMEZ — eski satırın superseded_at'i kapatılır, yeni satır
-- açılır. "O gün hangi profille, hangi gerekçeyle ne karar verdik" geçmişi
-- silinemez; denetimde bu zincir gösterilir.
--
-- FACT SNAPSHOT + FINGERPRINT: karar, verildiği andaki profil olgularının
-- kopyasını (fact_snapshot) ve RFC 8785 kanonik hash'ini
-- (factSnapshotFingerprint — adı NEYİ doğruladığını söyler, kural 15) taşır.
-- Profil sonradan değişse de kararın dayandığı olgular sabit kalır; adım 4'ün
-- legal-basis guard'ı "applicability güncel mi"yi bu fingerprint'le anlar.

create table public.applicability_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  obligation_id uuid not null references public.obligations (id) on delete restrict,
  durum text not null
    check (durum in ('APPLICABLE', 'NOT_APPLICABLE', 'CONDITIONAL', 'UNKNOWN')),
  -- Kararın dayandığı kurum-profili olguları (karar anındaki kopya).
  fact_snapshot jsonb not null,
  fact_snapshot_fingerprint text not null check (fact_snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  -- Hangi girdi/kural bu sonucu üretti (SPK §2.3: karar açıklanabilir olmalı).
  gerekce text,
  -- CONDITIONAL için şart metni (guard zorlar).
  kosul text,
  karar_kaynagi text not null default 'manuel' check (karar_kaynagi in ('motor', 'manuel')),
  -- İnsan onayı atfı (NOT_APPLICABLE ve manuel kararlarda guard zorlar).
  onaylayan uuid references public.profiles (id) on delete restrict,
  onay_zamani timestamptz,
  -- null = güncel karar; dolu = yerini yeni karara bıraktı.
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

-- Bir yükümlülük için kiracı başına TEK güncel karar.
create unique index applicability_guncel_uq
  on public.applicability_decisions (tenant_id, obligation_id)
  where superseded_at is null;

create index applicability_tenant_idx
  on public.applicability_decisions (tenant_id, obligation_id);

/**
 * KARAR GUARD'I — DB invariant'ları (route'a bırakılmaz):
 *
 * INSERT:
 *   * NOT_APPLICABLE: gerekce + onaylayan + onay_zamani zorunlu ("uygulanmaz"
 *     iddiası kanıtsız/sahipsiz yazılamaz). UNKNOWN bu şartları İSTEMEZ —
 *     iki durum DB seviyesinde birbirine katlanamaz.
 *   * CONDITIONAL: kosul zorunlu (şartsız "şartlı" olmaz).
 *   * karar_kaynagi='manuel': gerekce + onaylayan zorunlu (SPK §2.3: manuel
 *     kapsam değişikliği gerekçesiz/onaysız yapılamaz).
 *   * Kimlik atfı (M16 #9 deseni): istemci bağlamında (auth.uid() dolu)
 *     onaylayan oturum sahibine eşit olmak zorunda — "B onayladı" iddiası
 *     B'nin oturumundan gelir. Service bağlamı (auth.uid() null) muaf.
 *
 * UPDATE: yalnız superseded_at null→dolu geçişi serbest; DİĞER HER ALAN DONUK
 * (append-only karar zinciri). Kapatılmış karar yeniden açılamaz.
 */
create or replace function public.applicability_karar_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.durum = 'NOT_APPLICABLE'
       and (new.gerekce is null or new.onaylayan is null or new.onay_zamani is null) then
      raise exception 'NOT_APPLICABLE karari gerekce + onaylayan + onay_zamani olmadan yazilamaz (UNKNOWN != NOT_APPLICABLE)';
    end if;
    if new.durum = 'CONDITIONAL' and new.kosul is null then
      raise exception 'CONDITIONAL karari kosul olmadan yazilamaz';
    end if;
    if new.karar_kaynagi = 'manuel' and new.durum is distinct from 'UNKNOWN'
       and (new.gerekce is null or new.onaylayan is null) then
      raise exception 'manuel kapsam karari gerekce ve onay olmadan yazilamaz (SPK 2.3)';
    end if;
    if new.onaylayan is not null and auth.uid() is not null
       and new.onaylayan is distinct from auth.uid() then
      raise exception 'Onay ancak oturum sahibi adina yazilabilir (kimlik atfi)';
    end if;
    return new;
  end if;

  -- UPDATE: append-only — yalnız supersede kapaması.
  if old.superseded_at is not null then
    raise exception 'Kapatilmis uygulanabilirlik karari degistirilemez (append-only)';
  end if;
  if new.id is distinct from old.id
    or new.tenant_id is distinct from old.tenant_id
    or new.obligation_id is distinct from old.obligation_id
    or new.durum is distinct from old.durum
    or new.fact_snapshot is distinct from old.fact_snapshot
    or new.fact_snapshot_fingerprint is distinct from old.fact_snapshot_fingerprint
    or new.gerekce is distinct from old.gerekce
    or new.kosul is distinct from old.kosul
    or new.karar_kaynagi is distinct from old.karar_kaynagi
    or new.onaylayan is distinct from old.onaylayan
    or new.onay_zamani is distinct from old.onay_zamani
    or new.created_at is distinct from old.created_at then
    raise exception 'Uygulanabilirlik karari duzenlenemez: yeniden degerlendirme YENI karar acar (append-only)';
  end if;
  if new.superseded_at is null then
    raise exception 'superseded_at geri alinamaz';
  end if;
  return new;
end;
$$;

create trigger applicability_karar_guard_trg
  before insert or update on public.applicability_decisions
  for each row execute function public.applicability_karar_guard();

/**
 * Denetim izi: karar yazımı + kapama. fact_snapshot/gerekce İÇERİĞİ audit'e
 * yazılmaz (kural 7) — yalnız durum, kaynak ve yükümlülük referansı.
 */
create or replace function public.audit_applicability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      new.tenant_id, auth.uid(), 'uygulanabilirlik_karari_verildi',
      'applicability_decisions', new.id,
      jsonb_build_object(
        'obligation_id', new.obligation_id, 'durum', new.durum,
        'karar_kaynagi', new.karar_kaynagi
      )
    );
    return new;
  end if;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    new.tenant_id, auth.uid(), 'uygulanabilirlik_karari_kapatildi',
    'applicability_decisions', new.id,
    jsonb_build_object('obligation_id', new.obligation_id, 'durum', new.durum)
  );
  return new;
end;
$$;

create trigger audit_applicability_after_insert
  after insert on public.applicability_decisions
  for each row execute function public.audit_applicability();
create trigger audit_applicability_after_update
  after update on public.applicability_decisions
  for each row execute function public.audit_applicability();

-- --- RLS: tenant'a özgü karar — okuma kiracı, yazma admin/uyum ---
alter table public.applicability_decisions enable row level security;

create policy applicability_select on public.applicability_decisions
  for select using (tenant_id = public.current_tenant_id());

create policy applicability_insert on public.applicability_decisions
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  );

-- UPDATE yalnız supersede kapaması için (guard diğer alanları donduruyor).
create policy applicability_update on public.applicability_decisions
  for update using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  );
-- DELETE politikası YOK: karar zinciri silinemez.
