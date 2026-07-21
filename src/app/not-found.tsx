import Link from "next/link";
import { WardproofMark } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="flex items-center gap-2.5">
        <WardproofMark />
        <span className="text-lg font-semibold tracking-tight">Wardproof</span>
      </span>
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-2 py-10">
          <p className="text-sm font-medium">Sayfa bulunamadı</p>
          <p className="text-sm text-muted-foreground">
            Aradığınız adres mevcut değil ya da taşınmış olabilir.
          </p>
          <Link href="/" className="mt-2 text-sm underline hover:no-underline">
            Panoya dön
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
