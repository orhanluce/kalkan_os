-- Proof Room (G1 kapanış dilimi; nihai talimat §8 G1 + §12 güvenlik testleri).
--
-- NE İŞE YARAR: bir kontrol testi KOŞUSUNUN kanıt zinciri (koşu sonucu +
-- mühürlü dayanak fotoğrafı + kaynak zinciri + applicability + kanıt hash'i)
-- denetçi/regülatöre SÜRELİ, SALT-OKUR, OTURUMSUZ bir linkle açılır.
-- paylasim_goruntule deseninin birebir devamı: security-definer RPC tek
-- kapıdır; token doğrulanmadan hiçbir satır dönmez; geçersiz/dolmuş/iptal
-- token AYNI yanıtı (null) verir; her görüntüleme audit'e düşer.
--
-- VERİ MİNİMİZASYONU: kanıt DOSYASI dönmez (yalnız id + dosya hash'i);
-- hüküm metninin yalnız ilk 240 karakteri (snippet) döner; kullanıcı
-- kimlikleri dönmez. Nihai §4.18: erişim tenant + koşu (scope) + süreyle
-- sınırlı; iptal edilebilir.

create table public.proof_room_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Kapsam TEK koşudur (dar scope) — koşu silinirse link de anlamsızdır.
  test_run_id uuid not null references public.test_runs (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  olusturan uuid references public.profiles (id) on delete set null,
  son_gecerlilik timestamptz not null,
  iptal_edildi boolean not null default false,
  created_at timestamptz not null default now()
);

create index proof_room_links_tenant_idx on public.proof_room_links (tenant_id);
create index proof_room_links_token_idx on public.proof_room_links (token);

alter table public.proof_room_links enable row level security;

-- Yönetim: kendi kiracısında admin/uyum (nihai §4.18 — dış erişim yetkili
-- eliyle açılır; denetci_misafir link üretemez).
create policy proof_room_links_select on public.proof_room_links
  for select using (tenant_id = public.current_tenant_id());
create policy proof_room_links_insert on public.proof_room_links
  for insert with check (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  );
create policy proof_room_links_update on public.proof_room_links
  for update using (
    tenant_id = public.current_tenant_id()
    and public.current_user_role() in ('admin', 'uyum')
  )
  with check (tenant_id = public.current_tenant_id());
-- DELETE yok: iptal = iptal_edildi (iz kalır).

/**
 * Oturumsuz Proof Room görünümü. paylasim_goruntule ile aynı disiplin:
 * geçersiz, süresi dolmuş ve iptal edilmiş token AYNI null yanıtını verir
 * (ayırt etmek saldırgana bilgi sızdırır).
 */
create or replace function public.proof_room_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link record;
  v_run record;
  v_foto record;
  v_zincir jsonb;
  v_appl jsonb;
  v_kanit jsonb;
begin
  select * into v_link from public.proof_room_links where token = p_token;
  if v_link is null or v_link.son_gecerlilik < now() or v_link.iptal_edildi then
    return null;
  end if;

  select r.id, r.sonuc, r.gerekce, r.calisti_at, r.control_id, r.evidence_id,
         d.ad as tanim_ad, c.madde_ref, c.baslik as kontrol_baslik
    into v_run
  from public.test_runs r
  join public.control_test_definitions d on d.id = r.test_definition_id
  join public.controls c on c.id = r.control_id
  where r.id = v_link.test_run_id and r.tenant_id = v_link.tenant_id;
  if v_run is null then
    return null;
  end if;

  -- Mühürlü dayanak fotoğrafı — yoksa NULL kalır (eski koşu; uydurulmaz).
  select karar, snapshot into v_foto
  from public.execution_legal_snapshots
  where test_run_id = v_run.id;

  -- Kaynak zinciri (REJECTED eşleme iddia değildir). Hüküm metni yalnız
  -- snippet olarak döner (ilk 240 karakter).
  select coalesce(jsonb_agg(z order by z."obligationKod"), '[]'::jsonb) into v_zincir
  from (
    select
      o.kod as "obligationKod",
      o.nitelik,
      o.dogrulama_durumu as "obligationDogrulama",
      m.dogrulama_durumu as "mappingDogrulama",
      m.kapsam,
      p.provision_ref as "provisionRef",
      p.effective_from as "effectiveFrom",
      p.effective_to as "effectiveTo",
      p.dogrulama_durumu as "provisionDogrulama",
      left(p.metin, 240) as snippet,
      a.baslik as "artifactBaslik",
      a.sha256 as "artifactSha256",
      s.authority,
      s.ad as "kaynakAd",
      s.jurisdiction,
      s.kaynak_seviyesi as "kaynakSeviyesi",
      s.canonical_url as "canonicalUrl"
    from public.obligation_control_mappings m
    join public.obligations o on o.id = m.obligation_id
    join public.provisions p on p.id = o.provision_id
    join public.source_artifacts a on a.id = p.source_artifact_id
    join public.regulatory_sources s on s.id = a.source_id
    where m.control_id = v_run.control_id
      and m.dogrulama_durumu <> 'REJECTED'
  ) z;

  -- Kiracının GÜNCEL applicability kararları (bu kontrolün yükümlülükleri).
  select coalesce(jsonb_agg(k), '[]'::jsonb) into v_appl
  from (
    select o.kod as "obligationKod", ad2.durum, ad2.gerekce,
           ad2.fact_snapshot_fingerprint as "factSnapshotFingerprint",
           ad2.karar_kaynagi as "kararKaynagi"
    from public.applicability_decisions ad2
    join public.obligations o on o.id = ad2.obligation_id
    join public.obligation_control_mappings m on m.obligation_id = o.id
    where m.control_id = v_run.control_id
      and ad2.tenant_id = v_link.tenant_id
      and ad2.superseded_at is null
  ) k;

  -- Kanıt: yalnız id + dosya hash'i (içerik/yol/kimlik dönmez).
  select case when v_run.evidence_id is null then null
    else (
      select jsonb_build_object('evidenceId', e.id, 'dosyaHashSha256', e.hash_sha256)
      from public.evidences e where e.id = v_run.evidence_id
    ) end into v_kanit;

  -- Denetçi erişimi iz bırakır; token detaya YAZILMAZ.
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
    jsonb_build_object('testRunId', v_run.id)
  );

  return jsonb_build_object(
    'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
    'sonGecerlilik', v_link.son_gecerlilik,
    'kosu', jsonb_build_object(
      'id', v_run.id, 'sonuc', v_run.sonuc, 'gerekce', v_run.gerekce,
      'calistiAt', v_run.calisti_at, 'tanimAd', v_run.tanim_ad,
      'kontrolMaddeRef', v_run.madde_ref, 'kontrolBaslik', v_run.kontrol_baslik
    ),
    'legalSnapshot', case when v_foto is null then null
      else jsonb_build_object('karar', v_foto.karar, 'snapshot', v_foto.snapshot) end,
    'kaynakZinciri', v_zincir,
    'applicability', v_appl,
    'kanit', v_kanit
  );
end;
$$;

grant execute on function public.proof_room_goruntule(text) to anon, authenticated;
