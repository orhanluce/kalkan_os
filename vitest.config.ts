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
    // "binary snapshot yükle"ye indi — tam takım ~66s'den ~34s'ye düştü.
    testTimeout: 20_000,
    // hookTimeout AYRI ve daha yüksek: şablon dump'ı DOSYA BAŞINA bir kez
    // üretilir (vitest her dosyayı ayrı modül bağlamında koşar) ve migration
    // seti 47'ye çıkınca paralel tam takımda İLK beforeEach'ler 20sn'yi
    // aşmaya başladı (18 Temmuz gece: bir koşuda 14 dosyanın ilk testi aynı
    // hook-timeout deseniyle düştü; hepsi izole yeşil — assert hatası değil,
    // ilk-klon maliyeti). 60sn ilk kurulum için pay bırakır; gerçek test
    // takılmalarını 20sn'lik testTimeout yakalamaya devam eder.
    hookTimeout: 60_000,
  },
});
