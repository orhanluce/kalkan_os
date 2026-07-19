-- Dikey A canlı e2e testi gerçek bir bug yakaladı: assessment_response_
-- answers.question_id ON DELETE RESTRICT idi. third_parties silinince kural
-- şu zinciri cascade eder: third_party_assessments -> assessment_questions
-- VE ayrıca -> assessment_response_revisions -> assessment_response_answers.
-- Postgres aynı işlemde assessment_questions'ı silmeye çalışırken hâlâ
-- silinmemiş assessment_response_answers satırları question_id üzerinden
-- RESTRICT ile buna engel oluyordu — TÜM silme işlemi FK ihlaliyle
-- başarısız oluyordu (canlı e2e temizliği bunu yakaladı: bir tedarikçiyi
-- silmeye çalışan her akış, o tedarikçi herhangi bir ankete yanıt almışsa
-- sessizce başarısız olurdu).
--
-- Düzeltme: CASCADE. Soru silinirse ona verilen cevap da anlamsızdır — şema
-- zaten third_party_id/assessment_id için CASCADE kullanıyor, question_id
-- de tutarlı olmalı.
alter table public.assessment_response_answers drop constraint assessment_response_answers_question_id_fkey;
alter table public.assessment_response_answers add constraint assessment_response_answers_question_id_fkey
  foreign key (question_id) references public.assessment_questions (id) on delete cascade;
