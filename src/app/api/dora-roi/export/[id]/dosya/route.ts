// DORA RoI export dosyası indirme — CSV/XLSX (37 Tez Dikey B, Faz 3 kalan
// dilimi). Yalnız YAYINLANDI export'lar indirilebilir — bu, guard'ın
// (20260720130000) "engelleyici sorun varken YAYINLANDI olamaz" invariant'ı
// sayesinde YAPISAL OLARAK zaten sağlanır (ADR §4, ayrı bir kontrol
// GEREKMEZ). service_role YOK — kullanıcının kendi RLS'i altında.
import { NextResponse } from "next/server";
import { roiSablonCsvYap, roiSablonXlsxYap } from "@/lib/roi-export-serialize";
import type { RoiSablonPaketi } from "@/lib/roi-export";
import { bytesHash } from "@/lib/canonical";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const { data: kayit, error } = await db
    .from("roi_export_runs")
    .select("id, paket, durum")
    .eq("id", id)
    .eq("durum", "YAYINLANDI")
    .maybeSingle();
  if (error || !kayit) {
    return NextResponse.json({ hata: "Export bulunamadı ya da henüz yayınlanmadı." }, { status: 404 });
  }

  const paket = kayit.paket as unknown as RoiSablonPaketi;

  if (format === "csv") {
    const metin = roiSablonCsvYap(paket);
    const bayt = new TextEncoder().encode(metin);
    const dosyaHash = await bytesHash(bayt);
    return new NextResponse(bayt, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kalkan-dora-roi-${kayit.id}.csv"`,
        "X-Dosya-Hash-Sha256": dosyaHash,
      },
    });
  }

  const bayt = await roiSablonXlsxYap(paket);
  const dosyaHash = await bytesHash(bayt);
  return new NextResponse(new Blob([bayt.buffer.slice(bayt.byteOffset, bayt.byteOffset + bayt.byteLength) as ArrayBuffer]), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="kalkan-dora-roi-${kayit.id}.xlsx"`,
      "X-Dosya-Hash-Sha256": dosyaHash,
    },
  });
}
