import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    exclude: ["node_modules", ".next", "e2e"],
    // PGlite yük-flake + migration seti büyümesi: her RLS test dosyası
    // createTestDb'de TÜM migration'ları (50+) yeniden uyguluyor; migration
    // sayısı arttıkça tam-takım paralel koşuda dosya başına maliyet artıyor
    // (18 Temmuz: rls-simulasyon-manifest izole 18.8s, tam takımda 58s).
    // Tavan geçici 90sn'ye çekildi — assert'ler değişmez, yalnız yük toleransı.
    // KÖK ÇÖZÜM BORCU (ROADMAP): pg.ts'te migration'ları bir kez uygulayıp
    // PGlite dumpDataDir snapshot'ını her testte loadDataDir ile klonla →
    // dosya başı "50 migration uygula" maliyeti "binary snapshot yükle"ye iner.
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
});
