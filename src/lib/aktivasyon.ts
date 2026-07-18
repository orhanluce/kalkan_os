// Aktivasyon / time-to-value türetimi (V2 PR-3b, ADR-V2-5). SAF/DETERMİNİSTİK
// (kural 11): olay listesinden TTV metriklerini hesaplar. Olaylar PII taşımaz.

export interface AktivasyonOlayi {
  event_type: string;
  occurred_at: string; // ISO
}

/** Her tür için İLK oluşum zamanı (occurred_at). */
export function ilkOlusumlar(olaylar: AktivasyonOlayi[]): Record<string, string> {
  const ilk: Record<string, string> = {};
  for (const o of olaylar) {
    const mevcut = ilk[o.event_type];
    if (!mevcut || new Date(o.occurred_at) < new Date(mevcut)) {
      ilk[o.event_type] = o.occurred_at;
    }
  }
  return ilk;
}

export interface TtvMetrigi {
  anahtar: string;
  etiket: string;
  /** Profil tamamlanmasından bu olaya kadar geçen saat; null = olay yok. */
  saat: number | null;
}

const KILOMETRE_TASLARI: { anahtar: string; etiket: string }[] = [
  { anahtar: "FIRST_SCOPE_DECISION", etiket: "İlk kapsam kararı" },
  { anahtar: "FIRST_CONTROL", etiket: "İlk kontrol" },
  { anahtar: "FIRST_EVIDENCE", etiket: "İlk kanıt" },
  { anahtar: "FIRST_TEST_RUN", etiket: "İlk test koşusu" },
  { anahtar: "FIRST_SOD_EVALUATION", etiket: "İlk SoD değerlendirmesi" },
  { anahtar: "FIRST_IBAN_VERIFICATION", etiket: "İlk IBAN doğrulaması" },
  { anahtar: "FIRST_AUDIT_PACKAGE", etiket: "İlk denetim paketi" },
];

/**
 * TTV: profil tamamlanmasını (PROFILE_COMPLETED) SIFIR alıp her kilometre
 * taşına kadar geçen saati verir. Profil yoksa tüm metrikler null.
 */
export function ttvMetrikleri(olaylar: AktivasyonOlayi[]): TtvMetrigi[] {
  const ilk = ilkOlusumlar(olaylar);
  const baslangic = ilk.PROFILE_COMPLETED ? new Date(ilk.PROFILE_COMPLETED).getTime() : null;
  return KILOMETRE_TASLARI.map(({ anahtar, etiket }) => {
    if (baslangic === null || !ilk[anahtar]) return { anahtar, etiket, saat: null };
    const saat = (new Date(ilk[anahtar]).getTime() - baslangic) / 3_600_000;
    return { anahtar, etiket, saat: Math.max(0, Math.round(saat * 10) / 10) };
  });
}
