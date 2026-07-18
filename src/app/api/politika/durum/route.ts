// Politika sürüm durum geçişleri (G2, M34). Tenant tablosu — service_role
// GEREKMEZ: RLS (admin/uyum yazma) + DB durum-makinesi guard'ı (dört-göz
// dahil) her şeyi zorlar. Rota yalnız kimlik atfını oturum sahibine sabitler
// ve dürüst hata döndürür.
import { NextResponse } from "next/server";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Eylem = "incelemeye_al" | "geri_gonder" | "onayla" | "yururluge_al" | "emekliye_ayir";

export async function POST(req: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const govde = (await req.json().catch(() => ({}))) as {
    versionId?: string;
    eylem?: Eylem;
    effectiveFrom?: string;
  };
  if (!govde.versionId || !govde.eylem) {
    return NextResponse.json({ hata: "versionId ve eylem zorunlu." }, { status: 400 });
  }

  const simdi = new Date().toISOString();
  let guncelleme: TablesUpdate<"policy_versions">;
  let beklenen: string;
  switch (govde.eylem) {
    case "incelemeye_al":
      guncelleme = { durum: "REVIEW", hazirlayan: user.id, hazirlama_zamani: simdi };
      beklenen = "DRAFT";
      break;
    case "geri_gonder":
      guncelleme = { durum: "DRAFT" };
      beklenen = "REVIEW";
      break;
    case "onayla":
      // Dört göz: onaylayan oturum sahibi; hazirlayan==onaylayan reddini DB verir.
      guncelleme = { durum: "APPROVED", onaylayan: user.id, onay_zamani: simdi };
      beklenen = "REVIEW";
      break;
    case "yururluge_al":
      if (!govde.effectiveFrom) {
        return NextResponse.json({ hata: "yururluge_al için effectiveFrom zorunlu." }, { status: 400 });
      }
      guncelleme = { durum: "EFFECTIVE", effective_from: govde.effectiveFrom };
      beklenen = "APPROVED";
      break;
    case "emekliye_ayir":
      guncelleme = { durum: "RETIRED" };
      beklenen = "EFFECTIVE";
      break;
    default:
      return NextResponse.json({ hata: "Bilinmeyen eylem." }, { status: 400 });
  }

  const { data, error } = await db
    .from("policy_versions")
    .update(guncelleme)
    .eq("id", govde.versionId)
    .eq("durum", beklenen)
    .select("id, durum")
    .maybeSingle();

  if (error) {
    // DB guard reddi (ör. dört göz, geçersiz geçiş) iş kuralıdır: 409.
    return NextResponse.json({ hata: error.message }, { status: 409 });
  }
  if (!data) {
    return NextResponse.json(
      { hata: "Sürüm bulunamadı, yetki yok ya da bu eylem için uygun durumda değil." },
      { status: 409 },
    );
  }
  return NextResponse.json({ id: data.id, durum: data.durum });
}
