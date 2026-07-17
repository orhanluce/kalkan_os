// Bağımsız kanıt doğrulama — şartname §9.4, docs/ROADMAP.md M5.5.
//
// Bu, denetçinin çalıştırdığı koddur: "bize güvenin" demediğimiz yer.
// Girdilerin hepsi DIŞARIDAN gelir (zarf, dosya, proof, makbuz) ve
// doğrulama bunları birbirine karşı sınar — kendi veritabanımıza sormaz.
// Sorsaydı, doğrulamanın kanıtladığı tek şey "veritabanımız kendisiyle
// tutarlı" olurdu ve bu, bütünlük iddiasının tam olarak kanıtlaması
// gereken şey DEĞİL.
//
// NE KANITLAR: kanıtın içeriği, sabitlendiği andan beri değişmedi.
// NE KANITLAMAZ: kanıtın içeriğinin DOĞRU olduğunu. Yanlış veri de geçerli
// şekilde hash'lenip sabitlenir (şartname §2.3). Bir sızma testi raporunun
// bütünlüğünü doğrulamak, raporun bulgularının doğru olduğunu göstermez.

import type { AnchorReceipt, EvidenceAnchorProvider } from "./anchor";
import { envelopeHash, type EvidenceEnvelope } from "./evidence-envelope";
import { verifyInclusion, type ProofStep } from "./merkle";

export type GenelSonuc = "VERIFIED" | "FAILED" | "PARTIAL" | "PENDING";
export type KontrolSonuc = "gecti" | "kaldi" | "yok";

export interface DogrulamaKontrolu {
  ad: string;
  sonuc: KontrolSonuc;
  aciklama: string;
}

export interface DogrulamaSonucu {
  genel: GenelSonuc;
  kontroller: DogrulamaKontrolu[];
}

export interface DogrulamaGirdisi {
  zarf: EvidenceEnvelope;
  /**
   * Denetçinin elindeki dosyadan HESAPLANAN hash. Denetçi dosyayı indirip
   * kendi hash'ini alır ve buraya verir; biz onun yerine hesaplamayız —
   * hesaplasaydık dosyanın gerçekten o dosya olduğunu değil, bizim ne
   * söylediğimizi doğrulamış olurdu. Dosya elde yoksa null.
   */
  dosyadanHesaplananHash: string | null;
  /** Önceki versiyonun zarfı; versiyon zinciri kontrolü için. İlk versiyonda null. */
  oncekiZarf: EvidenceEnvelope | null;
  proof: ProofStep[] | null;
  batchRoot: string | null;
  receipt: AnchorReceipt | null;
}

function kontrol(ad: string, sonuc: KontrolSonuc, aciklama: string): DogrulamaKontrolu {
  return { ad, sonuc, aciklama };
}

async function dosyaHashKontrolu(girdi: DogrulamaGirdisi): Promise<DogrulamaKontrolu> {
  const ad = "Dosya hash eslesmesi";

  // link/beyan tipi kanıtta dosya YOKTUR. Bunu "kaldi" saymak, dosyasız bir
  // kanıt tipini kurcalanmış gibi gösterirdi.
  if (girdi.zarf.fileHash === null) {
    return kontrol(ad, "yok", "Bu kanit tipinde dosya yok; yalnizca zarf uzerinden dogrulandi.");
  }
  if (girdi.dosyadanHesaplananHash === null) {
    return kontrol(ad, "yok", "Dosya sunulmadi; yalnizca zarf uzerinden dogrulandi.");
  }
  return girdi.dosyadanHesaplananHash === girdi.zarf.fileHash
    ? kontrol(ad, "gecti", "Dosyanin SHA-256'si zarftaki degerle ayni.")
    : kontrol(ad, "kaldi", "Dosyanin SHA-256'si zarftaki degerle UYUSMUYOR: dosya degistirilmis.");
}

