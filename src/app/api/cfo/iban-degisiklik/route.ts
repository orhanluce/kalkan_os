// Tedarikçi IBAN değişikliği doğrulama TALEBİ (V2 PR-3a, ADR-V2-4).
//
// VERİ MİNİMİZASYONU: istemci tam IBAN'ı GÖNDERMEZ — maske + sha256 hash'i
// tarayıcıda hesaplayıp yollar (bkz. src/lib/iban.ts). Bu rota tam IBAN'ı ne
// alır ne saklar. Talep, oturum sahibi adına açılır (RLS: talep_eden=auth.uid).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const govde = (await req.json().catch(() => ({}))) as {
    tedarikciAd?: string;
    yeniIbanMaskeli?: string;
    yeniIbanHash?: string;
    eskiIbanMaskeli?: string | null;
    eskiIbanHash?: string | null;
    outOfBandKanal?: string;
  };
  if (!govde.tedarikciAd?.trim() || !govde.yeniIbanMaskeli || !govde.yeniIbanHash || !govde.outOfBandKanal?.trim()) {
    return NextResponse.json({ hata: "Tedarikçi, yeni IBAN ve doğrulama kanalı zorunlu." }, { status: 400 });
  }
  // Savunma: tam IBAN kaçağı — maske '*' içermeli, hash 64-hex olmalı.
  if (!govde.yeniIbanMaskeli.includes("*") || !/^[0-9a-f]{64}$/.test(govde.yeniIbanHash)) {
    return NextResponse.json({ hata: "IBAN maskeli ve hash'li gönderilmelidir (tam IBAN kabul edilmez)." }, { status: 400 });
  }

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ hata: "Oturum gerekli." }, { status: 401 });
  }
  const { data: profil } = await db.from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
  if (profil?.role !== "admin" && profil?.role !== "uyum") {
    return NextResponse.json({ hata: "IBAN değişikliği talebi yalnızca admin veya uyum rolünün işidir." }, { status: 403 });
  }

  const { data, error } = await db
    .from("supplier_bank_change_verifications")
    .insert({
      tenant_id: profil.tenant_id,
      tedarikci_ad: govde.tedarikciAd.trim(),
      yeni_iban_maskeli: govde.yeniIbanMaskeli,
      yeni_iban_hash: govde.yeniIbanHash,
      eski_iban_maskeli: govde.eskiIbanMaskeli ?? null,
      eski_iban_hash: govde.eskiIbanHash ?? null,
      out_of_band_kanal: govde.outOfBandKanal.trim(),
      talep_eden: user.id,
    })
    .select("id")
    .single();
  if (error) {
    return NextResponse.json({ hata: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, durum: "TALEP_EDILDI" });
}
