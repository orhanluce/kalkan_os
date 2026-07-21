// Wardproof marka işaretleri (tek kaynak). "WP" hissi jenerik kalkan ikonuna
// düşmeden verilir: W çizgisi bir zincir/mühür izi gibi iki vuruşta çizilir —
// üst vuruş tam yoğunlukta, alt vuruş yarı yoğunlukta (kanıt + izi katmanı).
// Renk currentColor'dan gelir; tema/palet bağlamına çağıran karar verir.
import { cn } from "@/lib/utils";

/** Ham glyph — rengi kapsayıcıdan (currentColor) alır. */
export function WardproofGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M5.5 8.5 9.2 23.2l6.8-6.1 6.8 6.1 3.7-14.7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 23.2 16 8.8l6.8 14.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Kutulu marka işareti — uygulama kabuğu ve formlar için.
 * Tema token'larıyla çalışır (light+dark); showcase (koyu vitrin) sayfaları
 * kendi renk sınıflarını `className`/`glyphClassName` ile geçebilir.
 */
export function WardproofMark({
  className,
  glyphClassName,
}: {
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md bg-primary/12 text-primary ring-1 ring-primary/25",
        className,
      )}
    >
      <WardproofGlyph className={cn("size-5", glyphClassName)} />
    </span>
  );
}
