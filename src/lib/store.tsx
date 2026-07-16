"use client";

// Tarayıcı-içi, yalnızca localStorage'a yazan geçici durum katmanı.
// Gerçek Supabase bağlanana kadar M2/M3 UI akışlarını (kanıt yükle →
// durum güncellenir, bulgu ekle/kapat) canlandırmak içindir — sekme
// kapatılıp localStorage temizlenirse veri kaybolur, bu bilinçli bir
// sınırdır (bkz. CLAUDE.md "Mevcut aşama").
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Evidence } from "./evidence-types";
import { mockControlMappings, mockFindings, mockTenantControls } from "./mock-data";
import { addEvidenceToState, applyExpiryDowngrades, type StoreState } from "./store-logic";
import type { Durum, Finding, ShareLink } from "./types";

const STORAGE_KEY = "kalkan-os-local-store-v1";

interface StoreApi extends StoreState {
  setDurum: (controlId: string, durum: Durum) => void;
  setNot: (controlId: string, notMetni: string) => void;
  setSorumlu: (controlId: string, sorumluUserId: string | null) => void;
  addEvidence: (evidence: Evidence) => void;
  addFinding: (finding: Finding) => void;
  toggleFindingDurum: (findingId: string) => void;
  updateFinding: (findingId: string, patch: Partial<Finding>) => void;
  addShareLink: (shareLink: ShareLink) => void;
}

function initialState(): StoreState {
  return {
    tenantControls: mockTenantControls,
    findings: mockFindings,
    evidencesByControl: {},
    shareLinks: [],
  };
}

// Bu modül yalnızca istemci-taraflı (bkz. layout.tsx'te ssr:false dynamic
// import) render edildiği için window her zaman mevcuttur; yine de savunma
// amaçlı kontrol edilir.
function loadInitialState(): StoreState {
  if (typeof window === "undefined") return initialState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  // Spread over a fresh initialState() so fields added in later versions of
  // this store (e.g. shareLinks) backfill instead of coming back undefined
  // for a browser that persisted an older shape.
  const loaded = raw ? { ...initialState(), ...(JSON.parse(raw) as StoreState) } : initialState();
  return applyExpiryDowngrades(loaded, new Date());
}

const StoreContext = createContext<StoreApi | null>(null);

export function LocalStoreProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: localStorage'dan oku ve süresi geçmiş kanıtlara göre
  // durumları yeniden hesapla (M2: "günlük cron" yerine sorgu-anında hesap).
  // Bu bileşen yalnızca istemci tarafında render edildiği için (ssr:false)
  // ekstra bir yükleme efekti gerekmiyor.
  const [state, setState] = useState<StoreState>(loadInitialState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setDurum = useCallback((controlId: string, durum: Durum) => {
    setState((s) => ({
      ...s,
      tenantControls: s.tenantControls.map((tc) =>
        tc.controlId === controlId ? { ...tc, durum } : tc,
      ),
    }));
  }, []);

  const setNot = useCallback((controlId: string, notMetni: string) => {
    setState((s) => ({
      ...s,
      tenantControls: s.tenantControls.map((tc) =>
        tc.controlId === controlId ? { ...tc, notMetni } : tc,
      ),
    }));
  }, []);

  const setSorumlu = useCallback((controlId: string, sorumluUserId: string | null) => {
    setState((s) => ({
      ...s,
      tenantControls: s.tenantControls.map((tc) =>
        tc.controlId === controlId ? { ...tc, sorumluUserId } : tc,
      ),
    }));
  }, []);

  const addEvidence = useCallback((evidence: Evidence) => {
    setState((s) => addEvidenceToState(s, evidence, mockControlMappings, new Date()));
  }, []);

  const addFinding = useCallback((finding: Finding) => {
    setState((s) => ({ ...s, findings: [finding, ...s.findings] }));
  }, []);

  const toggleFindingDurum = useCallback((findingId: string) => {
    setState((s) => ({
      ...s,
      findings: s.findings.map((f) =>
        f.id === findingId ? { ...f, durum: f.durum === "acik" ? "kapali" : "acik" } : f,
      ),
    }));
  }, []);

  const updateFinding = useCallback((findingId: string, patch: Partial<Finding>) => {
    setState((s) => ({
      ...s,
      findings: s.findings.map((f) => (f.id === findingId ? { ...f, ...patch } : f)),
    }));
  }, []);

  const addShareLink = useCallback((shareLink: ShareLink) => {
    setState((s) => ({ ...s, shareLinks: [shareLink, ...s.shareLinks] }));
  }, []);

  const value = useMemo<StoreApi>(
    () => ({
      ...state,
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
