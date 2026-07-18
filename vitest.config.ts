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
    // **/ prefix ŞART: iç içe node_modules'ları da dışla (git worktree'ler
    // .claude/worktrees/*/node_modules oluşturabilir — yalnız "node_modules"
    // kök dizini dışlar, iç içeyi kaçırır ve üçüncü-taraf testleri sızardı).
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**", "e2e"],
    // PGlite yük-flake + migration seti büyümesi: her RLS test dosyası
    // createTestDb'de TÜM migration'ları (50+) yeniden uyguluyor; migration
    // sayısı arttıkça tam-takım paralel koşuda dosya başına maliyet artıyor
    // (18 Temmuz: rls-simulasyon-manifest izole 18.8s, tam takımda 58s).
    // Snapshot-klon (pg.ts) ile dosya başı "50+ migration uygula" maliyeti
    // "binary snapshot yükle"ye indi — tam takım ~66s'den ~34s'ye düştü ve
    // geçici 90sn tavanı artık gereksiz. 20sn, yük altında gerçek takılmayı
    // yakalarken snapshot klonuna bol pay bırakır.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
