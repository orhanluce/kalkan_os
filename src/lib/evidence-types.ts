import type { EvidenceTip } from "./types";

export interface Evidence {
  id: string;
  controlId: string;
  tip: EvidenceTip;
  storagePathOrLink: string;
  hashSha256: string | null;
  gecerlilikBitis: string | null;
  createdAt: string;
  /** "Bir kanıt, dört çerçeve": bu kanıt başka bir kontrole yüklenip
   * eşdeğerlik üzerinden buraya otomatik yansıtıldıysa kaynak kontrolün id'si. */
  kaynakKontrolId: string | null;
}
