// Bağımsız şeffaflık makbuzu doğrulayıcı (G3, docs/ROADMAP.md M5.5).
//
// Bu betiğin TÜM ANLAMI: bir denetçi, KALKAN-OS'a ve veritabanına ULAŞMADAN,
// yalnız elindeki makbuz JSON'ıyla kaydın kütükte olduğunu ve imzalı ağaç
// başından (STH) beri değişmediğini doğrular. DB/env/ağ YOK — yalnız dosya.
//
// TEMİZ ORTAM: transparency.ts ve bağımlıları (merkle.ts, manifest-signature.ts,
// canonical.ts) runtime'da hiçbir dış paket kullanmaz. Denetçi repoyu klonlayıp
// `npx tsx scripts/verify-seffaflik.ts <makbuz.json>` koşabilir.
//
// ÇIKIŞ KODU: hepsi geçerse 0, tek kontrol düşerse 1 (CI'da kullanılabilir).

import { readFileSync } from "node:fs";
import { makbuzDogrula, type SeffaflikMakbuzu } from "../src/lib/transparency";

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/verify-seffaflik.ts <makbuz.json>");
    process.exit(2);
  }

  let makbuz: SeffaflikMakbuzu;
  try {
    makbuz = JSON.parse(readFileSync(yol, "utf8")) as SeffaflikMakbuzu;
  } catch (e) {
    console.error(`HATA: makbuz okunamadı/çözümlenemedi: ${(e as Error).message}`);
    process.exit(2);
  }

  const sonuc = await makbuzDogrula(makbuz);

  console.log(`\nKALKAN-OS şeffaflık makbuzu doğrulaması — ${yol}\n`);
  for (const k of sonuc.kontroller) {
    console.log(`${k.gecti ? "  [OK]  " : "  [X]   "}${k.ad}`);
    console.log(`          ${k.aciklama}`);
  }
  console.log(
    sonuc.gecerli
      ? "\n=> VERIFIED — kayıt kütükte ve imzalı ağaç başından beri değişmedi.\n" +
          "   (Not: bağımsız DUVAR-SAATİ zamanı için nitelikli TSA gerekir; bu makbuz onu iddia etmez.)\n"
      : "\n=> FAILED — en az bir kontrol düştü; makbuz/kayıt tutarsız olabilir.\n",
  );
  process.exit(sonuc.gecerli ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
