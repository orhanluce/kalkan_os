-- SoD değerlendirme tetikleri (docs/ROADMAP.md M16 #5, master talimat §24).
--
-- KURUCU TALEBİ: "atama/kural değişiminde sod.evaluate KUYRUĞA ALMA" — bugüne
-- kadar değerlendirme yalnız elle tetikleniyordu (buton) veya import outbox'ı
-- üzerinden geliyordu. Bu migration atama/kural/taraf DEĞİŞİMİNİ de aynı
-- transactional-outbox'a bağlar: değişiklik commit olduysa değerlendirme
-- borcu da GARANTİ kayıtlıdır.
--
-- DEBOUNCE (tenant başına tek bekleyen olay): bir CSV apply'ı yüzlerce satır
-- değiştirebilir; her satıra bir olay yazmak kuyruk gürültüsüdür ve drenaj
-- zaten TÜM güncel durumu tek koşuda değerlendirir. Bu yüzden kural: kiracının
-- hâlihazırda PENDING bir SOD_YENIDEN_DEGERLENDIR olayı varsa YENİSİ yazılmaz.
-- Drenaj olayı DONE yapınca sonraki değişiklik yeni olay üretir. (Yarışta iki
-- olay yazılabilir — zararsız: drenaj ikisini de aynı koşuyla kapatır.)
--
-- DRENAJIN KENDİSİ TS'TE KALIR (motor tek kaynak, kural 11): pg_cron TS
-- koşamaz; SQL'de ikinci bir motor YAZILMAZ. Drenaj yolu: /sod sayfası
-- açılışındaki oto-drenaj + UI butonu + (ileride, ayrı ADR'lik altyapı kararı)
-- dış zamanlayıcının route'u çağırması.

create or replace function public.sod_yeniden_degerlendir_kuyrukla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  -- Taraflar tablosunda tenant, kural üzerinden bulunur; diğerlerinde satırda.
  if TG_TABLE_NAME = 'sod_kural_taraflari' then
    select r.tenant_id into v_tenant
    from public.sod_kurallari r
    where r.id = coalesce(new.rule_id, old.rule_id);
  else
    v_tenant := coalesce(new.tenant_id, old.tenant_id);
  end if;

  if v_tenant is null then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.sod_outbox
    where tenant_id = v_tenant
      and event_type = 'SOD_YENIDEN_DEGERLENDIR'
      and durum = 'PENDING'
  ) then
    insert into public.sod_outbox (tenant_id, event_type, payload)
    values (
      v_tenant, 'SOD_YENIDEN_DEGERLENDIR',
      jsonb_build_object('tetik_tablo', TG_TABLE_NAME, 'tetik_op', TG_OP)
    );
  end if;

  return coalesce(new, old);
end;
$$;

-- Atama değişimi: I/U/D (import apply'ı, rollback'i, elle/fixture girişleri —
-- hepsi). DELETE de tetikler: silinen atama çatışmayı ortadan kaldırmış
-- olabilir; motor silmez ama koşu kaydı güncel resmi mühürler.
create trigger sod_atamalari_degerlendir_kuyrukla
  after insert or update or delete on public.sod_atamalari
  for each row execute function public.sod_yeniden_degerlendir_kuyrukla();

create trigger sod_kurallari_degerlendir_kuyrukla
  after insert or update or delete on public.sod_kurallari
  for each row execute function public.sod_yeniden_degerlendir_kuyrukla();

create trigger sod_kural_taraflari_degerlendir_kuyrukla
  after insert or update or delete on public.sod_kural_taraflari
  for each row execute function public.sod_yeniden_degerlendir_kuyrukla();
