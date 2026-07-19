// Bağımsız DSAR kanıt paketi doğrulayıcı (M36 sonraki dilim; nihai talimat
// v3.2 §8.0 asenkron mühür).
//
// Denetçi/veri sahibi, KALKAN-OS'a ulaşmadan yalnız paket JSON'ıyla doğrular:
// manifest hash'i içerikten yeniden hesaplanır; PENDING ise DÜRÜSTÇE "henüz
// mühürlenmedi" denir (kurcalama DEĞİL — ayrı çıkış kodu); ANCHORED ise makbuz
// zincirinin tamamı (statementHash bağı + Merkle/STH/imza) doğrulanır. DB/
// env/ağ YOK.
//
// KULLANIM: npx tsx scripts/verify-dsar-paketi.ts <paket.json>
// ÇIKIŞ: VERIFIED → 0, PENDING (henüz mühürlenmedi) → 2, FAILED → 1.

import { readFileSync } from "node:fs";
import { dsarPaketiDogrula, type DsarKanitZarfi } from "../src/lib/gizlilik";

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/verify-dsar-paketi.ts <paket.json>");
    process.exit(2);
  }

  let paket: DsarKanitZarfi;
  try {
    paket = JSON.parse(readFileSync(yol, "utf8")) as DsarKanitZarfi;
  } catch (e) {
    console.error(`HATA: paket okunamadı/çözümlenemedi: ${(e as Error).message}`);
    process.exit(2);
  }

  const sonuc = await dsarPaketiDogrula(paket);
  console.log(`\nKALKAN-OS DSAR kanıt paketi doğrulaması — ${yol}\n`);
  for (const k of sonuc.kontroller) {
    console.log(`${k.gecti ? "  [OK]  " : "  [X]   "}${k.ad}`);
    console.log(`          ${k.aciklama}`);
  }

  if (paket.durum !== "ANCHORED" || !paket.makbuz) {
    // durum === ANCHORED ama makbuz null olabilir: yaprak deftere yazıldı
    // (leaf var) ama henüz onu KAPSAYAN bir ağaç başı (STH) yayınlanmadı —
    // bu da bir KURCALAMA DEĞİL, bekleme durumudur (G3 checkpoint deseni).
    console.log(
      `\n=> PENDING (durum: ${paket.durum}) — henüz tam mühürlenmedi (ağaç başı/STH bekleniyor olabilir).\n` +
        "   Bu bir kurcalama DEĞİLDİR; defter drenajı/checkpoint yayını sonrası tekrar indirip doğrulayın.\n",
    );
    process.exit(2);
  }

  console.log(
    sonuc.gecerli
      ? "\n=> VERIFIED — DSAR karşılanma manifesti mühürlendiğinden beri değişmedi.\n" +
          "   (Açıklanan verinin kendisi bu pakette DEĞİLDİR — yalnız kategoriler + kimlik hash'i.)\n"
      : "\n=> FAILED — en az bir kontrol düştü; paket tutarsız olabilir.\n",
  );
  process.exit(sonuc.gecerli ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
