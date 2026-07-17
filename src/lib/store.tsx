"use client";

// Supabase'e bağlı durum katmanı.
//
// TASARIM: her mutasyon "DB'ye yaz → yeniden oku" yapar. Optimistic update
// yapmıyoruz: bu bir uyum ürünü ve ekranda görünen durumun veritabanındaki
// durum olduğuna güvenilmeli. Optimistic bir güncelleme, RLS tarafından
// reddedilen bir yazmayı kullanıcıya başarılı gibi gösterebilirdi — uyum
// panosunda bu, olmayan bir uyumu iddia etmek demektir.
//
// DENETİM İZİ BURADA YAZILMAZ: audit_log kayıtlarını veritabanı trigger'ları
// üretir (20260717090000_audit_triggers.sql). Buradan yazmak hem çift kayıt
// olurdu hem de izi, her mutasyonu ekleyen kişinin audit satırını da eklemeyi
// hatırlamasına bağlardı.
//
// Durum geçişlerinin saf mantığı (kanıt süresi → durum türetme) hâlâ
// store-logic.ts / evidence.ts'te; burası yalnızca React + Supabase
// bağlantısıdır.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { EVIDENCE_ENVELOPE_SCHEMA } from "./canonical";
import { deriveDurumFromEvidenceExpiry } from "./evidence";
import type { Evidence } from "./evidence-types";
import { findEquivalentControlIds } from "./control-mappings";
import type { StoreState } from "./store-logic";
import { createClient } from "./supabase/client";
import {
  fetchKurum,
  fetchKutuphane,
  fetchStoreState,
  type Kurum,
  type Kutuphane,
} from "./supabase/veri";
import type { Durum, Finding, ShareLink } from "./types";

interface StoreApi extends StoreState {
  kutuphane: Kutuphane;
  kurum: Kurum;
  /** İlk yükleme sürüyor — UI "veri yok" ile "henüz gelmedi"yi ayırabilmeli. */
  yukleniyor: boolean;
  /** Son işlemin hatası; null ise sorun yok. */
  hata: string | null;
  setDurum: (controlId: string, durum: Durum) => Promise<void>;
  setNot: (controlId: string, notMetni: string) => Promise<void>;
  setSorumlu: (controlId: string, sorumluUserId: string | null) => Promise<void>;
  addEvidence: (evidence: Evidence) => Promise<void>;
  addFinding: (finding: Finding) => Promise<void>;
  toggleFindingDurum: (findingId: string) => Promise<void>;
  updateFinding: (findingId: string, patch: Partial<Finding>) => Promise<void>;
  addShareLink: (shareLink: ShareLink) => Promise<void>;
}

const BOS_STATE: StoreState = {
  tenantControls: [],
  findings: [],
  evidencesByControl: {},
  shareLinks: [],
  auditLog: [],
};

const BOS_KUTUPHANE: Kutuphane = { frameworks: [], controls: [], mappings: [] };
const BOS_KURUM: Kurum = { tenant: null, profiller: [] };

const StoreContext = createContext<StoreApi | null>(null);

