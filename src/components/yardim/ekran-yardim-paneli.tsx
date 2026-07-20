import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MODUL_YARDIMLARI } from "@/lib/yardim-icerik";

// "Bu ekran ne işe yarar?" paneli (Kullanıcı Kılavuzu talimatı §Modül
// ekranlarında yapılacaklar). Mevcut Card bileşeninin ÜZERİNDE, yeni bir
// tasarım dili İCAT ETMEDEN — açılır/kapanır davranış native <details>/
// <summary> ile (JS gerektirmez, klavye ile Enter/Space açılır, ekran
// okuyucular yerleşik destekler).
//
// İçerik src/lib/yardim-icerik.ts'ten TEK kaynaktan gelir — panel ve
// /yardim sayfası AYNI veriyi render eder, metin iki yerde YAZILMAZ.
export function EkranYardimPaneli({ modulId }: { modulId: string }) {
  const icerik = MODUL_YARDIMLARI.find((m) => m.id === modulId);
  if (!icerik) return null;

  return (
    <Card className="border-info/30" data-testid={`yardim-paneli-${modulId}`}>
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-medium hover:bg-info/5 [&::-webkit-details-marker]:hidden">
          <CircleHelp className="size-4 shrink-0 text-info" aria-hidden />
          Bu ekran ne işe yarar?
        </summary>
        <CardContent className="flex flex-col gap-3 pb-4 text-sm">
          <p>{icerik.neIseYarar}</p>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Bu ekranda ne yapabilirsiniz?</p>
            <ul className="mt-1 list-inside list-disc">
              {icerik.neYapar.map((madde, i) => (
                <li key={i}>{madde}</li>
              ))}
            </ul>
          </div>
          {icerik.dikkat ? (
            <p role="note" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {icerik.dikkat}
            </p>
          ) : null}
          <Link href={`/yardim#${icerik.id}`} className="text-xs text-primary hover:underline">
            Daha fazla bilgi: Kullanıcı Kılavuzu
          </Link>
        </CardContent>
      </details>
    </Card>
  );
}
