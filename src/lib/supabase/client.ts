// Tarayıcı (Client Component) tarafı Supabase client'ı.
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseAyarlari } from "./env";

/**
 * Her çağrıda yeni bir client döndürür — createBrowserClient kendi içinde
 * tekilleştirme yapar, bu yüzden modül düzeyinde bir singleton tutmuyoruz.
 * Singleton tutmak, oturum değiştiğinde (çıkış/giriş) eski client'ın elinde
 * kalmasına yol açardı.
 *
 * <Database> ile tiplenir: tablo/kolon adları şemadan gelir, elle yazılmaz —
 * yanlış bir kolon adı derlemede yakalanır, çalışma zamanında boş sonuç
 * olarak değil.
 */
export function createClient() {
  const { url, anonKey } = supabaseAyarlari();
  return createBrowserClient<Database>(url, anonKey);
}
