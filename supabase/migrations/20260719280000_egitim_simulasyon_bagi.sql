-- M18 "sonraki dilim" borcu (ROADMAP §1.52 sonu, §1.30): "phishing/tabletop =
-- simülasyon (M7-M9) sonucuna gerçek bağ". 20260719060000'de bırakılan not
-- ("phishing/tabletop katılımı konu bazlı gereksinimle temsil edilir; skor
-- tamamlamada") burada gerçekleşiyor.
--
-- ÖNCESİ: bir kullanıcı bir tatbikata (S01..S05) katılsa bile bunun "eğitim
-- tamamlama" sayılması için bir uyum görevlisinin elle training_completions
-- satırı yazması gerekiyordu — skor da elle giriliyordu (uydurmaya açık).
-- SONRASI: bir senaryo şablonu bir eğitim konusuyla ETİKETLENDİYSE
-- (egitim_konusu), o senaryonun tatbikatı puanlanıp (/api/simulasyon/[id]/
-- puanla) mühürlendiğinde, katılımcı rolündeki her kullanıcının o konuda
-- AKTİF (ATANDI) ataması varsa otomatik bir training_completions satırı
-- doğar — skor MÜHÜRLENEN tatbikat puanıdır, elle yazılmaz.
--
-- BİLİNÇLİ BASİTLEŞTİRME: puanlama motoru (scoring.ts) RUN bazlıdır, katılımcı
-- bazlı değil — bir tatbikatın tek puanı vardır (M8 tasarımı). Bu yüzden aynı
-- run'daki tüm katılımcı-rolündeki kullanıcılar AYNI puanı alır (kurumun o
-- tatbikattaki kolektif tepkisi). Kişi bazlı puanlama scoring.ts'in kapsamlı
-- bir yeniden tasarımını gerektirir — bilinçli olarak ERTELENDİ.
--
-- ETİKETLEME UYDURULMAZ (kural 12 ruhu): mevcut S01..S05 şablonlarının
-- hiçbiri gerçekte phishing/tabletop içeriği DEĞİL (fidye/hesap ele geçirme/
-- veri sızıntısı/yedekten dönüş/tedarikçi kesintisi) — bu migration hiçbirini
-- etiketlemiyor. `egitim_konusu` NULL kalan her şablon bu bağdan MUAF'tır.
-- Gerçek bir phishing/tabletop şablonu yazılınca (data/scenarios/*.yaml,
-- kurucu onayı) o şablonun seed'i egitim_konusu'nu doldurur.

alter table public.scenario_templates
  add column egitim_konusu text
    check (egitim_konusu is null or egitim_konusu in ('GENEL', 'GUVENLIK', 'KVKK', 'AI_LITERACY', 'BEC_DEEPFAKE', 'SOD'));

comment on column public.scenario_templates.egitim_konusu is
  'NULL = bu şablon eğitim tamamlamasına otomatik bağlanmaz. Doluysa (training_requirements.konu ile aynı sözlük), bu şablonun tatbikatı puanlanınca katılımcıların o konudaki aktif atamaları otomatik tamamlanır.';

-- Tamamlamanın KAYNAĞI: elle mi girildi, tatbikattan mı geldi. UI bu ikisini
-- aynı gösteremez — biri insan beyanı, diğeri sistem ölçümü (kural 11 ruhu:
-- ikisi karıştırılırsa "sistem tespit etti" iddiası anlamını yitirir.
alter table public.training_completions
  add column kaynak text not null default 'MANUEL' check (kaynak in ('MANUEL', 'SIMULASYON')),
  add column kaynak_simulasyon_run_id uuid references public.simulation_runs (id) on delete set null;

comment on column public.training_completions.kaynak_simulasyon_run_id is
  'kaynak=SIMULASYON ise hangi tatbikattan geldiğini gösterir (izlenebilirlik). kaynak=MANUEL ise NULL.';
