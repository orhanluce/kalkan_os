-- M35 sonraki dilim (ROADMAP §1.24 sonu): "vendor-portal dış erişim (G7 M41
-- partner modeliyle)". §1.27'de kurulan matter_access_grants/matter_goruntule
-- deseninin AYNISI — yeni bir dış-erişim mekanizması İCAT EDİLMEDİ, tedarikçi
-- grafına uygulandı.
--
-- ÖNCESİ: bir tedarikçinin durumunu/açık bulgularını görmek için tenant
-- tarafının kendisine e-posta/PDF göndermesi gerekiyordu — tedarikçinin hesabı
-- yok, kendi durumunu göremiyor. SONRASI: admin/uyum bir dış e-posta için
-- süreli, iptal edilebilir bir token üretir; tedarikçi hesapsız, o linkle
-- kendi tedarikçi kaydının SALT-OKUR özetini görür (mevcut değerlendirme
-- durumu + açık bulgular, minimize alanlarla).
--
-- matter_access_grants'tan TEK FARK: bağımsızlık beyanı ön koşulu YOK — o
-- koşul regülatör/denetçi bağlamına özgüydü (çıkar çatışması riski); burada
-- analog bir kavram yok, uydurulmadı. Geçerlilik/iptal aynı disiplinle kalıyor.
--
-- ROLLBACK NOTU: bağımsız yeni tablo, üretim verisi yok — fresh drop güvenli.

create table public.third_party_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id) on delete cascade,
  external_email text not null,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  son_gecerlilik timestamptz not null,
  iptal_edildi boolean not null default false,
  olusturan uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index third_party_access_grants_token_idx on public.third_party_access_grants (token);
create index third_party_access_grants_tp_idx on public.third_party_access_grants (third_party_id);

/**
 * Oturumsuz tedarikçi görünümü (Proof Room / matter_goruntule disiplini):
 * geçersiz/dolmuş/iptal token AYNI null (hangisi olduğu sızdırılmaz). Veri
 * minimizasyonu: tedarikçinin KENDİ kaydı + açık (KAPANDI olmayan) bulgular,
 * yalnız baslik/ciddiyet/hedef_tarih/durum (sahibi/kapanis_kanit gibi iç
 * alanlar SIZMAZ). Her görüntüleme audit_log'a düşer (aktör yok — dış).
 */
create or replace function public.tedarikci_goruntule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_grant record;
  v_tp record;
  v_degerlendirme record;
  v_bulgular jsonb;
begin
  select * into v_grant from public.third_party_access_grants where token = p_token;
  if v_grant is null or v_grant.son_gecerlilik < now() or v_grant.iptal_edildi then
    return null;
  end if;

  select id, ad, tier, karar into v_tp
  from public.third_parties where id = v_grant.third_party_id and tenant_id = v_grant.tenant_id;
  if v_tp is null then
    return null;
  end if;

  select tur, durum, tamamlandi_at into v_degerlendirme
  from public.third_party_assessments
  where third_party_id = v_tp.id
  order by baslangic_at desc
  limit 1;

  select coalesce(jsonb_agg(b order by b."hedefTarih" nulls last), '[]'::jsonb) into v_bulgular
  from (
    select f.baslik, f.ciddiyet, f.durum, f.hedef_tarih as "hedefTarih"
    from public.assessment_findings f
    where f.third_party_id = v_tp.id and f.durum <> 'KAPANDI'
  ) b;

  insert into public.audit_log (tenant_id, actor_id, eylem, hedef_tablo, hedef_id, detay)
  values (v_grant.tenant_id, null, 'tedarikci_dis_goruntulendi', 'third_party_access_grants', v_grant.id,
    jsonb_build_object('third_party_id', v_tp.id));

  return jsonb_build_object(
    'ad', v_tp.ad, 'tier', v_tp.tier, 'karar', v_tp.karar,
    'sonGecerlilik', v_grant.son_gecerlilik,
    'degerlendirme', case when v_degerlendirme is null then null else
      jsonb_build_object('tur', v_degerlendirme.tur, 'durum', v_degerlendirme.durum, 'tamamlandiAt', v_degerlendirme.tamamlandi_at)
    end,
    'acikBulgular', v_bulgular
  );
end;
$$;

grant execute on function public.tedarikci_goruntule(text) to anon, authenticated;

-- --- RLS: tenant'a kilitli; yazma admin/uyum (grant oluşturma) ---
alter table public.third_party_access_grants enable row level security;

create policy third_party_access_grants_select on public.third_party_access_grants
  for select using (tenant_id = public.current_tenant_id());
create policy third_party_access_grants_write on public.third_party_access_grants
  for all
  using (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'))
  with check (tenant_id = public.current_tenant_id() and public.current_user_role() in ('admin', 'uyum'));
