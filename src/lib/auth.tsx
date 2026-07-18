"use client";

// Gerçek kimlik doğrulama: Supabase Auth + profiles tablosu.
//
// İKİ PARÇA, İKİ AYRI KAYNAK:
//   - Supabase Auth (auth.users): kimlik — "bu kişi kim".
//   - profiles: yetki bağlamı — hangi kiracı, hangi rol.
// İkisi ayrıdır çünkü rol/tenant bilgisini oturuma (JWT'ye) gömmek, rol
// değiştiğinde eski token'ın eski yetkiyle dolaşmasına yol açardı. profiles
// her istekte RLS tarafından okunur; tek doğru kaynak orasıdır.
//
// GÜVENLİK SINIRI: buradaki currentUser bir GÖRÜNTÜDÜR. UI'ı ona göre
// çizmek meşru, ama yetkilendirmeyi ona dayamak değil — istemci state'i
// kullanıcı tarafından değiştirilebilir. Gerçek sınır RLS'tir
// (CLAUDE.md kural 1).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "./supabase/client";
import { temaCookieYaz, temayiUygula, type TemaTercihi } from "./tema";
import type { Profile } from "./types";

interface AuthApi {
  currentUser: Profile | null;
  /** İlk oturum kontrolü sürerken true — UI "giriş yapılmamış" diye yanılmasın. */
  yukleniyor: boolean;
  login: (email: string, sifre: string) => Promise<{ ok: boolean; error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const profiliYukle = useCallback(async (userId: string, email: string): Promise<Profile | null> => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, tenant_id, role, full_name, tema_tercihi")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;

    // Oturum açıkken profildeki tema tercihi cookie'ye ÜSTÜN gelir
    // (master talimat §6, ADR-T2) — uygula ve cookie'yi senkronla ki
    // oturumsuz sayfalar/ilk paint da aynı temayı görsün.
    const temaTercihi = (data.tema_tercihi ?? "system") as TemaTercihi;
    temayiUygula(temaTercihi);
    temaCookieYaz(temaTercihi);

    return {
      id: data.id,
      tenantId: data.tenant_id,
      role: data.role as Profile["role"],
      // full_name şemada nullable: adı girilmemiş kullanıcı için e-posta
      // göstermek, arayüzde boş bir isim alanından iyidir.
      fullName: data.full_name ?? email,
      email,
      temaTercihi,
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // onAuthStateChange ilk çağrıda mevcut oturumu da verir, bu yüzden
    // ayrıca getSession() çağırmıyoruz — ikisi birlikte yarış oluştururdu.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setCurrentUser(null);
        setYukleniyor(false);
        return;
      }
      setCurrentUser(await profiliYukle(session.user.id, session.user.email ?? ""));
      setYukleniyor(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [profiliYukle]);

  async function login(email: string, sifre: string) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: sifre,
    });

    if (error || !data.user) {
      // Hata metni Supabase'den geldiği gibi gösterilmez: "user not found" ile
      // "wrong password" ayrımı, saldırgana hangi e-postaların kayıtlı
      // olduğunu söyler (kullanıcı numaralandırma).
      return { ok: false, error: "E-posta veya şifre hatalı." };
    }

    const profile = await profiliYukle(data.user.id, data.user.email ?? "");
    if (!profile) {
      // Auth kullanıcısı var ama profili yok: yetki bağlamı olmadan
      // uygulamada hiçbir şey göremez. Oturumu açık bırakmak, kullanıcıyı
      // her sayfası boş bir uygulamada dolaştırırdı.
      await supabase.auth.signOut();
      return {
        ok: false,
        error: "Hesabınız henüz bir kuruma bağlanmamış. Kurum yöneticinizle görüşün.",
      };
    }

    setCurrentUser(profile);
    return { ok: true, error: null };
  }

  async function logout() {
    await createClient().auth.signOut();
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, yukleniyor, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  return ctx;
}
