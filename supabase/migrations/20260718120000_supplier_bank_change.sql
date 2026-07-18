-- Tedarikçi banka (IBAN) değişikliği doğrulama kaydı (V2 PR-3a, ADR-V2-4).
--
-- CFO Kalkanı'nın imza kontrolü: tedarikçi IBAN/ana veri değişikliği en yaygın
-- BEC/dolandırıcılık vektörü. KALKAN_OS IBAN'ı DEĞİŞTİRMEZ, ödeme başlatmaz
-- (V2 §5.1) — yalnız değişikliğin OUT-OF-BAND doğrulandığını, kim talep etti/
-- kim bağımsız doğruladı bilgisini KAYIT altına alır.
--
-- VERİ MİNİMİZASYONU (ADR-V2-4, kural 7): TAM IBAN SAKLANMAZ. Yalnız
--   - maskeli gösterim ("TR** **** **** **** **34" — ülke + son 4),
--   - sha256(normalize(iban)) referans hash'i (dedup/eşleştirme için; tam
--     değeri geri vermez).
-- Şemada tam-IBAN kolonu YOK — yanlışlıkla saklanamaz.
--
-- MAKER-CHECKER: doğrulayan ≠ talep eden (kendi talebini doğrulayamaz);
-- SoD istisna/rollback desenindeki kimlik-atfı guard'ı (auth.uid()'e sabit).

create table public.supplier_bank_change_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tedarikci_ad text not null,
  -- Maskeli gösterim: format zorunlu (tam IBAN kaçağını yakalar — 15+ ardışık
  -- rakam varsa reddet). '*' ve son haneler içerir.
  eski_iban_maskeli text check (eski_iban_maskeli is null or eski_iban_maskeli ~ '\*'),
  yeni_iban_maskeli text not null check (yeni_iban_maskeli ~ '\*'),
  -- Referans hash'leri (64-hex). Tam IBAN değil.
  eski_iban_hash text check (eski_iban_hash is null or eski_iban_hash ~ '^[0-9a-f]{64}$'),
  yeni_iban_hash text not null check (yeni_iban_hash ~ '^[0-9a-f]{64}$'),
  out_of_band_kanal text not null,  -- ör. "bilinen yetkiliyle telefon", "yüz yüze"
  talep_eden uuid not null references public.profiles (id) on delete set null,
  dogrulayan uuid references public.profiles (id) on delete set null,
  durum text not null default 'TALEP_EDILDI'
    check (durum in ('TALEP_EDILDI', 'DOGRULANDI', 'REDDEDILDI')),
  dogrulama_notu text,
  -- İsteğe bağlı kanıt bağı (out-of-band görüşme kaydı vb.).
  kanit_id uuid references public.evidences (id) on delete set null,
  dogrulandi_at timestamptz,
  created_at timestamptz not null default now()
);

create index supplier_bank_change_tenant_idx
  on public.supplier_bank_change_verifications (tenant_id, created_at desc);

alter table public.supplier_bank_change_verifications enable row level security;

create policy supplier_bank_change_select on public.supplier_bank_change_verifications
  for select using (tenant_id = public.current_tenant_id());

-- Talep, oturum sahibi adına açılır (talep_eden = auth.uid()) — maker kimliği
-- sabitlenir. Rol: admin/uyum (finans onay yetkisi).
create policy supplier_bank_change_insert on public.supplier_bank_change_verifications
  for insert with check (
    tenant_id = public.current_tenant_id()
    and talep_eden = auth.uid()
    and public.current_user_role() in ('admin', 'uyum')
  );

-- Karar (DOGRULANDI/REDDEDILDI) istemciden yazılamaz: yalnız service_role
-- (karar rotası). Maker-checker guard aşağıda service_role'ü de bağlar.
revoke update, delete on public.supplier_bank_change_verifications from authenticated, anon;

/**
 * MAKER-CHECKER + KİMLİK ATFI GUARD'ı: doğrulayan ≠ talep eden; karar verilmiş
 * kayıt değişmez; kimlik alanları donuk. auth.uid() dolu (istemci) bağlamda
 * dogrulayan oturum sahibine sabit. (SoD rollback guard'ıyla aynı disiplin.)
 */
create or replace function public.supplier_bank_change_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.durum <> 'TALEP_EDILDI' then
    raise exception 'Karara baglanmis kayit degistirilemez (%)', old.durum;
  end if;
  if new.talep_eden is distinct from old.talep_eden
     or new.tenant_id is distinct from old.tenant_id
     or new.yeni_iban_hash is distinct from old.yeni_iban_hash then
    raise exception 'Talep kimlik/IBAN alanlari degistirilemez';
  end if;
  if new.durum in ('DOGRULANDI', 'REDDEDILDI') then
    if new.dogrulayan is null then
      raise exception 'Karar dogrulayan olmadan verilemez';
    end if;
    if new.dogrulayan = new.talep_eden then
      raise exception 'Talep eden kendi IBAN degisikligini dogrulayamaz (maker-checker)';
    end if;
    if auth.uid() is not null and new.dogrulayan is distinct from auth.uid() then
      raise exception 'Dogrulama ancak oturum sahibi adina yazilabilir (kimlik atfi)';
    end if;
  end if;
  return new;
end;
$$;

create trigger supplier_bank_change_guard_before_update
  before update on public.supplier_bank_change_verifications
  for each row execute function public.supplier_bank_change_guard();

/**
 * Denetim izi. IBAN/hash İÇERİĞİ audit'e yazılmaz (kural 7) — yalnız kim/
 * hangi tedarikçi/durum. tedarikci_ad kişisel veri değil (kurumsal ad).
 */
create or replace function public.audit_supplier_bank_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, new.talep_eden, 'iban_degisiklik_talep_edildi',
      'supplier_bank_change_verifications', new.id,
      jsonb_build_object('tedarikci', new.tedarikci_ad));
    return new;
  end if;
  if new.durum is distinct from old.durum then
    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (new.tenant_id, new.dogrulayan, 'iban_degisiklik_karari',
      'supplier_bank_change_verifications', new.id,
      jsonb_build_object('tedarikci', new.tedarikci_ad, 'durum', new.durum));
  end if;
  return new;
end;
$$;

create trigger audit_supplier_bank_change_after_insert
  after insert on public.supplier_bank_change_verifications
  for each row execute function public.audit_supplier_bank_change();
create trigger audit_supplier_bank_change_after_update
  after update on public.supplier_bank_change_verifications
  for each row execute function public.audit_supplier_bank_change();
