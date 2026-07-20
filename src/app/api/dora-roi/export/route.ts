// DORA RoI export üretimi (37 Tez Dikey B, Faz 3 ilk dilim). Mevcut 5 yapıdan
// (kurum kimliği/ICT hizmet türü/third_parties/fourth_parties/critical_
// business_services) saf motorla (src/lib/roi-export.ts) TASLAK üretir ve
// mühürler (RFC 8785 hash) — service_role YOK, kullanıcının kendi RLS'i
// altında okunur (proof-room rotasının aynı disiplini).
import { NextResponse } from "next/server";
import { canonicalHash, type CanonicalDeger } from "@/lib/canonical";
import { roiExportOnKontrol, roiSablonSatirlariUret, type RoiExportGirdisi } from "@/lib/roi-export";
import { roiExportProvenanceOlustur, type RoiExportProvenanceGirdisi } from "@/lib/roi-export-provenance";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export async function POST() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db.from("profiles").select("tenant_id").eq("id", user.id).maybeSingle();
  if (!profil?.tenant_id) {
    return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });
  }

  const [{ data: kimlik }, { data: hizmetTurleri }, { data: ucuncuTaraflar }, { data: sozlesmeler }, { data: altYukleniciler }, { data: kritikFonksiyonlar }, { data: eslesmeler }] =
    await Promise.all([
      db.from("tenant_legal_identity").select("lei, euid, ticaret_sicil_no, ulke_kodu, para_birimi, kurulus_turu, hiyerarsi_seviyesi, ana_kurulus_lei, kayit_tutan_kurulus_lei, kayit_tutan_kurulus_adi").maybeSingle(),
      db.from("ict_service_types").select("kod, ad, dogrulama_durumu"),
      db.from("third_parties").select("id, ad, ulke"),
      db.from("third_party_contracts").select(
        "id, third_party_id, sozlesme_ref, baslangic, bitis, durum, tedarikci_kimlik_kodu, tedarikci_kimlik_kodu_turu, ict_hizmet_turu_kod, veri_saklaniyor_mu, veri_saklama_ulkesi, veri_isleme_ulkesi, sona_erme_nedeni, bildirim_suresi_kurum_gun, bildirim_suresi_saglayici_gun",
      ),
      db.from("fourth_parties").select("id, third_party_id, third_party_contract_id, ad, bilinmiyor, ulke, sira, ict_hizmet_turu_kod"),
      db.from("critical_business_services").select("id, ad, durum"),
      db.from("third_party_contract_critical_services").select("third_party_contract_id, critical_service_id"),
    ]);

  const asOf = new Date().toISOString().slice(0, 10);
  const girdi: RoiExportGirdisi = {
    kimlik: kimlik
      ? {
          lei: kimlik.lei,
          euid: kimlik.euid,
          ticaretSicilNo: kimlik.ticaret_sicil_no,
          ulkeKodu: kimlik.ulke_kodu,
          paraBirimi: kimlik.para_birimi,
          kurulusTuru: kimlik.kurulus_turu,
          hiyerarsiSeviyesi: kimlik.hiyerarsi_seviyesi,
          anaKurulusLei: kimlik.ana_kurulus_lei,
          kayitTutanKurulusLei: kimlik.kayit_tutan_kurulus_lei,
          kayitTutanKurulusAdi: kimlik.kayit_tutan_kurulus_adi,
        }
      : null,
    hizmetTurleri: (hizmetTurleri ?? []).map((h) => ({ kod: h.kod, ad: h.ad, dogrulamaDurumu: h.dogrulama_durumu as RoiExportGirdisi["hizmetTurleri"][number]["dogrulamaDurumu"] })),
    ucuncuTaraflar: (ucuncuTaraflar ?? []).map((t) => ({ id: t.id, ad: t.ad, ulke: t.ulke })),
    sozlesmeler: (sozlesmeler ?? []).map((s) => ({
      id: s.id,
      thirdPartyId: s.third_party_id,
      sozlesmeRef: s.sozlesme_ref,
      baslangic: s.baslangic,
      bitis: s.bitis,
      durum: s.durum as RoiExportGirdisi["sozlesmeler"][number]["durum"],
      tedarikciKimlikKodu: s.tedarikci_kimlik_kodu,
      tedarikciKimlikKoduTuru: s.tedarikci_kimlik_kodu_turu,
      ictHizmetTuruKod: s.ict_hizmet_turu_kod,
      veriSaklaniyorMu: s.veri_saklaniyor_mu,
      veriSaklamaUlkesi: s.veri_saklama_ulkesi,
      veriIslemeUlkesi: s.veri_isleme_ulkesi,
      sonaErmeNedeni: s.sona_erme_nedeni,
      bildirimSuresiKurumGun: s.bildirim_suresi_kurum_gun,
      bildirimSuresiSaglayiciGun: s.bildirim_suresi_saglayici_gun,
    })),
    altYukleniciler: (altYukleniciler ?? []).map((a) => ({
      id: a.id,
      thirdPartyId: a.third_party_id,
      thirdPartyContractId: a.third_party_contract_id,
      ad: a.ad,
      bilinmiyor: a.bilinmiyor,
      ulke: a.ulke,
      sira: a.sira,
      ictHizmetTuruKod: a.ict_hizmet_turu_kod,
    })),
    kritikFonksiyonlar: (kritikFonksiyonlar ?? []).map((k) => ({ id: k.id, ad: k.ad, durum: k.durum as RoiExportGirdisi["kritikFonksiyonlar"][number]["durum"] })),
    eslesmeler: (eslesmeler ?? []).map((e) => ({ thirdPartyContractId: e.third_party_contract_id, criticalServiceId: e.critical_service_id })),
    asOf,
  };

  const onKontrol = roiExportOnKontrol(girdi);
  const paket = roiSablonSatirlariUret(girdi);
  const paketHash = await canonicalHash(paket as unknown as CanonicalDeger);

  // Faz 4 — kanıt zinciri: paketle AYNI anda, mevcut 3 doğrulama kaynağından
  // (roi_kaynak_kayitlari/ict_service_types/assurance_claims) hesaplanır ve
  // paketle BİRLİKTE mühürlenir (ADR §1, on_kontrol_raporu'nun AYNI deseni).
  const [{ data: roiKaynaklari }, { data: iddialar }] = await Promise.all([
    db.from("roi_kaynak_kayitlari").select("sablon_kodu, alan_kodu, dogrulama_durumu"),
    db
      .from("assurance_claims")
      .select("id, hedef_tablo, hedef_id, sonuc, dogrulama_durumu, yururluk_tarihi, yeniden_inceleme_gerekli")
      .in("hedef_tablo", ["third_party_contracts", "critical_business_services"]),
  ]);
  const provenanceGirdi: RoiExportProvenanceGirdisi = {
    paket,
    roiKaynaklari: (roiKaynaklari ?? []).map((k) => ({
      sablonKodu: k.sablon_kodu,
      alanKodu: k.alan_kodu,
      dogrulamaDurumu: k.dogrulama_durumu as RoiExportProvenanceGirdisi["roiKaynaklari"][number]["dogrulamaDurumu"],
    })),
    ictHizmetTurleri: (hizmetTurleri ?? []).map((h) => ({ kod: h.kod, dogrulamaDurumu: h.dogrulama_durumu as RoiExportProvenanceGirdisi["ictHizmetTurleri"][number]["dogrulamaDurumu"] })),
    iddialar: (iddialar ?? []).map((i) => ({
      id: i.id,
      hedefTablo: i.hedef_tablo,
      hedefId: i.hedef_id,
      sonuc: i.sonuc as RoiExportProvenanceGirdisi["iddialar"][number]["sonuc"],
      dogrulamaDurumu: i.dogrulama_durumu as RoiExportProvenanceGirdisi["iddialar"][number]["dogrulamaDurumu"],
      yururlukTarihi: i.yururluk_tarihi,
      yenidenIncelemeGerekli: i.yeniden_inceleme_gerekli,
    })),
    asOf,
  };
  const provenanceRaporu = roiExportProvenanceOlustur(provenanceGirdi);
  const provenanceHash = await canonicalHash(provenanceRaporu as unknown as CanonicalDeger);

  const { data: kayit, error } = await db
    .from("roi_export_runs")
    .insert({
      tenant_id: profil.tenant_id,
      talep_eden: user.id,
      paket: paket as unknown as Json,
      paket_hash: paketHash,
      on_kontrol_raporu: onKontrol as unknown as Json,
      engelleyici_sorun_sayisi: onKontrol.engelleyiciSayisi,
      provenance_raporu: provenanceRaporu as unknown as Json,
      provenance_hash: provenanceHash,
    })
    .select("id, durum, paket_hash, engelleyici_sorun_sayisi")
    .single();
  if (error || !kayit) {
    return NextResponse.json({ hata: error?.message ?? "Export oluşturulamadı." }, { status: 403 });
  }

  return NextResponse.json({
    id: kayit.id,
    durum: kayit.durum,
    paketHash: kayit.paket_hash,
    engelleyiciSorunSayisi: kayit.engelleyici_sorun_sayisi,
    onKontrol,
  });
}
