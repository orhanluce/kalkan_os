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
import {
  CONSISTENCY_SCHEMA,
  makbuzDogrula,
  tutarlilikDogrula,
  type SeffaflikMakbuzu,
  type TutarlilikKanidi,
} from "../src/lib/transparency";

async function main() {
  const yol = process.argv[2];
  if (!yol) {
    console.error("Kullanım: npx tsx scripts/verify-seffaflik.ts <makbuz|tutarlilik.json>");
    process.exit(2);
  }

  let veri: { schema?: string };
  try {
    veri = JSON.parse(readFileSync(yol, "utf8"));
  } catch (e) {
    console.error(`HATA: dosya okunamadı/çözümlenemedi: ${(e as Error).message}`);
    process.exit(2);
  }

  // Şemaya göre dispatch: kapsama makbuzu mu, tutarlılık kanıtı mı?
  const tutarlilik = veri.schema === CONSISTENCY_SCHEMA;
  const sonuc = tutarlilik
    ? await tutarlilikDogrula(veri as TutarlilikKanidi)
    : await makbuzDogrula(veri as SeffaflikMakbuzu);

  const baslik = tutarlilik ? "tutarlılık (append-only) kanıtı" : "şeffaflık makbuzu";
  console.log(`\nKALKAN-OS ${baslik} doğrulaması — ${yol}\n`);
  for (const k of sonuc.kontroller) {
    console.log(`${k.gecti ? "  [OK]  " : "  [X]   "}${k.ad}`);
    console.log(`          ${k.aciklama}`);
  }
  const olumlu = tutarlilik
    ? "VERIFIED — kütük iki ağaç başı arasında yalnız ekledi (geçmiş yeniden yazılmadı)."
    : "VERIFIED — kayıt kütükte ve imzalı ağaç başından beri değişmedi.\n" +
      "   (Not: bağımsız DUVAR-SAATİ zamanı için nitelikli TSA gerekir; bu makbuz onu iddia etmez.)";
  console.log(sonuc.gecerli ? `\n=> ${olumlu}\n` : "\n=> FAILED — en az bir kontrol düştü; kanıt tutarsız olabilir.\n");
  process.exit(sonuc.gecerli ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
