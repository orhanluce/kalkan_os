// Bağımsız DSAR kanıt paketi doğrulayıcı (M36 sonraki dilim).
//
// Denetçi/veri sahibi, KALKAN-OS'a ulaşmadan yalnız paket JSON'ıyla doğrular:
// manifest hash'i içerikten yeniden hesaplanır, imzalı ifade doğrulanır ve
// ifade tam bu manifesti işaret ediyor mu bakılır. DB/env/ağ YOK.
//
// KULLANIM: npx tsx scripts/verify-dsar-paketi.ts <paket.json>
// ÇIKIŞ: geçerse 0, düşerse 1.

import { readFileSync } from "node:fs";
import { dsarPaketiDogrula, type DsarKanitPaketi } from "../src/lib/gizlilik";

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/verify-dsar-paketi.ts <paket.json>");
    process.exit(2);
  }

  let paket: DsarKanitPaketi;
  try {
    paket = JSON.parse(readFileSync(yol, "utf8")) as DsarKanitPaketi;
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
