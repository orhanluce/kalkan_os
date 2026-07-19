// Şeffaflık defteri transactional-outbox drenajı (nihai talimat v3.2 §8.0).
//
// Domain trigger'ları (test_runs, dsar_fulfillment_packages, ...) AYNI
// transaction'da `ledger_outbox`'a olay yazar. Bu rota bekleyen olayları
// claim eder (RPC: ledger_outbox_claim, race-safe), imzalayıp deftere yazar
// ve artifact_ledger_links'e bağlar — mantık src/lib/ledger-outbox.ts'te (tek
// motor, sod-kosu.ts ile aynı ilke). Manuel çağrı + otomatik (domain rotaları
// kendi yazımından sonra da çağırır) her ikisi de aynı idempotent yola girer.
import { NextResponse } from "next/server";
import { ledgerOutboxDrain } from "@/lib/ledger-outbox";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }

  const { data: profil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json(
      { hata: "Outbox drenajı yalnızca admin veya uyum rolünün işidir." },
      { status: 403 },
    );
  }

  const sonuc = await ledgerOutboxDrain(db, 20);
  return NextResponse.json(sonuc);
}