export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState<StoreState>(BOS_STATE);
  const [kutuphane, setKutuphane] = useState<Kutuphane>(BOS_KUTUPHANE);
  const [kurum, setKurum] = useState<Kurum>(BOS_KURUM);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yenidenYukle = useCallback(async () => {
    const db = createClient();
    const [yeniState, yeniKutuphane, yeniKurum] = await Promise.all([
      fetchStoreState(db),
      fetchKutuphane(db),
      fetchKurum(db),
    ]);
    setState(yeniState);
    setKutuphane(yeniKutuphane);
    setKurum(yeniKurum);
  }, []);

  useEffect(() => {
    // `iptal`: kullanıcı değişirse eski isteğin sonucu yeni kullanıcının
    // ekranına yazılmasın — bir kiracının verisinin diğerinin ekranında
    // belirmesi, bu üründe en pahalı hata türü olurdu.
    let iptal = false;

    // Tüm state yazmaları async akışın içinde: effect gövdesinde senkron
    // setState çağırmak cascading render'a yol açar.
    const yukle = async () => {
      if (!currentUser) {
        // Oturum yoksa RLS zaten hiçbir satır döndürmez; boş state göstermek,
        // önceki kullanıcının verisini ekranda bırakmaktan iyidir.
        if (!iptal) {
          setState(BOS_STATE);
          setKutuphane(BOS_KUTUPHANE);
          setKurum(BOS_KURUM);
          setYukleniyor(false);
        }
        return;
      }

      if (!iptal) setYukleniyor(true);
      try {
        await yenidenYukle();
      } catch (err: unknown) {
        if (!iptal) setHata(err instanceof Error ? err.message : "Veri yüklenemedi.");
      } finally {
        if (!iptal) setYukleniyor(false);
      }
    };

    void yukle();

    return () => {
      iptal = true;
    };
  }, [currentUser, yenidenYukle]);

  /** Yaz → yeniden oku sarmalayıcısı: hata durumunda state'i bozmadan bildirir. */
  const calistir = useCallback(
    async (islem: (db: ReturnType<typeof createClient>, tenantId: string, actorId: string) => Promise<void>) => {
      if (!currentUser) return;
      setHata(null);
      try {
        const db = createClient();
        await islem(db, currentUser.tenantId, currentUser.id);
        await yenidenYukle();
      } catch (err: unknown) {
        setHata(err instanceof Error ? err.message : "İşlem başarısız.");
        // Yeniden yükle: kısmen yazılmış olabilir, ekran DB'yi yansıtsın.
        await yenidenYukle().catch(() => undefined);
      }
    },
    [currentUser, yenidenYukle],
  );

  const setDurum = useCallback(
    (controlId: string, durum: Durum) =>
      calistir(async (db) => {
        const { error } = await db
          .from("tenant_controls")
          .update({ durum })
          .eq("control_id", controlId);
        if (error) throw error;
      }),
    [calistir],
  );

  const setNot = useCallback(
    (controlId: string, notMetni: string) =>
      calistir(async (db) => {
        const { error } = await db
          .from("tenant_controls")
          .update({ not_metni: notMetni || null })
          .eq("control_id", controlId);
        if (error) throw error;
      }),
    [calistir],
  );

  const setSorumlu = useCallback(
    (controlId: string, sorumluUserId: string | null) =>
      calistir(async (db) => {
        const { error } = await db
          .from("tenant_controls")
          .update({ sorumlu_user_id: sorumluUserId })
          .eq("control_id", controlId);
        if (error) throw error;
      }),
    [calistir],
  );

  const addEvidence = useCallback(
    (evidence: Evidence) =>
      calistir(async (db, tenantId, actorId) => {
        // "Bir kanıt, dört çerçeve": eşdeğer kontrollere de yansıt.
        const hedefKontroller = [
          evidence.controlId,
          ...findEquivalentControlIds(evidence.controlId, kutuphane.mappings),
        ];

        for (const controlId of hedefKontroller) {
          const { error } = await db.from("evidences").insert({
            tenant_id: tenantId,
            control_id: controlId,
            tip: evidence.tip,
            storage_path: evidence.storagePathOrLink || null,
            hash_sha256: evidence.hashSha256,
            yukleyen: actorId,
            gecerlilik_bitis: evidence.gecerlilikBitis,
            // --- Zarf alanları (M9) ---
            // Bunlar UYDURULMUYOR: mime/boyut dosyanın kendisinden, sınıf ve
            // saklama süresi kullanıcının formda verdiği cevaptan geliyor.
            envelope_schema_version: EVIDENCE_ENVELOPE_SCHEMA,
            mime_type: evidence.mimeType,
            file_size: evidence.fileSize,
            classification: evidence.classification,
            retention_class: evidence.retentionClass,
            captured_at: evidence.capturedAt,
            // source_system: kanıt bir dış sistemden otomatik çekilmiyor;
            // elle yükleniyor. "MANUEL" gibi bir değer yazmak, olmayan bir
            // kaynak sistemi varmış gibi gösterirdi — null doğru cevap.
            source_system: null,
            // storage_object_key/storage_version_id: uygulama dosyayı
            // Storage'a YÜKLEMİYOR (bkz. 20260717190000). Dosya adını
            // "storage anahtarı" diye yazmak, olmayan bir nesneye işaret eden
            // bir iddia olurdu.
            storage_object_key: null,
            storage_version_id: null,
          });
          if (error) throw error;

          // Kanıt geldi: kontrolün durumu kanıtın geçerliliğine göre türetilir.
          const yeniDurum = deriveDurumFromEvidenceExpiry(
            "karsilaniyor",
            evidence.gecerlilikBitis,
            new Date(),
          );
          const { error: tcError } = await db
            .from("tenant_controls")
            .update({ durum: yeniDurum, son_degerlendirme: new Date().toISOString() })
            .eq("control_id", controlId);
          if (tcError) throw tcError;
        }
      }),
    [calistir, kutuphane.mappings],
  );

  const addFinding = useCallback(
    (finding: Finding) =>
      calistir(async (db, tenantId) => {
        const { error } = await db.from("findings").insert({
          tenant_id: tenantId,
          kaynak: finding.kaynak,
          onem: finding.onem,
          baslik: finding.baslik,
          aksiyon_plani: finding.aksiyonPlani,
          yk_onay_tarihi: finding.ykOnayTarihi,
          hedef_kapama: finding.hedefKapama,
          durum: finding.durum,
        });
        if (error) throw error;
      }),
    [calistir],
  );

  const toggleFindingDurum = useCallback(
    (findingId: string) =>
      calistir(async (db) => {
        const mevcut = state.findings.find((f) => f.id === findingId);
        if (!mevcut) return;

        const { error } = await db
          .from("findings")
          .update({ durum: mevcut.durum === "acik" ? "kapali" : "acik" })
          .eq("id", findingId);
        if (error) throw error;
      }),
    [calistir, state.findings],
  );

  const updateFinding = useCallback(
    (findingId: string, patch: Partial<Finding>) =>
      calistir(async (db) => {
        const { error } = await db
          .from("findings")
          .update({
            ...(patch.baslik !== undefined ? { baslik: patch.baslik } : {}),
            ...(patch.onem !== undefined ? { onem: patch.onem } : {}),
            ...(patch.kaynak !== undefined ? { kaynak: patch.kaynak } : {}),
            ...(patch.aksiyonPlani !== undefined ? { aksiyon_plani: patch.aksiyonPlani } : {}),
            ...(patch.hedefKapama !== undefined ? { hedef_kapama: patch.hedefKapama } : {}),
            ...(patch.ykOnayTarihi !== undefined ? { yk_onay_tarihi: patch.ykOnayTarihi } : {}),
            ...(patch.durum !== undefined ? { durum: patch.durum } : {}),
          })
          .eq("id", findingId);
        if (error) throw error;
      }),
    [calistir],
  );

  const addShareLink = useCallback(
    (shareLink: ShareLink) =>
      calistir(async (db, tenantId, actorId) => {
        const { error } = await db.from("share_links").insert({
          tenant_id: tenantId,
          token: shareLink.token,
          kapsam: { frameworkId: shareLink.kapsam.frameworkId },
          olusturan: actorId,
          son_gecerlilik: shareLink.sonGecerlilik,
        });
        if (error) throw error;
      }),
    [calistir],
  );

  const value = useMemo<StoreApi>(
    () => ({
      ...state,
      kutuphane,
      kurum,
      yukleniyor,
      hata,
      setDurum,
      setNot,
      setSorumlu,
      addEvidence,
      addFinding,
      toggleFindingDurum,
      updateFinding,
      addShareLink,
    }),
    [
      state,
      kutuphane,
      kurum,
      yukleniyor,
      hata,
      setDurum,
      setNot,
      setSorumlu,
      addEvidence,
      addFinding,
      toggleFindingDurum,
      updateFinding,
      addShareLink,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLocalStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useLocalStore, LocalStoreProvider içinde kullanılmalı");
  return ctx;
}
