-- AI olayı (incident) için otorite-bildirim süre saati (nihai talimat v3.2
-- §8.0 sonu, sıradaki öncelik #1). M36 ihlal (privacy_incidents) desenini
-- M37'ye taşır: süre SAKLANMAZ, türetilir (src/lib/gizlilik.ts ihlalBildirimSaati,
-- YENİDEN KULLANILIR — ikinci bir saat motoru yazılmaz).
--
-- EŞİK SAYISI NEREDEN GELİR (kural 3 — mevzuat içeriği uydurulmaz): AB AI Act
-- madde 73'ün ciddi-olay bildirim süresi TEK bir sabit sayı değildir (olay
-- türüne göre değişir) ve bu repo lisanslı/doğrulanmış hukuk içeriği olmadan
-- bunu SABİT KOD olarak iddia ETMEZ. Bu yüzden eşik saat, KVKK ihlal desenindeki
-- gibi kodda sabitlenmez — kurumun kendi hukuk/uyum ekibi her olay için AÇIKÇA
-- girer (bildirim_esik_saat, nullable — girilmeden "72 saat" gibi bir varsayım
-- SESSİZCE uygulanmaz). Eşik girilmemişse ekran "belirlenmedi" der, süre
-- hesaplamaz — TODO_DOGRULA ruhuyla aynı dürüstlük.

alter table public.ai_incidents
  add column bildirim_esik_saat integer check (bildirim_esik_saat is null or bildirim_esik_saat > 0);

comment on column public.ai_incidents.bildirim_esik_saat is
  'Otorite bildirim süre eşiği (saat) — kurum kendi hukuk danışmanlığıyla belirler. '
  'AB AI Act madde 73 eşiği olay türüne göre değişir; KALKAN_OS bir sabit sayı UYDURMAZ. '
  'NULL = henüz belirlenmedi (varsayım yapılmaz, ekran açıkça "belirlenmedi" der).';
