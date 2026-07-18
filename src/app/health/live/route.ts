// Liveness (master talimat §26): process ayakta mı — bağımlılık KONTROL ETMEZ.
// Hostinger/izleme bunun 200 dönmesine bakar; DB çökse bile process canlıysa
// live'dır (readiness ayrı: /health/ready).
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ durum: "canli" });
}
