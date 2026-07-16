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
import { deriveDurumFromEvidenceExpiry } from "./evidence";
import type { Evidence } from "./evidence-types";
import { mockFindings, mockTenantControls } from "./mock-data";
import type { Durum, Finding, TenantControl } from "./types";

const STORAGE_KEY = "kalkan-os-local-store-v1";

interface StoreState {
  tenantControls: TenantControl[];
  findings: Finding[];
  evidencesByControl: Record<string, Evidence[]>;
}

interface StoreApi extends StoreState {
  setDurum: (controlId: string, durum: Durum) => void;
  setNot: (controlId: string, notMetni: string) => void;
  addEvidence: (evidence: Evidence) => void;
  addFinding: (finding: Finding) => void;
  toggleFindingDurum: (findingId: string) => void;
}

function initialState(): StoreState {
  return {
    tenantControls: mockTenantControls,
    findings: mockFindings,
    evidencesByControl: {},
  };
}

// Bu modül yalnızca istemci-taraflı (bkz. layout.tsx'te ssr:false dynamic
// import) render edildiği için window her zaman mevcuttur; yine de savunma
// amaçlı kontrol edilir.
function loadInitialState(): StoreState {
  if (typeof window === "undefined") return initialState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const loaded = raw ? (JSON.parse(raw) as StoreState) : initialState();
  return applyExpiryDowngrades(loaded, new Date());
}

function applyExpiryDowngrades(state: StoreState, asOf: Date): StoreState {
  return {
    ...state,
    tenantControls: state.tenantControls.map((tc) => {
      const evidences = state.evidencesByControl[tc.controlId] ?? [];
      const latest = evidences[evidences.length - 1];
      if (!latest) return tc;
      const durum = deriveDurumFromEvidenceExpiry(tc.durum, latest.gecerlilikBitis, asOf);
      return durum === tc.durum ? tc : { ...tc, durum };
    }),
  };
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

  const addEvidence = useCallback((evidence: Evidence) => {
    setState((s) => {
      const existing = s.evidencesByControl[evidence.controlId] ?? [];
      const nextDurum = deriveDurumFromEvidenceExpiry(
        "karsilaniyor",
        evidence.gecerlilikBitis,
        new Date(),
      );
      return {
        ...s,
        evidencesByControl: {
          ...s.evidencesByControl,
          [evidence.controlId]: [...existing, evidence],
        },
        tenantControls: s.tenantControls.map((tc) =>
          tc.controlId === evidence.controlId
            ? { ...tc, durum: nextDurum, sonDegerlendirme: evidence.createdAt }
            : tc,
        ),
      };
    });
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

  const value = useMemo<StoreApi>(
    () => ({ ...state, setDurum, setNot, addEvidence, addFinding, toggleFindingDurum }),
    [state, setDurum, setNot, addEvidence, addFinding, toggleFindingDurum],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLocalStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useLocalStore, LocalStoreProvider içinde kullanılmalı");
  return ctx;
}
