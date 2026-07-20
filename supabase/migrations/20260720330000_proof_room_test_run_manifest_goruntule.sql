-- Dikey F, F1 (docs/adr/PR0-dikeyF-f1-test-manifesti-kritik-hizmet-retest-
-- 2026-07-20.md §5): proof_room_goruntule()'un test_run_id dalına V2/V3
-- manifest alanları + ilişkisel bulgu/retest bağlantıları eklendi.
--
-- GÜNCEL sürüm (20260720260000, grep doğrulandı — bu, proof_room_goruntule'a
-- yapılan en son forward-fix) TAM olarak temel alındı; yalnız test_run_id
-- dalının EN SONUNDAKİ dönüş nesnesi genişledi. Diğer üç dal (cloud_assurance/
-- graph_snapshot/roi_export) DEĞİŞMEDİ.
--
-- MANIFEST HASH GÖSTERİLMİYOR (ADR §5): RFC 8785 kanonik hash'i yalnız
-- TypeScript'te hesaplanıyor, hiçbir DB kolonunda saklanmıyor — plpgsql'de
-- yeniden hesaplanamaz. Bunun yerine semaSurumu (sabit string) + zaten var
-- olan ledgerDurumu (mühürlenip mühürlenmediğini kanıtlar) gösterilir.
--
-- KULLANICI KİMLİKLERİ DÖNMEZ (orijinal Proof Room ilkesi, 20260718220000
-- §12): hazırlayan/sorumlu/bağımsız onaylayan raw UUID olarak DÖNMEZ —
-- yalnız DOLU OLUP OLMADIĞI (boolean) gösterilir. Bu, kurucunun "gösterilebilir"
-- (zorunlu değil, "uygun olduğu ölçüde") diline sadık kalarak mevcut veri
-- minimizasyonu ilkesini bozmayan bilinçli bir tercihtir.
--
-- KAYNAK AYRIMI (kurucunun kendi talebi): payload üç ayrı alt-nesneye böler —
-- `manifestOzeti` (test_runs/control_test_definitions'ın kendi sütunları,
-- V2/V3 şemasının BİREBİR karşılığı), `iliskiselBaglantilar` (control_test_
-- finding_proposals üzerinden GÜNCEL ilişkisel sorgu, manifestin PARÇASI
-- DEĞİL), `kapanisBaglantisi` (findings.kapatma_retest_run_id üzerinden
-- TARİHSEL kapanış olgusu). Manifest MUTASYONA UĞRAMAZ — hepsi OKUMA anında
-- ilişkisel sorgudan türer.

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
  v_tanim record;
  v_kabul_edilmis_bulgu jsonb;
  v_kapanan_bulgular jsonb;
  v_retest_niyeti jsonb;
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

  -- --- Dikey F, F1: V2/V3 manifest özeti (test_runs + control_test_definitions'ın KENDİ sütunları) ---
  select
    r.amac, r.kapsam, r.hedef_varlik, r.kritik_hizmet_adi, r.critical_service_id,
    r.senaryo_kimligi, r.senaryo_surumu, r.scenario_template_id,
    tr.beklenen_sonuc, tr.performans_etkisi, tr.yanlis_pozitif, tr.yanlis_negatif,
    tr.baslangic_at, tr.bitis_at, tr.retest_of_finding_id,
    (tr.hazirlayan is not null) as hazirlayan_belirtildi,
    (tr.sorumlu is not null) as sorumlu_belirtildi,
    (tr.bagimsiz_onaylayan is not null) as bagimsiz_onaylayan_belirtildi
  into v_tanim
  from public.control_test_definitions r
  join public.test_runs tr on tr.id = v_run.id
  where r.id = tr.test_definition_id;

  -- --- İlişkisel: bu koşunun ÜRETTİĞİ, KABUL edilmiş bulgu (varsa) ---
  select case when p.finding_id is null then null
    else jsonb_build_object('findingId', p.finding_id, 'onem', p.onem, 'durum', f.durum)
    end into v_kabul_edilmis_bulgu
  from public.control_test_finding_proposals p
  left join public.findings f on f.id = p.finding_id
  where p.test_run_id = v_run.id and p.durum = 'KABUL';

  -- --- Tarihsel: bu koşuyla GERÇEKTEN kapanan bulgu(lar) (findings.kapatma_retest_run_id) ---
  select coalesce(jsonb_agg(jsonb_build_object('findingId', f2.id, 'kapaninZamani', f2.kapatma_onay_at)), '[]'::jsonb)
    into v_kapanan_bulgular
  from public.findings f2
  where f2.kapatma_retest_run_id = v_run.id;

  -- --- Bu koşunun retest NİYETİ (test_runs.retest_of_finding_id, oluşturma anında bilinen) ---
  select case when v_tanim.retest_of_finding_id is null then null
    else jsonb_build_object('findingId', v_tanim.retest_of_finding_id)
    end into v_retest_niyeti;

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
    'ledgerDurumu', public.artifact_ledger_durumu('test_runs', v_run.id),
    'manifestOzeti', jsonb_build_object(
      'semaSurumu', 'KALKAN_CONTROL_TEST_RUN_MANIFEST_V3',
      'amac', v_tanim.amac,
      'kapsam', v_tanim.kapsam,
      'hedefVarlik', v_tanim.hedef_varlik,
      'kritikHizmetAdi', v_tanim.kritik_hizmet_adi,
      'kritikHizmetIdDogrulanmis', v_tanim.critical_service_id is not null,
      'senaryoKimligi', v_tanim.senaryo_kimligi,
      'senaryoSurumu', v_tanim.senaryo_surumu,
      'senaryoIdDogrulanmis', v_tanim.scenario_template_id is not null,
      'beklenenSonuc', v_tanim.beklenen_sonuc,
      'performansEtkisi', v_tanim.performans_etkisi,
      'yanlisPozitif', v_tanim.yanlis_pozitif,
      'yanlisNegatif', v_tanim.yanlis_negatif,
      'baslangicAt', v_tanim.baslangic_at,
      'bitisAt', v_tanim.bitis_at,
      'hazirlayanBelirtildi', v_tanim.hazirlayan_belirtildi,
      'sorumluBelirtildi', v_tanim.sorumlu_belirtildi,
      'bagimsizOnaylayanBelirtildi', v_tanim.bagimsiz_onaylayan_belirtildi
    ),
    'retestNiyeti', v_retest_niyeti,
    'iliskiselBaglantilar', jsonb_build_object('kabulEdilmisBulgu', v_kabul_edilmis_bulgu),
    'kapanisBaglantisi', jsonb_build_object('kapananBulgular', v_kapanan_bulgular)
  );
end;
$$;
