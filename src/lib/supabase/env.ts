// Supabase bağlantı ayarlarının okunması.
//
// NEDEN AÇIK KONTROL: NEXT_PUBLIC_* değişkenleri build sırasında koda gömülür;
// eksik olduklarında değer `undefined` olur ve Supabase client'ı "Invalid URL"
// gibi bağlamsız bir hatayla patlar. Burada erken ve söylediği şeyi söyleyen
// bir hata veriyoruz — eksik ayar, kod hatası gibi görünmesin.

export interface SupabaseAyarlari {
  url: string;
  anonKey: string;
}

/**
 * anon key GİZLİ DEĞİLDİR: tarayıcıya gider ve gitmesi beklenir. Güvenliği
 * RLS sağlar, anahtarın gizliliği değil (bkz. supabase/migrations — her
 * tabloda tenant_id + RLS, CLAUDE.md kural 1). service_role anahtarı ise
 * RLS'i bypass eder ve ASLA bu dosyadan okunmaz — o yalnızca sunucu
 * script'lerinde (scripts/) kullanılır.
 */
export function supabaseAyarlari(): SupabaseAyarlari {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const eksik = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean);

    throw new Error(
      `Supabase ayarları eksik: ${eksik.join(", ")}. ` +
        `.env.local dosyasını .env.example'a göre doldurun.`,
    );
  }

  return { url, anonKey };
}
