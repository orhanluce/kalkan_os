-- G3 defter kapsamını tamamlama (nihai talimat v3.3 §8.0 Dikey 1). Mevcut
-- transactional-outbox/SCITT mekanizması (20260719120000_ledger_outbox.sql)
-- YENİDEN KURULMADI — yalnız YENİ artefakt türleri için AFTER UPDATE trigger'ları
-- ekleniyor, hepsi genel `ledger_outbox_enqueue_trg()` fonksiyonunu çağırıyor
-- (audit_privacy('dsar') / audit_ai('...') ile aynı "tek fonksiyon, TG_ARGV
-- parametreli" deseni).
--
-- HER TRIGGER "WHEN" İLE TAM GEÇİŞ ANINA KİLİTLİ (yalnız gerçek olay anında
-- enqueue — sonraki alakasız UPDATE'lerde tekrar tekrar YAZILMAZ; zaten
-- ledger_outbox(artifact_table,artifact_id) UNIQUE olduğu için ikinci bir
-- enqueue çağrısı da ON CONFLICT DO NOTHING ile zararsızdır — çifte savunma):
--
--   1. third_party_assessments: DEVAM/TASLAK -> TAMAMLANDI (vendor sign-off)
--   2. assessment_findings: KRİTİK bulgu, herhangi -> KAPANDI (kritik kapanış)
--   3. ai_incidents: herhangi -> KAPANDI (AI olay kapanışı)
--   4. ai_execution_receipts: SUGGESTED -> ACCEPTED/REJECTED (insan kararı)
--   5. board_declarations: taslak -> sunuldu (YK beyanı sunumu/attestation)
--
-- HAM İÇERİK DEFTERE GİRMEZ: yalnız statement_kind + artifact referansı burada;
-- kanonik manifest (ne mühürlendiği) TS'te kurulur (ledger-outbox.ts dispatch),
-- imzalanır ve statement_hash olarak transparency_ledger_entries'e yazılır —
-- G3 ile birebir aynı akış.

create trigger third_party_assessments_ledger_outbox_enqueue
  after update on public.third_party_assessments
  for each row
  when (new.durum = 'TAMAMLANDI' and old.durum is distinct from 'TAMAMLANDI')
  execute function public.ledger_outbox_enqueue_trg('TPR_ASSESSMENT_SIGNOFF');

create trigger assessment_findings_ledger_outbox_enqueue
  after update on public.assessment_findings
  for each row
  when (new.durum = 'KAPANDI' and new.ciddiyet = 'KRITIK' and old.durum is distinct from 'KAPANDI')
  execute function public.ledger_outbox_enqueue_trg('TPR_CRITICAL_FINDING_CLOSURE');

create trigger ai_incidents_ledger_outbox_enqueue
  after update on public.ai_incidents
  for each row
  when (new.durum = 'KAPANDI' and old.durum is distinct from 'KAPANDI')
  execute function public.ledger_outbox_enqueue_trg('AI_INCIDENT_CLOSURE');

create trigger ai_execution_receipts_ledger_outbox_enqueue
  after update on public.ai_execution_receipts
  for each row
  when (new.karar in ('ACCEPTED', 'REJECTED') and old.karar = 'SUGGESTED')
  execute function public.ledger_outbox_enqueue_trg('AI_RECEIPT_DECISION');

create trigger board_declarations_ledger_outbox_enqueue
  after update on public.board_declarations
  for each row
  when (new.durum = 'sunuldu' and old.durum is distinct from 'sunuldu')
  execute function public.ledger_outbox_enqueue_trg('BOARD_DECLARATION_ATTESTATION');
