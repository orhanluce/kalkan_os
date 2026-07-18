// Politika sürüm onayı (G2, M34 v2) — ÇOKLU BAĞIMSIZ onay + dört göz.
//
// İki adım tek istekte: (1) onay kaydını yaz (guard: onaylayan ≠ hazırlayan,
// sürüm IN_REVIEW, kimlik atfı oturum sahibine sabit); (2) gerekli bağımsız
// onay sayısı dolduysa IN_REVIEW→APPROVED geçir. Geçiş guard'ı eşiği BAĞIMSIZ
// yeniden doğrular (savunma derinliği). Tenant tablosu — service_role YOK.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    karar?: "APPROVE" | "REJECT";
    gerekce?: string;
  };
  if (!govde.versionId) {
    return NextResponse.json({ hata: "versionId zorunlu." }, { status: 400 });
  }
  const karar = govde.karar ?? "APPROVE";

  // (1) Onay kaydı — kimlik atfı oturum sahibine sabit (RLS with check + guard).
  const { error: onayErr } = await db.from("policy_approvals").insert({
    tenant_id: (await db.from("profiles").select("tenant_id").eq("id", user.id).single()).data!.tenant_id,
    policy_version_id: govde.versionId,
    approver: user.id,
    karar,
    gerekce: govde.gerekce ?? null,
  });
  if (onayErr) {
    // Dört göz / IN_REVIEW dışı / tekrar onay → iş kuralı (409).
    return NextResponse.json({ hata: onayErr.message }, { status: 409 });
  }

  if (karar === "REJECT") {
    return NextResponse.json({ onaylandi: false, karar });
  }

  // (2) Eşik dolduysa APPROVED'a geçir (guard eşiği bağımsız doğrular).
  const { data: gecis } = await db
    .from("policy_versions")
    .update({ durum: "APPROVED" })
    .eq("id", govde.versionId)
    .eq("durum", "IN_REVIEW")
    .select("id, durum")
    .maybeSingle();

  return NextResponse.json({ onaylandi: true, durum: gecis?.durum ?? "IN_REVIEW" });
}
