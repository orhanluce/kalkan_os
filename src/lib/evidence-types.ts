import type { EvidenceTip } from "./types";

export interface Evidence {
  id: string;
  controlId: string;
  tip: EvidenceTip;
  storagePathOrLink: string;
  hashSha256: string | null;
  gecerlilikBitis: string | null;
  createdAt: string;
}
