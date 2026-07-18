// BAĞIMSIZ sitasyon paketi doğrulayıcı (M24). Denetçi, KALKAN_OS'a ve
// veritabanına erişmeden bir citation bundle JSON'unu doğrular:
//
//   npx tsx scripts/verify-sitasyon.ts <paket.json>
//
// Üç hash içerikten yeniden hesaplanır (kendi RFC 8785 uygulamamız —
// src/lib/canonical.ts; verify-paket.ts ile aynı bağımsızlık ilkesi, runtime'da
// dış bağımlılık yok). Çıkış kodu: 0 = VERIFIED, 1 = FAILED.
// NOT: paket İMZASIZDIR (imzaDurumu alanı) — bu araç bütünlük doğrular,
// köken imzası doğrulamaz (KMS/TSA açık kararlar).
import { readFileSync } from "node:fs";
import { sitasyonDogrula, type SitasyonPaketi } from "../src/lib/citation-bundle";

async function main() {
  const dosya = process.argv[2];
  if (!dosya) {
    console.error("Kullanım: npx tsx scripts/verify-sitasyon.ts <paket.json>");
    process.exit(2);
  }

  const paket = JSON.parse(readFileSync(dosya, "utf8")) as SitasyonPaketi;
  if (paket.schema !== "KALKAN_CITATION_BUNDLE_V1") {
    console.error(`Tanınmayan şema: ${String(paket.schema)}`);
    process.exit(2);
  }

  const sonuc = await sitasyonDogrula(paket);
  for (const a of sonuc.alanlar) {
    console.log(`${a.gecerli ? "✓" : "✗"} ${a.alan}`);
    if (!a.gecerli) {
      console.log(`    beklenen : ${a.beklenen ?? "(null)"}`);
      console.log(`    hesaplanan: ${a.hesaplanan ?? "(null)"}`);
    }
  }
  console.log(sonuc.gecerli ? "\nVERIFIED — paket içeriği hash'lerle tutarlı." : "\nFAILED — paket kurcalanmış veya bozuk.");
  process.exit(sonuc.gecerli ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
