// Supabase satırları <-> domain tipleri arasındaki veri erişim katmanı.
//
// Buradaki her sorgu RLS ALTINDA koşar (anon key + kullanıcı oturumu):
// tenant_id filtresi eklemiyoruz çünkü politikalar zaten kiracıyı sınırlar.
// Elle filtre eklemek, güvenliğin sorguyu yazanın dikkatine bağlı olduğu
// izlenimi yaratırdı — oysa RLS testleri (rls-tenant-izolasyonu.test.ts)
// başka kiracının satırının hiçbir sorguyla dönmediğini kanıtlıyor.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evidence } from "../evidence-types";
import type { StoreState } from "../store-logic";
import type {
  AuditEylem,
  AuditLogEntry,
  Control,
  ControlMapping,
  Durum,
  Finding,
  Framework,
  Profile,
  Tenant,
  TenantControl,
} from "../types";
import type { Database } from "./database.types";

export type Db = SupabaseClient<Database>;

/** Kontrol kütüphanesi: tüm kiracılar için ortak referans veri. */
export interface Kutuphane {
  frameworks: Framework[];
  controls: Control[];
  mappings: ControlMapping[];
}

export async function fetchKutuphane(db: Db): Promise<Kutuphane> {
  const [fw, ctrl, map] = await Promise.all([
    // order olmadan Postgres'in dönüş sırası tanımsızdır (genelde ekleme
    // sırası, ama garanti değil) — bu, "varsayılan seçili çerçeve" gibi bir
    // UI davranışını sayfa yüklemesi başına DEĞİŞEBİLİR hale getirirdi.
    db.from("frameworks").select("id, code, name, version, yururluk_tarihi").order("code"),
    db.from("controls").select("id, framework_id, madde_ref, baslik, aciklama, kanit_tipi, periyot, kritiklik"),
    db.from("control_mappings").select("id, control_id_a, control_id_b, iliski"),
  ]);

  if (fw.error) throw fw.error;
  if (ctrl.error) throw ctrl.error;
  if (map.error) throw map.error;

  return {
    frameworks: (fw.data ?? []).map((r) => ({
      id: r.id,
      code: r.code as Framework["code"],
      name: r.name,
      version: r.version,
      yururlukTarihi: r.yururluk_tarihi,
    })),
    controls: (ctrl.data ?? []).map((r) => ({
      id: r.id,
      frameworkId: r.framework_id,
      maddeRef: r.madde_ref,
      baslik: r.baslik,
      aciklama: r.aciklama ?? "",
      kanitTipi: (r.kanit_tipi ?? []) as Control["kanitTipi"],
      periyot: r.periyot as Control["periyot"],
      kritiklik: r.kritiklik as Control["kritiklik"],
    })),
    mappings: (map.data ?? []).map((r) => ({
      id: r.id,
      controlIdA: r.control_id_a,
      controlIdB: r.control_id_b,
      iliski: r.iliski as ControlMapping["iliski"],
    })),
  };
}

/**
 * Kiracıya özel bağlam: kurum kaydı ve kiracının kullanıcıları.
 *
 * RLS sayesinde her ikisi de kendiliğinden kiracıyla sınırlıdır: tenants
 * yalnızca kullanıcının kendi kurumunu, profiles yalnızca aynı kurumun
 * üyelerini döndürür.
 */
export interface OrganizasyonProfili {
  organizationType: string;
  financeDepartmentEnabled: boolean;
  profilTamamlandiMi: boolean;
}

export interface Kurum {
  tenant: Tenant | null;
  profiller: Profile[];
  // null = profil henüz yok (onboarding gösterilmeli). RLS altında yalnız
  // kendi kiracısının profili döner.
  organizasyon: OrganizasyonProfili | null;
}

export async function fetchKurum(db: Db): Promise<Kurum> {
  const [t, p, o] = await Promise.all([
    db.from("tenants").select("id, name, segment, created_at").maybeSingle(),
    db.from("profiles").select("id, tenant_id, role, full_name"),
    db
      .from("organization_profiles")
      .select("organization_type, finance_department_enabled, profil_tamamlandi_at")
      .maybeSingle(),
  ]);

  if (t.error) throw t.error;
  if (p.error) throw p.error;
  // o.error: tablo yeni; profil yoksa maybeSingle null döner (hata değil).

  return {
    tenant: t.data
      ? {
          id: t.data.id,
          name: t.data.name,
          segment: t.data.segment as Tenant["segment"],
          createdAt: t.data.created_at,
        }
      : null,
    organizasyon: o.data
      ? {
          organizationType: o.data.organization_type,
          financeDepartmentEnabled: o.data.finance_department_enabled,
          profilTamamlandiMi: o.data.profil_tamamlandi_at !== null,
        }
      : null,
    profiller: (p.data ?? []).map((r) => ({
      id: r.id,
      // RLS (profiles_select_same_tenant) yalnız AYNI tenant'ın satırlarını
      // döndürür — platform_operator (tenant_id null) burada asla görünmez.
      tenantId: r.tenant_id!,
      role: r.role as Profile["role"],
      fullName: r.full_name ?? "(isimsiz)",
      // E-posta auth.users'ta ve RLS ile client'a AÇILMAZ: bir kullanıcının
      // e-postası, onu tanımlayan kişisel veridir ve kontrol atama ekranında
      // ada bakmak yeterlidir (CLAUDE.md kural 7 / veri minimizasyonu).
      email: "",
    })),
  };
}

