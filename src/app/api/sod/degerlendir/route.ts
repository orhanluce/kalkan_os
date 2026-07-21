// SoD değerlendirmesini elle çalıştırır (docs/ROADMAP.md M16, kural 11).
//
// Koşunun kendisi (kural/atama çekme, motor, koşu kaydı, çatışma upsert)
// src/lib/sod-kosu.ts'te ORTAK yardımcıda — aynı koşu import sonrası outbox
// drenajından da tetiklenir (PR-3B). Bu rota yalnız yetki + tetik.
//
// ARTIK MEVCUT OLMAYAN ÇATIŞMALARI SİLMEZ (kurucu talimatı): motor yalnızca
// BULUNAN çatışmaları döndürür; DB'de olup bu koşuda bulunmayanlar OLDUĞU
// GİBİ bırakılır. Kapanışı yalnız insan/guard kararı yapar (append-only'nin
// ruhu, kural 2).
import { NextResponse } from "next/server";
import { sodTamMi } from "@/lib/entitlement";
import { entitlementGerekli } from "@/lib/entitlement-server";
import { sodKosuyuYurut } from "@/lib/sod-kosu";
import { createClient } from "@/lib/supabase/server";

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
      { hata: "Değerlendirme çalıştırma yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }
  if (!profil.tenant_id) return NextResponse.json({ hata: "Kurum bağlamı çözülemedi." }, { status: 400 });

  // ENTITLEMENT (V2 PR-2c): SoD değerlendirme YAZMA işlemi tam SoD ister.
  // Starter planı yalnız "gorunum" (okuma) alır → 402. Aboneliği olmayan
  // (pilot/mevcut) kiracı VARSAYILAN ile izinli — mevcut davranış korunur.
  // Yetki UI'da gizlense bile burada sunucu tarafında yeniden doğrulanır.
  if (!(await entitlementGerekli(db, profil.tenant_id, sodTamMi))) {
    return NextResponse.json(
      { hata: "Planınız SoD değerlendirmesini kapsamıyor (yalnız görünüm). Yükseltme gerekir.", kod: "ENTITLEMENT_YOK" },
      { status: 402 },
    );
  }

  const { sonuc, hata } = await sodKosuyuYurut(db, profil.tenant_id, user.id);
  if (hata || !sonuc) {
    return NextResponse.json({ hata: hata ?? "Değerlendirme çalıştırılamadı." }, { status: 500 });
  }

  // Aktivasyon (ADR-V2-5): ilk SoD değerlendirmesi TTV kilometre taşı. PII yok.
  await db
    .from("activation_events")
    .insert({ tenant_id: profil.tenant_id, event_type: "FIRST_SOD_EVALUATION", meta: { bulunan: sonuc.bulunanSayisi } });

  return NextResponse.json({
    calistirmaId: sonuc.calistirmaId,
    bulunanSayisi: sonuc.bulunanSayisi,
    yeniSayisi: sonuc.yeniSayisi,
  });
}
