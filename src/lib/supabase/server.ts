// Sunucu (Server Component / Route Handler / Server Action) tarafı client'ı.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseAyarlari } from "./env";

/**
 * Oturumu cookie'lerden okuyan sunucu client'ı.
 *
 * YALNIZCA getAll/setAll kullanılır — get/set/remove kullanmak @supabase/ssr
 * tarafından desteklenmez ve oturumu sessizce bozar.
 *
 * setAll'ın Server Component içinden çağrılması hata fırlatır (orada cookie
 * yazılamaz). Bunu yutuyoruz, çünkü token yenileme işini proxy.ts üstleniyor;
 * proxy olmasaydı bu yutma gerçek bir oturum kaybını gizlerdi.
 */
export async function createClient() {
  const { url, anonKey } = supabaseAyarlari();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component'ten çağrıldı: proxy.ts oturumu yeniliyor.
        }
      },
    },
  });
}
