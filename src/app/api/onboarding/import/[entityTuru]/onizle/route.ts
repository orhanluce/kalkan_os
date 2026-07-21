// Dikey G1: kritik hizmet/kontrol/tedarikçi CSV önizleme (dry-run). Gerçek
// kayıt YAZMAZ — yalnız ayrıştırır + doğrular + hash'ler + saklar
// (onboarding_import_onizlemeleri). Uygulama ayrı bir rota (SoD PR-3A/3B
// deseni: önce dry-run, sonra bağımsız kişi onayı+apply).
import { NextResponse } from "next/server";
import { bytesHash } from "@/lib/canonical";
import { onboardingImportAyristir, type OnboardingEntityTuru } from "@/lib/onboarding-import";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

const GECERLI_TURLER = ["KRITIK_HIZMET", "KONTROL", "TEDARIKCI"] as const;

export async function POST(req: Request, ctx: { params: Promise<{ entityTuru: string }> }) {
  const { entityTuru } = await ctx.params;
  if (!GECERLI_TURLER.includes(entityTuru as OnboardingEntityTuru)) {
    return NextResponse.json({ hata: "Geçersiz varlık türü." }, { status: 400 });
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json({ hata: "İçe aktarma yalnız admin veya uyum rolünün işidir." }, { status: 403 });
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  const govde = (await req.json().catch(() => ({}))) as { csvMetni?: string; kaynak?: string };
  const csvMetni = govde.csvMetni;
  if (typeof csvMetni !== "string" || csvMetni.length === 0) {
    return NextResponse.json({ hata: "csvMetni zorunludur." }, { status: 400 });
  }

  const bytes = new TextEncoder().encode(csvMetni);
  const sonuc = onboardingImportAyristir(entityTuru as OnboardingEntityTuru, csvMetni, bytes.byteLength);
  if (sonuc.dosyaHatasi) {
    return NextResponse.json({ hata: sonuc.dosyaHatasi.neden, kod: sonuc.dosyaHatasi.kod }, { status: 400 });
  }

  const dosyaHash = await bytesHash(bytes);

  const { data: onizleme, error } = await db
    .from("onboarding_import_onizlemeleri")
    .insert({
      tenant_id: profil.tenant_id,
      entity_turu: entityTuru,
      kaynak: govde.kaynak ?? "csv",
      dosya_hash: dosyaHash,
      normalized_records: sonuc.kayitlar as unknown as Json,
      kayit_sayisi: sonuc.kayitlar.length,
      satir_hatalari: sonuc.satirHatalari as unknown as Json,
      durum: sonuc.satirHatalari.length > 0 && sonuc.kayitlar.length === 0 ? "INVALID" : "READY_FOR_REVIEW",
      yukleyen: user.id,
    })
    .select("id, kayit_sayisi, satir_hatalari, durum")
    .single();
  if (error || !onizleme) {
    return NextResponse.json({ hata: error?.message ?? "Önizleme oluşturulamadı." }, { status: 400 });
  }

  return NextResponse.json({ onizleme });
}
