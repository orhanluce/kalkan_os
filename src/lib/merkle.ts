// Merkle ağacı: kabul edilmiş kanıt hash'lerini tek bir köke bağlar
// (docs/ROADMAP.md M5.5). Kök tek başına sabitlenince (anchor), o partideki
// HER kanıt için "şu tarihte vardı ve o günden beri değişmedi" kanıtı
// üretilebilir — kanıt başına ayrı zaman damgası almaya gerek kalmaz.
//
// AĞAÇ YAPISI RFC 6962'yi (Certificate Transparency, §2.1) izler. Kendi
// şemamızı uydurmuyoruz, çünkü naif Merkle kurgularının iki bilinen açığı
// var ve ikisini de bu spesifikasyon kapatıyor:
//
//   1. Alan ayrımı (domain separation): yaprak 0x00, iç düğüm 0x01 ön ekiyle
//      hash'lenir. Olmasaydı, bir iç düğümün hash'i bir yaprak verisi gibi
//      sunulabilir ve farklı bir ağaç aynı kökü verebilirdi (ikinci önimge).
//   2. Bölme noktası 2'nin kuvvetidir. Yaygın "tek kalırsa son yaprağı
//      kopyala" yaklaşımı, farklı yaprak listelerinin aynı kökü üretmesine
//      yol açar (Bitcoin CVE-2012-2459) — burada kopyalama yok.
//
// SPESİFİKASYONDAN AYRILDIĞIMIZ TEK YER: inclusion proof serileştirmesi.
// RFC 6962 doğrulamayı yaprak indeksi ve ağaç boyutu üzerinden bit
// aritmetiğiyle yapar; biz her adımda kardeşin hangi tarafta olduğunu
// AÇIKÇA taşıyoruz. Ürettiği kök birebir aynı — yalnızca proof'un kendisi
// kendini açıklar hale gelir ve doğrulama tarafı sessizce yanlış
// yazılabilecek bir indeks aritmetiği barındırmaz. Bağımsız doğrulama
// (denetçi tarafı) bu kodun okunabilirliğine bağlı olduğu için bu takas
// bilinçlidir.
//
// SHA-256 platformun Web Crypto'sundan gelir; burada hiçbir kriptografik
// ilkel elle yazılmamıştır (CLAUDE.md / güvenlik gereksinimi 10.3).

const LEAF_PREFIX = 0x00;
const NODE_PREFIX = 0x01;

/** Proof adımı: kardeş hash'i ve kardeşin birleştirmedeki tarafı. */
export interface ProofStep {
  hash: string;
  yon: "sol" | "sag";
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`Gecersiz hex: uzunluk ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Uint8Array -> ArrayBuffer: subarray'li bir görünüm gelirse buffer'ın
  // tamamı hash'lenmesin.
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return new Uint8Array(digest);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function leafHash(data: Uint8Array): Promise<Uint8Array> {
  return sha256(concat(new Uint8Array([LEAF_PREFIX]), data));
}

function nodeHash(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  return sha256(concat(new Uint8Array([NODE_PREFIX]), left, right));
}

/** n'den küçük en büyük 2'nin kuvveti (RFC 6962'deki k). n > 1 olmalı. */
function splitPoint(n: number): number {
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

async function rootOf(leaves: Uint8Array[]): Promise<Uint8Array> {
  if (leaves.length === 0) return sha256(new Uint8Array(0));
  if (leaves.length === 1) return leafHash(leaves[0]);
  const k = splitPoint(leaves.length);
  return nodeHash(await rootOf(leaves.slice(0, k)), await rootOf(leaves.slice(k)));
}

/**
 * Yaprak hash'lerinden (hex) Merkle kökünü üretir.
 *
 * Yaprak SIRASI köke dahildir: aynı kanıt kümesi farklı sırayla farklı kök
 * verir. Çağıran taraf bu yüzden deterministik bir sıra sağlamalıdır
 * (bkz. anchor.ts — partiler seq'e göre sıralanır).
 */
export async function merkleRootHex(leafHashesHex: string[]): Promise<string> {
  return bytesToHex(await rootOf(leafHashesHex.map(hexToBytes)));
}

async function pathTo(leaves: Uint8Array[], index: number): Promise<ProofStep[]> {
  if (leaves.length <= 1) return [];
  const k = splitPoint(leaves.length);
  if (index < k) {
    const kardes = await rootOf(leaves.slice(k));
    return [...(await pathTo(leaves.slice(0, k), index)), { hash: bytesToHex(kardes), yon: "sag" }];
  }
  const kardes = await rootOf(leaves.slice(0, k));
  return [...(await pathTo(leaves.slice(k), index - k)), { hash: bytesToHex(kardes), yon: "sol" }];
}

/** Verilen yaprağın ağaçta bulunduğunu kanıtlayan adımlar (yapraktan köke). */
export async function inclusionProof(leafHashesHex: string[], index: number): Promise<ProofStep[]> {
  if (index < 0 || index >= leafHashesHex.length) {
    throw new Error(`Yaprak indeksi kapsam disi: ${index} / ${leafHashesHex.length}`);
  }
  return pathTo(leafHashesHex.map(hexToBytes), index);
}

/**
 * Bir yaprağın verilen köke ait olduğunu, ağacın tamamına sahip OLMADAN
 * doğrular. Bağımsız denetçinin çalıştırdığı asıl fonksiyon budur: elinde
 * yalnızca kanıtın hash'i, proof adımları ve sabitlenmiş kök vardır.
 */
export async function verifyInclusion(
  leafHashHex: string,
  proof: ProofStep[],
  rootHex: string,
): Promise<boolean> {
  let acc = await leafHash(hexToBytes(leafHashHex));
  for (const step of proof) {
    const kardes = hexToBytes(step.hash);
    acc = step.yon === "sol" ? await nodeHash(kardes, acc) : await nodeHash(acc, kardes);
  }
  return bytesToHex(acc) === rootHex;
}
