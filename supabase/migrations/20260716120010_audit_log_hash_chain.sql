-- audit_log olaylarını kriptografik olarak zincirler (docs/ROADMAP.md M5.5).
--
-- NEDEN: append-only olmak (kural 2) yalnızca UYGULAMA rolünün silip
-- değiştiremediğini garanti eder. Veritabanına doğrudan erişebilen biri
-- (yanlış yapılandırılmış service_role, DB yöneticisi, yedekten geri dönüş)
-- yine de bir kaydı sessizce değiştirebilir veya araya kayıt sokabilir.
-- Zincir bunu ENGELLEMEZ ama TESPİT EDİLEBİLİR kılar: her olayın hash'i
-- kendinden öncekini kapsar, dolayısıyla tek bir kaydı değiştirmek ondan
-- sonraki tüm hash'leri geçersizleştirir.
--
-- Zincir DB tarafında kurulur, istemcide değil: istemcinin gönderdiği
-- previous_event_hash/event_hash değerleri trigger tarafından yok sayılıp
-- üzerine yazılır. İstemcide hesaplansaydı, kaydı uyduran taraf hash'i de
-- uydurabilirdi ve zincir hiçbir şey kanıtlamazdı.

-- Zincir sırası için monoton bir sütun gerekli: created_at yeterli DEĞİL,
-- çünkü aynı transaction içindeki tüm now() çağrıları aynı değeri döndürür
-- ve o durumda "önceki kayıt" belirsiz kalırdı.
alter table public.audit_log add column seq bigint generated always as identity;
alter table public.audit_log add column previous_event_hash text;
alter table public.audit_log add column event_hash text;

create unique index audit_log_tenant_seq_idx on public.audit_log (tenant_id, seq);

/**
 * Bir audit olayının hash'lenecek kanonik metin temsili. Alan sırası ve
 * ayırıcı SABİTTİR — değiştirilirse geçmiş tüm zincirler geçersiz olur.
 * Yeni bir alan eklenmesi gerekirse SONA eklenmeli ve bu durum bir
 * migration notuyla kayda geçmeli.
 *
 * stable (immutable değil): timestamptz -> text dönüşümü tz veritabanına
 * bağlıdır. 'UTC' için pratikte sabit, ama Postgres bunu immutable saymaz.
 */
create or replace function public.audit_log_canonical(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_eylem text,
  p_hedef_tablo text,
  p_hedef_id uuid,
  p_detay jsonb,
  p_created_at timestamptz,
  p_previous_event_hash text
) returns text
language sql
stable
as $$
  select concat_ws(
    -- U+001F (unit separator): serbest metin alanlarında pratikte görülmez,
    -- dolayısıyla alan sınırlarını bulanıklaştıramaz.
    chr(31),
    p_tenant_id::text,
    coalesce(p_actor_id::text, ''),
    p_eylem,
    coalesce(p_hedef_tablo, ''),
    coalesce(p_hedef_id::text, ''),
    -- jsonb metin temsili Postgres tarafından normalize edilir (anahtar
    -- sırası deterministik) — bu yüzden jsonb, json değil.
    coalesce(p_detay::text, ''),
    to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(p_previous_event_hash, '')
  )
$$;

create or replace function public.audit_log_seal()
returns trigger
language plpgsql
-- security definer: zinciri kurabilmek için tenant'ın SON kaydını okumak
-- şart. Politika bunu zaten aynı tenant için okutuyor, ama zincir
-- doğruluğu çağıranın RLS görünürlüğüne bağlı OLMAMALI — aksi halde
-- görünürlüğü kısıtlı bir çağıran zinciri sessizce baştan başlatırdı.
security definer
set search_path = public
as $$
declare
  v_prev text;
  v_canonical text;
begin
  -- Tenant başına serileştir: iki eşzamanlı insert aynı "son kayıt"ı okuyup
  -- zinciri çatallamasın. Kilit transaction sonunda kendiliğinden düşer.
  perform pg_advisory_xact_lock(hashtext(new.tenant_id::text));

  select event_hash into v_prev
  from public.audit_log
  where tenant_id = new.tenant_id
  order by seq desc
  limit 1;

  -- İstemcinin gönderdiği değerler burada BİLİNÇLİ olarak ezilir.
  new.previous_event_hash := v_prev;

  v_canonical := public.audit_log_canonical(
    new.tenant_id, new.actor_id, new.eylem, new.hedef_tablo,
    new.hedef_id, new.detay, new.created_at, v_prev
  );
  new.event_hash := encode(digest(v_canonical, 'sha256'), 'hex');

  return new;
end;
$$;

create trigger audit_log_seal_before_insert
  before insert on public.audit_log
  for each row execute function public.audit_log_seal();

/**
 * Bir tenant'ın audit zincirini baştan sona doğrular. BOŞ sonuç = zincir
 * sağlam. Her satır bir kırık noktasıdır.
 *
 * Kasıtlı olarak "ilk hatada dur" değil: yedekten dönüş gibi durumlarda
 * kırığın nerede BAŞLADIĞINI değil, tüm etkilenen aralığı görmek gerekir.
 */
create or replace function public.verify_audit_chain(target_tenant_id uuid)
returns table (bozuk_seq bigint, bozuk_id uuid, sebep text)
language plpgsql
security definer
set search_path = public
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

    -- Zincir, KAYITLI hash üzerinden ilerler (yeniden hesaplanan üzerinden
    -- değil): böylece kurcalanan bir kayıt hem kendini hem ardılını bozar
    -- ve tespit tek bir satırda gizlenemez.
    v_expected_prev := r.event_hash;
  end loop;
  return;
end;
$$;