async function versiyonZinciriKontrolu(girdi: DogrulamaGirdisi): Promise<DogrulamaKontrolu> {
  const ad = "Versiyon zinciri";
  const { zarf, oncekiZarf } = girdi;

  if (zarf.previousEnvelopeHash === null) {
    if (oncekiZarf !== null) {
      // Zarf "ilk versiyonum" diyor ama bir öncül sunuldu: ikisinden biri
      // yanlış, sessizce geçilemez.
      return kontrol(ad, "kaldi", "Zarf ilk versiyon oldugunu belirtiyor ama bir onceki versiyon sunuldu.");
    }
    return zarf.versionNo === 1
      ? kontrol(ad, "gecti", "Ilk versiyon; oncul beklenmiyor.")
      : kontrol(ad, "kaldi", `Versiyon ${zarf.versionNo} ama oncul zarf hash'i bos.`);
  }

  if (oncekiZarf === null) {
    return kontrol(ad, "yok", "Zarf bir oncule isaret ediyor ama onceki versiyon sunulmadi.");
  }

  const beklenen = await envelopeHash(oncekiZarf);
  if (beklenen !== zarf.previousEnvelopeHash) {
    return kontrol(ad, "kaldi", "Onceki versiyonun zarf hash'i zincirle UYUSMUYOR.");
  }

  // Zarf zinciri tuttu; DOSYA zinciri de tutmalı. İkisi ayrı sorular:
  // zarf hash'i kökenin, dosya hash'i içeriğin zinciri. Yalnızca ilkini
  // kontrol etmek, "köken kaydı doğru ama işaret ettiği dosya başka" halini
  // gözden kaçırırdı.
  if (zarf.previousFileHash !== null && zarf.previousFileHash !== oncekiZarf.fileHash) {
    return kontrol(ad, "kaldi", "Onceki versiyonun DOSYA hash'i zincirle UYUSMUYOR.");
  }

  return kontrol(ad, "gecti", "Onceki versiyonun zarf ve dosya hash'leri zincirle eslesiyor.");
}

async function merkleProofKontrolu(girdi: DogrulamaGirdisi): Promise<DogrulamaKontrolu> {
  const ad = "Merkle proof";
  if (girdi.proof === null || girdi.batchRoot === null) {
    return kontrol(ad, "yok", "Kanit henuz bir partiye alinmamis (sabitleme bekliyor).");
  }

  const yaprak = await envelopeHash(girdi.zarf);
  const gecerli = await verifyInclusion(yaprak, girdi.proof, girdi.batchRoot);
  return gecerli
    ? kontrol(ad, "gecti", "Zarf, sabitlenen partinin icinde.")
    : kontrol(ad, "kaldi", "Zarf, sabitlenen partide DEGIL: zarf degistirilmis veya proof gecersiz.");
}

async function anchorKontrolu(
  girdi: DogrulamaGirdisi,
  provider: EvidenceAnchorProvider,
): Promise<DogrulamaKontrolu> {
  const ad = "Anchor makbuzu";
  if (girdi.receipt === null || girdi.batchRoot === null) {
    return kontrol(ad, "yok", "Parti henuz sabitlenmemis (PENDING_ANCHOR).");
  }

  const sonuc = await provider.verify(girdi.batchRoot, girdi.receipt);
  if (sonuc.sonuc === "VERIFIED") return kontrol(ad, "gecti", sonuc.aciklama);
  if (sonuc.sonuc === "PENDING") return kontrol(ad, "yok", sonuc.aciklama);
  return kontrol(ad, "kaldi", sonuc.aciklama);
}

/**
 * Genel sonucu kontrollerden türetir.
 *
 * SIRA ÖNEMLİ: tek bir "kaldi" varsa sonuç FAILED'dir — başka kontroller
 * geçmiş olsa bile. Bir bütünlük doğrulamasında çoğunluk oyu yoktur;
 * kurcalandığına dair tek bir işaret, geri kalan her şeyi geçersiz kılar.
 */
function genelSonuc(kontroller: DogrulamaKontrolu[]): GenelSonuc {
  if (kontroller.some((k) => k.sonuc === "kaldi")) return "FAILED";

  // Sabitleme yapılmamışsa sonuç PENDING: kanıtta bir sorun yok, sistem
  // henüz işini bitirmemiş. Bunu PARTIAL saymak, sağlayıcı gecikmesini
  // kanıt eksikliği gibi gösterirdi (şartname §9.2: sağlayıcı yoksa akış
  // durmaz, durum PENDING_ANCHOR'dır).
  const sabitlemeYok = kontroller.some(
    (k) => (k.ad === "Merkle proof" || k.ad === "Anchor makbuzu") && k.sonuc === "yok",
  );
  if (sabitlemeYok) return "PENDING";

  if (kontroller.some((k) => k.sonuc === "yok")) return "PARTIAL";
  return "VERIFIED";
}

/**
 * Kanıtı bağımsız olarak doğrular (şartname §9.4).
 *
 * Sonuç, hassas metadata İÇERMEZ: kontrol açıklamaları dosya adı, not veya
 * kanıt içeriği taşımaz (CLAUDE.md kural 7). Doğrulama ekranı herkese açık
 * bir yüzeydir; oradan sızan her alan, kanıtın kendisini görmeye yetkisi
 * olmayan birine bilgi verir.
 */
export async function verifyEvidence(
  girdi: DogrulamaGirdisi,
  provider: EvidenceAnchorProvider,
): Promise<DogrulamaSonucu> {
  const kontroller = [
    await dosyaHashKontrolu(girdi),
    await versiyonZinciriKontrolu(girdi),
    await merkleProofKontrolu(girdi),
    await anchorKontrolu(girdi, provider),
  ];

  return { genel: genelSonuc(kontroller), kontroller };
}
