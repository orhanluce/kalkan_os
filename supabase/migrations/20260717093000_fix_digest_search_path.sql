-- digest() çağıran fonksiyonların search_path'ini düzeltir.
--
-- HATA: canlı Supabase'de her tenant_controls güncellemesi
-- "function digest(text, unknown) does not exist" ile başarısız oluyordu ve
-- audit_log hash zinciri hiç çalışmıyordu.
--
-- SEBEP: Supabase pgcrypto'yu `extensions` şemasına kurar; PGlite (testler)
-- `public`'e kurar. Fonksiyonlarımız `set search_path = public` ile kilitli
-- olduğu için canlıda digest() görünmez oluyordu. Testler yeşildi çünkü
-- PGlite'ta digest() zaten public'teydi — yani testler bu farkı yakalayamadı.
--
-- ÇÖZÜM: search_path'e `extensions` eklendi. Her iki ortamda da çalışır:
-- search_path'te var olmayan bir şema (PGlite'ta `extensions`) sessizce yok
-- sayılır. `extensions.digest(...)` diye açıkça nitelemek de mümkündü ama o,
-- şemayı Supabase'e bağlardı ve CLAUDE.md kural 4'e (saf Postgres kal, yurt
-- içi barındırmaya taşınabilir ol) aykırı olurdu.
--
-- search_path hâlâ SABİT: boş bırakmak, security definer fonksiyonlarda
-- çağıranın search_path'ini enjekte etmesine kapı açardı.

create or replace function public.audit_log_seal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prev text;
  v_canonical text;
begin
  perform pg_advisory_xact_lock(hashtext(new.tenant_id::text));

  select event_hash into v_prev
  from public.audit_log
  where tenant_id = new.tenant_id
  order by seq desc
  limit 1;

  new.previous_event_hash := v_prev;

  v_canonical := public.audit_log_canonical(
    new.tenant_id, new.actor_id, new.eylem, new.hedef_tablo,
    new.hedef_id, new.detay, new.created_at, v_prev
  );
  new.event_hash := encode(digest(v_canonical, 'sha256'), 'hex');

  return new;
end;
$$;

create or replace function public.verify_audit_chain(target_tenant_id uuid)
returns table (bozuk_seq bigint, bozuk_id uuid, sebep text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r record;
  v_expected_prev text := null;
  v_hash text;
begin
  for r in
    select * from public.audit_log
    where tenant_id = target_tenant_id
    order by seq asc
  loop
    if r.previous_event_hash is distinct from v_expected_prev then
      bozuk_seq := r.seq;
      bozuk_id := r.id;
      sebep := 'previous_event_hash zincirle uyusmuyor (kayit silinmis veya araya eklenmis olabilir)';
      return next;
    end if;

    v_hash := encode(digest(public.audit_log_canonical(
      r.tenant_id, r.actor_id, r.eylem, r.hedef_tablo,
      r.hedef_id, r.detay, r.created_at, r.previous_event_hash
    ), 'sha256'), 'hex');

    if v_hash is distinct from r.event_hash then
      bozuk_seq := r.seq;
      bozuk_id := r.id;
      sebep := 'event_hash icerikle uyusmuyor (kayit sonradan degistirilmis)';
      return next;
    end if;

    v_expected_prev := r.event_hash;
  end loop;
  return;
end;
$$;
