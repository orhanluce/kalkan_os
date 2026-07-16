-- Denetçi paylaşımını fiilen çalışır hale getirir (M4 borcu).
--
-- SORUN: /paylasim/:token sayfası oturumsuz açılır (denetçinin hesabı yoktur),
-- ama tüm RLS politikaları current_tenant_id()'ye dayanır ve anon için null
-- döner. Sonuç: geçerli bir token bile "link geçersiz" görünüyordu. Mock
-- store'da "çalışıyordu" çünkü orada hiçbir erişim kontrolü yoktu.
--
-- NEDEN RLS POLİTİKASI DEĞİL DE RPC: anon kullanıcının JWT'si yoktur,
-- dolayısıyla token'ı politikaya taşıyacak bir kanal da yoktur
-- (current_setting ile taşımak, her isteğin önce set_config çağırmasını
-- gerektirirdi ve unutulduğu anda politika sessizce herkese açılırdı).
-- security definer bir fonksiyon, kapsamı TEK bir yerde ve açıkça belirler:
-- token doğrulanmadan hiçbir satır dönmez.
--
-- VERİ MİNİMİZASYONU (şartname §10.4): fonksiyon yalnızca kapsamdaki
-- kontrolleri, durumlarını ve kanıt SAYISINI döndürür. Kanıt içeriği,
-- dosya yolu, hash, yükleyen kimliği, notlar ve diğer çerçevelerin
-- kontrolleri DÖNMEZ. Denetçi "bu kontrol karşılanıyor ve 2 kanıtı var"
-- bilgisini alır; kanıtın kendisine erişim ayrı bir akıştır.
--
-- BİLİNEN SINIR: token bilen herkes bu veriyi görür — paylaşım linkinin
-- doğası bu. Koruma token entropisinden gelir (256 bit, gen_random_bytes(32))
-- ve süre sınırından. Kaba kuvvet pratikte imkânsız; yine de üretimde
-- API gateway düzeyinde rate limit olmalı.

create or replace function public.paylasim_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link record;
  v_framework record;
  v_kontroller jsonb;
begin
  select * into v_link from public.share_links where token = p_token;

  -- Geçersiz token ile süresi dolmuş token AYNI cevabı verir: hangisinin
  -- hangisi olduğunu söylemek, saldırgana geçerli token'ları ayırt etme
  -- imkânı verirdi.
  if v_link is null or v_link.son_gecerlilik < now() then
    return null;
  end if;

  select f.code, f.name into v_framework
  from public.frameworks f
  where f.id = (v_link.kapsam ->> 'frameworkId')::uuid;

  if v_framework is null then
    return null;
  end if;

  select coalesce(jsonb_agg(k order by k.madde_ref), '[]'::jsonb) into v_kontroller
  from (
    select
      c.madde_ref,
      c.baslik,
      c.kritiklik,
      tc.durum,
      -- Yalnızca SAYI: kanıtın kendisi, adı, hash'i ve yükleyeni dönmez.
      (
        select count(*)
        from public.evidences e
        where e.control_id = c.id and e.tenant_id = v_link.tenant_id
      ) as kanit_sayisi
    from public.controls c
    join public.tenant_controls tc
      on tc.control_id = c.id and tc.tenant_id = v_link.tenant_id
    -- Kapsam sınırı: paylaşımın çerçevesi dışındaki kontroller DÖNMEZ.
    where c.framework_id = (v_link.kapsam ->> 'frameworkId')::uuid
  ) k;

  -- Denetçi erişimi denetim izine yazılır (şartname §6.6 "İndirme kayıtları").
  -- actor_id null: erişen kişi bir kullanıcı değil, token sahibidir. Token
  -- detaya YAZILMAZ — logdan okunabilseydi paylaşımın gizliliği anlamsızlaşırdı.
  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (
    v_link.tenant_id, null, 'paylasim_goruntulendi', 'share_links', v_link.id,
    jsonb_build_object('frameworkCode', v_framework.code)
  );

  return jsonb_build_object(
    'kurumAdi', (select name from public.tenants where id = v_link.tenant_id),
    'frameworkCode', v_framework.code,
    'frameworkAdi', v_framework.name,
    'sonGecerlilik', v_link.son_gecerlilik,
    'kontroller', v_kontroller
  );
end;
$$;

-- Oturumsuz denetçi bu fonksiyonu çağırabilmeli. Fonksiyonun KENDİSİ tek
-- kapıdır: token doğru değilse null döner.
grant execute on function public.paylasim_goruntule(text) to anon, authenticated;
