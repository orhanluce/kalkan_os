-- Bulgu kaynağına 'simulasyon' ekler (docs/ROADMAP.md M8).
--
-- SORUN: findings.kaynak yalnızca ('sizma_testi', 'denetim', 'ic_tespit')
-- kabul ediyordu. Bir tatbikat sonucu kabul edilen bulgu önerisi gerçek
-- bulguya dönüşünce (simulation_finding_proposals.durum = 'KABUL'), o
-- bulgunun kaynağını doğru yansıtacak bir değer yoktu — "ic_tespit" ile
-- işaretlemek, bulgunun bir insanın gözlemiyle mi yoksa deterministik
-- puanlama motoruyla mı üretildiğini gizlerdi. Denetimde bu ayrım önemli.
alter table public.findings drop constraint findings_kaynak_check;
alter table public.findings add constraint findings_kaynak_check
  check (kaynak in ('sizma_testi', 'denetim', 'ic_tespit', 'simulasyon'));
