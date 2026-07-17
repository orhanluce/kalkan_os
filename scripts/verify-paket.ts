// Bağımsız denetim paketi doğrulayıcı (docs/ROADMAP.md M11, belge M01).
//
// Bu betiğin TÜM ANLAMI şudur: bir denetçi, KALKAN-OS'a ve onun veritabanına
// ULAŞMADAN, yalnız elindeki paketle bütünlüğü ve imzayı doğrulayabilir. Bu
// yüzden burada DB bağlantısı, env okuma veya ağ çağrısı YOKTUR — betik
// yalnız diskteki dosyaları okur.
//
// TEMİZ ORTAM: bu dosya ve bağımlı olduğu iki modül (audit-package.ts →
// canonical.ts + manifest-signature.ts) runtime'da hiçbir dış paket
// kullanmaz. Denetçi repoyu klonlayıp `npx tsx scripts/verify-paket.ts
// <klasor>` koşabilir; başka kurulum gerekmez. Doğrulamanın güvenilirliği,
// güvenilmesi gereken kod yüzeyinin küçüklüğüne bağlıdır.
//
// KULLANIM:
//   npx tsx scripts/verify-paket.ts <acilmis-paket-klasoru>
// ÇIKIŞ KODU: hepsi geçerse 0, tek bir kontrol düşerse 1 (CI'da kullanılabilir).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { paketiDogrula } from "../src/lib/audit-package";

function klasoruOku(klasor: string): Map<string, Uint8Array> {
  const st = statSync(klasor);
  if (!st.isDirectory()) {
    throw new Error(`Bir klasör bekleniyordu: ${klasor}\nZIP ise önce açın.`);
  }
  const map = new Map<string, Uint8Array>();
  for (const ad of readdirSync(klasor)) {
    const yol = join(klasor, ad);
    if (statSync(yol).isFile()) {
      map.set(ad, new Uint8Array(readFileSync(yol)));
    }
  }
  return map;
}

async function main() {
  const klasor = process.argv[2];
  if (!klasor) {
    console.error("Kullanım: npx tsx scripts/verify-paket.ts <acilmis-paket-klasoru>");
    process.exit(2);
  }

  let dosyalar: Map<string, Uint8Array>;
  try {
    dosyalar = klasoruOku(klasor);
  } catch (e) {
    console.error(`HATA: ${(e as Error).message}`);
    process.exit(2);
  }

  const sonuc = await paketiDogrula(dosyalar);

  const simge = { gecti: "  [OK]  ", kaldi: "  [X]   ", yok: "  [--]  " } as const;
  console.log(`\nKALKAN-OS denetim paketi doğrulaması — ${klasor}\n`);
  for (const kontrol of sonuc.kontroller) {
    console.log(`${simge[kontrol.sonuc]}${kontrol.ad}`);
    console.log(`          ${kontrol.aciklama}`);
  }

  const ozet =
    sonuc.genel === "VERIFIED"
      ? "VERIFIED — paket mühürlendiği andan beri değişmemiş."
      : sonuc.genel === "PARTIAL"
        ? "PARTIAL — bütünlük tuttu ama imza yok (imzasız/eski paket)."
        : "FAILED — en az bir kontrol düştü; paket değiştirilmiş olabilir.";
  console.log(`\n=> ${sonuc.genel}: ${ozet}\n`);

  process.exit(sonuc.genel === "FAILED" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
