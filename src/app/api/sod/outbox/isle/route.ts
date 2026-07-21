// SoD transactional-outbox drenajı (docs/ROADMAP.md M16 PR-3B).
//
// Apply, "atamalar içe aktarıldı → SoD yeniden değerlendirilmeli" olayını
// sod_outbox'a AYNI transaction'da yazar (kayıp yok). Bu rota bekleyen olayları
// çeker, BİR değerlendirme koşusu çalıştırır (koşu zaten tüm güncel durumu
// kapsar) ve olayları DONE'a taşır. Değerlendirmenin kendisi src/lib/sod-kosu.ts
// ortak yardımcısında — elle "Değerlendir" ile AYNI mantık (tek kaynak).
//
// NEDEN KUYRUK DEĞİL, TABLO (kural 4): saf Postgres kal — BullMQ/Redis yok.
// Drenaj bugün elle/rota ile; zamanlanmış tetik (pg_cron TS koşamaz, bir cron
// bu rotayı çağırır) sonraki tur (#5 SoD değerlendirme tetikleri).
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sodKosuyuYurut } from "@/lib/sod-kosu";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "Outbox drenajı yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });
  const tenantId = profil.tenant_id;

  // RLS altında oku: yalnız bu kiracının bekleyen olayları.
  const { data: bekleyen } = await db
    .from("sod_outbox")
    .select("id")
    .eq("durum", "PENDING")
    .order("created_at", { ascending: true });

  const idler = (bekleyen ?? []).map((e) => e.id);
  if (idler.length === 0) {
    return NextResponse.json({ islenen: 0, calistirmaId: null });
  }

  // Değerlendirmeyi kullanıcının KENDİ oturumuyla koş: RLS + audit atıfı doğru.
  const { sonuc, hata } = await sodKosuyuYurut(db, tenantId, user.id);
  if (hata || !sonuc) {
    // Değerlendirme başarısız: olaylar PENDING kalır (bir sonraki drenajda
    // yeniden denenir) — outbox'ın anlamı budur, olay kaybolmaz.
    return NextResponse.json({ hata: hata ?? "Değerlendirme çalıştırılamadı." }, { status: 500 });
  }

  // Olayları DONE'a taşı (yalnız service_role — istemci UPDATE edemez).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ hata: "Sunucu yapılandırması eksik." }, { status: 500 });
  }
  const admin = createServiceClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  const { error: updErr } = await admin
    .from("sod_outbox")
    .update({
      durum: "DONE",
      islenme_at: new Date().toISOString(),
      degerlendirme_calistirma_id: sonuc.calistirmaId,
    })
    .in("id", idler)
    .eq("durum", "PENDING");
  if (updErr) {
    return NextResponse.json({ hata: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    islenen: idler.length,
    calistirmaId: sonuc.calistirmaId,
    bulunanSayisi: sonuc.bulunanSayisi,
    yeniSayisi: sonuc.yeniSayisi,
  });
}
