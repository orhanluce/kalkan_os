-- Dikey E, E1 (ADR §7): proof_room_goruntule'a cloud_assurance_profile_id
-- dalı. GÜNCEL sürüm (20260720210000, grep doğrulandı — Faz 4/Dikey D
-- dersinin bir kez daha uygulanması) TAM olarak temel alındı.

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
  v_export record;
  v_provenance_ozet jsonb;
  v_snapshot record;
  v_profil record;
begin
  select * into v_link from public.proof_room_links where token = p_token;
  if v_link is null or v_link.son_gecerlilik < now() or v_link.iptal_edildi then
    return null;
  end if;

  if v_link.cloud_assurance_profile_id is not null then
    select id, profil, profil_hash, hesaplama_yontemi, iliskili_roi_export_run_id, created_at
      into v_profil
    from public.cloud_assurance_profile_snapshots
    where id = v_link.cloud_assurance_profile_id and tenant_id = v_link.tenant_id;
    if v_profil is null then
      return null;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('cloudAssuranceProfileId', v_profil.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'cloudAssuranceProfile', jsonb_build_object(
        'id', v_profil.id,
        'profil', v_profil.profil,
        'profilHash', v_profil.profil_hash,
        'hesaplamaYontemi', v_profil.hesaplama_yontemi,
        'iliskiliRoiExportId', v_profil.iliskili_roi_export_run_id,
        'olusturulmaZamani', v_profil.created_at
      )
    );
  end if;

  if v_link.graph_snapshot_id is not null then
    select id, graf, graf_hash, spof_raporu, yayilim_raporu, hesaplama_yontemi, iliskili_roi_export_run_id, created_at
      into v_snapshot
    from public.impact_graph_snapshots
    where id = v_link.graph_snapshot_id and tenant_id = v_link.tenant_id;
    if v_snapshot is null then
      return null;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('graphSnapshotId', v_snapshot.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'graphSnapshot', jsonb_build_object(
        'id', v_snapshot.id,
        'graf', v_snapshot.graf,
        'grafHash', v_snapshot.graf_hash,
        'spofRaporu', v_snapshot.spof_raporu,
        'yayilimRaporu', v_snapshot.yayilim_raporu,
        'hesaplamaYontemi', v_snapshot.hesaplama_yontemi,
        'iliskiliRoiExportId', v_snapshot.iliskili_roi_export_run_id,
        'olusturulmaZamani', v_snapshot.created_at
      )
    );
  end if;

  if v_link.roi_export_run_id is not null then
    select id, paket, paket_hash, on_kontrol_raporu, durum, onay_zamani, provenance_raporu
      into v_export
    from public.roi_export_runs
    where id = v_link.roi_export_run_id
      and tenant_id = v_link.tenant_id
      and durum = 'YAYINLANDI';
    if v_export is null then
      return null;
    end if;

    if v_export.provenance_raporu is null then
      v_provenance_ozet := null;
    else
      select coalesce(jsonb_agg(jsonb_build_object(
          'alanKodu', s ->> 'sablon',
          'kaynakDurumu', s ->> 'kaynakDurumu',
          'genelDurum', s ->> 'genelDurum',
          'iddiaSayisi', (s ->> 'iliskiliIddiaSayisi')::int
        ) order by s ->> 'sablon'), '[]'::jsonb)
        into v_provenance_ozet
      from jsonb_array_elements(v_export.provenance_raporu -> 'satirlar') s;
    end if;

    insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
    values (
      v_link.tenant_id, null, 'proof_room_goruntulendi', 'proof_room_links', v_link.id,
      jsonb_build_object('roiExportRunId', v_export.id)
    );

    return jsonb_build_object(
      'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
      'sonGecerlilik', v_link.son_gecerlilik,
      'roiExport', jsonb_build_object(
        'id', v_export.id,
        'paket', v_export.paket,
        'paketHash', v_export.paket_hash,
        'onKontrolRaporu', v_export.on_kontrol_raporu,
        'yayinlanmaZamani', v_export.onay_zamani,
        'ledgerDurumu', public.artifact_ledger_durumu('roi_export_runs', v_export.id),
        'provenanceOzeti', v_provenance_ozet
      )
    );
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

  select karar, snapshot into v_foto
  from public.execution_legal_snapshots
  where test_run_id = v_run.id;

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

  select case when v_run.evidence_id is null then null
    else (
      select jsonb_build_object('evidenceId', e.id, 'dosyaHashSha256', e.hash_sha256)
      from public.evidences e where e.id = v_run.evidence_id
    ) end into v_kanit;

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
    'kanit', v_kanit,
    'ledgerDurumu', public.artifact_ledger_durumu('test_runs', v_run.id)
  );
end;
$$;