export async function fetchStoreState(db: Db): Promise<StoreState> {
  const [tc, ev, fnd, audit, share] = await Promise.all([
    db.from("tenant_controls").select("id, tenant_id, control_id, durum, sorumlu_user_id, son_degerlendirme, not_metni"),
    db.from("evidences").select("id, tenant_id, control_id, tip, storage_path, hash_sha256, yukleyen, gecerlilik_bitis, created_at, mime_type, file_size, classification, retention_class, captured_at, storage_object_key"),
    db.from("findings").select("id, tenant_id, kaynak, onem, baslik, aksiyon_plani, yk_onay_tarihi, hedef_kapama, durum"),
    db.from("audit_log").select("id, tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay, created_at").order("seq", { ascending: false }),
    db.from("share_links").select("id, tenant_id, token, kapsam, olusturan, son_gecerlilik, created_at"),
  ]);

  if (tc.error) throw tc.error;
  if (ev.error) throw ev.error;
  if (fnd.error) throw fnd.error;
  if (audit.error) throw audit.error;
  if (share.error) throw share.error;

  const evidencesByControl: Record<string, Evidence[]> = {};
  for (const r of ev.data ?? []) {
    const evidence: Evidence = {
      id: r.id,
      controlId: r.control_id,
      tip: r.tip as Evidence["tip"],
      storagePathOrLink: r.storage_path ?? "",
      hashSha256: r.hash_sha256,
      gecerlilikBitis: r.gecerlilik_bitis,
      createdAt: r.created_at,
      // Zarf alanları (M9). LEGACY kayıtlarda null gelir ve null kalır —
      // okuma katmanında varsayılan atamak, zarfsız bir kanıtı zarflıymış
      // gibi gösterirdi.
      mimeType: r.mime_type,
      fileSize: r.file_size,
      classification: r.classification as Evidence["classification"],
      retentionClass: r.retention_class as Evidence["retentionClass"],
      capturedAt: r.captured_at,
      storageObjectKey: r.storage_object_key,
      // ŞEMA EKSİĞİ: evidences tablosunda kaynak_kontrol_id kolonu yok, bu
      // yüzden "bir kanıt, dört çerçeve" yansıtmasında kanıtın hangi
      // kontrolden geldiği DB'de kaybolur (audit_log detayında duruyor ama
      // orası sorgulanacak yer değil). Yansıtılan kanıt, doğrudan yüklenmiş
      // gibi görünür. Kolon eklenene kadar null.
      kaynakKontrolId: null,
    };
    (evidencesByControl[r.control_id] ??= []).push(evidence);
  }

  return {
    tenantControls: (tc.data ?? []).map(
      (r): TenantControl => ({
        id: r.id,
        tenantId: r.tenant_id,
        controlId: r.control_id,
        durum: r.durum as Durum,
        sorumluUserId: r.sorumlu_user_id,
        sonDegerlendirme: r.son_degerlendirme,
        notMetni: r.not_metni,
      }),
    ),
    findings: (fnd.data ?? []).map(
      (r): Finding => ({
        id: r.id,
        tenantId: r.tenant_id,
        kaynak: r.kaynak as Finding["kaynak"],
        onem: r.onem as Finding["onem"],
        baslik: r.baslik,
        aksiyonPlani: r.aksiyon_plani,
        ykOnayTarihi: r.yk_onay_tarihi,
        hedefKapama: r.hedef_kapama,
        durum: r.durum as Finding["durum"],
      }),
    ),
    evidencesByControl,
    shareLinks: (share.data ?? []).map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      token: r.token,
      kapsam: r.kapsam as { frameworkId: string },
      olusturan: r.olusturan,
      sonGecerlilik: r.son_gecerlilik,
      createdAt: r.created_at,
    })),
    auditLog: (audit.data ?? []).map(
      (r): AuditLogEntry => ({
        id: r.id,
        tenantId: r.tenant_id,
        actorId: r.actor_id,
        eylem: r.eylem as AuditEylem,
        hedefTablo: r.hedef_tablo,
        hedefId: r.hedef_id,
        detay: r.detay as Record<string, unknown> | null,
        createdAt: r.created_at,
      }),
    ),
  };
}

// NOT: burada audit_log'a yazan bir fonksiyon YOKTUR ve olmamalıdır.
// Denetim kayıtlarını veritabanı trigger'ları üretir
// (supabase/migrations/20260717090000_audit_triggers.sql) ve istemcinin
// insert yetkisi kaldırılmıştır. Böylece iz, ana yazmayla aynı transaction'da
// oluşur ve yeni bir kod yolu onu atlayamaz.
