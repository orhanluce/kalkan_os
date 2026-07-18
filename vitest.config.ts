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
    // 40 dosyanın çoğu PGlite'ta GERÇEK migration seti uyguluyor; tam takım
    // paralel koşarken worker çekişmesi tekil testleri varsayılan 5sn'nin
    // üzerine itebiliyor (18 Temmuz: izole 48ms'lik test yük altında 5033ms —
    // üç ayrı koşuda üç farklı dosyada aynı desen). Gevşek sınır assert'leri
    // değiştirmez, yalnız makine yükü toleransıdır; gerçek takılmayı 60sn
    // yine yakalar.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
