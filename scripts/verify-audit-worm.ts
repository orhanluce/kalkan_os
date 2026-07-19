// BAĞIMSIZ denetim WORM export doğrulayıcı (M17 sonraki dilim son madde,
// ROADMAP §1.29). verify-sitasyon.ts ile AYNI bağımsızlık ilkesi: denetçi
// KALKAN_OS'a ve veritabanına erişmeden bir paket JSON'unu doğrular.
//
//   npx tsx scripts/verify-audit-worm.ts <paket.json>
//
// Hash içerikten yeniden hesaplanır (kendi RFC 8785 uygulamamız — src/lib/
// canonical.ts, runtime'da dış bağımlılık yok). Çıkış kodu: 0 = VERIFIED,
// 1 = FAILED. NOT: paket İMZASIZDIR (imzaDurumu alanı) — bu araç bütünlük
// doğrular, köken imzası doğrulamaz (KMS/TSA açık kararlar).
import { readFileSync } from "node:fs";
import { auditWormDogrula, type AuditWormPaketi } from "../src/lib/audit-worm-export";

async function main() {
  const dosya = process.argv[2];
  if (!dosya) {
    console.error("Kullanım: npx tsx scripts/verify-audit-worm.ts <paket.json>");
    process.exit(2);
  }

  const paket = JSON.parse(readFileSync(dosya, "utf8")) as AuditWormPaketi;
  if (paket.schema !== "KALKAN_AUDIT_WORM_EXPORT_V1") {
    console.error(`Tanınmayan şema: ${String(paket.schema)}`);
    process.exit(2);
  }

  const sonuc = await auditWormDogrula(paket);
  console.log(`${sonuc.gecerli ? "✓" : "✗"} paketHash`);
  if (!sonuc.gecerli) {
    console.log(`    beklenen  : ${sonuc.beklenen}`);
    console.log(`    hesaplanan: ${sonuc.hesaplanan}`);
  }
  console.log(sonuc.gecerli ? "\nVERIFIED — paket içeriği hash ile tutarlı." : "\nFAILED — paket kurcalanmış veya bozuk.");
  process.exit(sonuc.gecerli ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
