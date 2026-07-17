// RLS testleri için gerçek Postgres. PGlite, Postgres'in WASM derlemesidir —
// Docker/kurulum gerektirmez, ama RLS'i gerçekten uygular (spike ile
// doğrulandı: iki farklı kullanıcı birbirinin satırını göremiyor).
//
// NEDEN BU YOL: CLAUDE.md kural 1 "RLS'i test etmeden hiçbir tablo bitti
// sayılmaz" diyor ve docs/ROADMAP.md M1 kabul kriteri RLS testini açıkça
// Vitest'te istiyor. Bu harness onu canlı bir Supabase projesi olmadan
// mümkün kılıyor. Ayrıca kural 4'ü (saf Postgres kal, yurt içi barındırmaya
// taşınabilir ol) fiilen kanıtlar: migration'lar Supabase'e özgü hiçbir
// servis olmadan, düz Postgres üzerinde koşuyor.
//
// SINIRLARI (dürüstçe): auth.users/auth.uid()/auth.role() ve authenticated/
// anon rolleri burada stub'lanır — gerçekte bunları Supabase sağlar. Yani bu
// testler RLS politikalarının MANTIĞINI kanıtlar, Supabase Auth'un kendisini
// değil. Storage ve gerçek JWT akışı da kapsam dışı.
import { PGlite } from "@electric-sql/pglite";
// pgcrypto PGlite'ta çekirdekte gelmez, açıkça yüklenir. Migration'ımız
// (20260716120001_extensions.sql) onu `create extension` ile istiyor —
// gerçek Postgres/Supabase'de de aynı şekilde bir eklenti olarak gelir.
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

/**
 * Supabase'in sağladığı auth yüzeyinin en küçük karşılığı. Gerçek
 * Supabase'de auth.uid() JWT'deki `sub` claim'ini okur; burada da aynı
 * ayardan (request.jwt.claim.sub) okuyoruz.
 */
const AUTH_STUB = `
  -- Supabase eklentileri "extensions" şemasına kurar, PGlite ise public'e.
  -- Bu fark canlıda gerçek bir hataya yol açtı: digest() çağıran fonksiyonlar
  -- search_path = public ile kilitliydi ve Supabase'de digest() görünmüyordu —
  -- testler yeşil olduğu halde her tenant_controls güncellemesi canlıda
  -- patlıyordu (bkz. 20260717093000).
  --
  -- Şemayı burada oluşturuyoruz ki migration'lardaki
  -- "set search_path = public, extensions" ifadesi testlerde de gerçek bir
  -- şemaya işaret etsin. Bu, farkı TAM kapatmaz (pgcrypto burada hâlâ
  -- public'te) — PGlite eklentileri şema seçimine izin vermiyor. Yani şema
  -- düzeyindeki bu tür Supabase farklılıkları için testler yeterli değildir;
  -- canlıya karşı doğrulama şart (pnpm db:verify ve gerçek bir yazma denemesi).
  create schema if not exists extensions;

  create schema if not exists auth;

  create table auth.users (
    id uuid primary key,
    email text
  );

  create or replace function auth.uid() returns uuid
  language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  create or replace function auth.role() returns text
  language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;

  create role authenticated;
  create role anon;

  -- Supabase Storage şeması. PGlite'ta gelmez; gerçek Supabase'de
  -- storage eklentisiyle gelir. auth stub'ıyla aynı gerekçe: migration'lar
  -- (20260717200000) storage.buckets/objects'e dokunuyor ve bunlar olmadan
  -- MIGRATION YÜKLEMESİ patlar — testin RLS'i değil, şemanın kendisi.
  --
  -- SINIRI DÜRÜSTÇE: bu stub yalnızca migration'ın APPLY olmasını sağlar.
  -- storage.objects üzerindeki RLS'in kiracı sınırını GERÇEKTEN uyguladığı
  -- (başka tenant yoluna yükleme reddi, bucket private) canlıya karşı
  -- script'le doğrulandı — PGlite storage'ın gerçek davranışını taklit
  -- etmediği için o kanıt burada değil, gerçek Supabase'de.
  create schema if not exists storage;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );

  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid,
    created_at timestamptz default now()
  );

  -- storage.foldername(name): yol segmentlerini (dosya adı hariç) dizi olarak
  -- döndürür. Gerçek Supabase'deki imzanın asgari karşılığı — RLS politikaları
  -- (storage.foldername(name))[1] ile kiracı segmentini okuyor.
  create or replace function storage.foldername(name text) returns text[]
  language sql immutable
  as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  alter table storage.objects enable row level security;
`;

export interface TestDb {
  /** Ham sorgu — superuser olarak koşar, RLS'i BYPASS eder (service_role muadili). */
  sql: (query: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  /** Verilen kullanıcı kimliğiyle, `authenticated` rolü altında sorgu koşar (RLS uygulanır). */
  asUser: (
    userId: string,
    query: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
  /** Oturum açmamış ziyaretçi (anon rolü) olarak sorgu koşar. */
  asAnon: (query: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  close: () => Promise<void>;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // dosya adları zaman damgalı — alfabetik sıra = uygulama sırası
}

/**
 * Migration'lardaki tüm `revoke ...;` ifadelerini toplar. Gerçek Supabase'de
 * bunlar tablo oluşturulurken verilen default grant'lardan sonra koştuğu için
 * geçerlidir; bu harness'te toplu grant araya girdiğinden yeniden uygulanmalı.
 */
function revokeStatements(): string[] {
  return migrationFiles().flatMap((file) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    return sql.match(/^\s*revoke\s+[^;]+;/gim) ?? [];
  });
}

/**
 * Boş bir Postgres ayağa kaldırır, auth stub'ını ve ardından
 * supabase/migrations/*.sql dosyalarını SIRAYLA uygular. Migration'lar
 * elle kopyalanmaz — gerçek dosyalar okunur, böylece test ettiğimiz şey
 * gerçekten sevk edeceğimiz şema olur.
 */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { pgcrypto } });

  await db.exec(AUTH_STUB);
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration başarısız: ${file}\n${(err as Error).message}`);
    }
  }

  // İstemci rollerinin tablo düzeyinde erişimi olmalı; RLS bunun üzerine
  // satır düzeyinde filtre uygular. Gerçek Supabase bunu kendi kurulumunda
  // yapar (authenticated/anon rollerine şema geneli grant).
  await db.exec(`
    grant usage on schema public to authenticated, anon;
    grant select, insert, update, delete on all tables in schema public to authenticated, anon;
  `);
  // Yukarıdaki toplu grant, migration'lardaki REVOKE'ları geri açar (onlar
  // grant'tan ÖNCE koştu). Bu yüzden revoke'lar burada yeniden uygulanır.
  //
  // Liste elle tutulmaz, migration dosyalarından okunur: elle tutulduğunda
  // yeni bir append-only tablo eklendiğinde unutulur ve test, append-only
  // olmayan bir tabloyu append-only sanarak SESSİZCE yeşil kalırdı —
  // evidence_reviews eklenirken tam olarak bu oldu.
  for (const stmt of revokeStatements()) {
    await db.exec(stmt);
  }

  async function withRole<T>(
    role: string,
    userId: string | null,
    fn: () => Promise<T>,
  ): Promise<T> {
    await db.exec(`set role ${role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
    await db.query(`select set_config('request.jwt.claim.role', $1, false)`, [role]);
    try {
      return await fn();
    } finally {
      await db.exec(`reset role`);
    }
  }

  return {
    sql: async (query, params) => db.query(query, params) as Promise<{ rows: Record<string, unknown>[] }>,
    asUser: (userId, query, params) =>
      withRole("authenticated", userId, () => db.query(query, params)) as Promise<{
        rows: Record<string, unknown>[];
      }>,
    asAnon: (query, params) =>
      withRole("anon", null, () => db.query(query, params)) as Promise<{
        rows: Record<string, unknown>[];
      }>,
    close: () => db.close(),
  };
}

/**
 * Kanıt zarfının zorunlu alanları (20260717190000'deki guard).
 *
 * NEDEN TESTLERDE BÖYLE BİR SABİT VAR: zarf göçünden sonra `evidences`'a
 * yazılan her yeni satır zarflı olmak zorunda. Aşağıdaki testlerin çoğunun
 * derdi zarf DEĞİL (kiracı izolasyonu, dört-göz, paylaşım) — ama kanıt
 * eklemeden o davranışları sınayamıyorlar.
 *
 * Alternatif, zarf kolonlarına DB düzeyinde varsayılan vermekti; reddedildi:
 * varsayılan bir köken, uydurulmuş bir kökendir ve tam da guard'ın engellemek
 * için var olduğu şeydir. Test verisinin zarflı olması doğru — gerçek kayıtlar
 * da zarflı olacak.
 */
export const ZARF_KOLONLARI = "classification, retention_class, envelope_schema_version";
export const ZARF_DEGERLERI = "'gizli', '10y', 'KALKAN_EVIDENCE_ENVELOPE_V1'";

/** İki tenant ve her birinde birer admin kullanıcı kurar. */
export async function seedTwoTenants(db: TestDb) {
  const A = {
    tenantId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    userId: "a0000000-0000-0000-0000-000000000001",
  };
  const B = {
    tenantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    userId: "b0000000-0000-0000-0000-000000000001",
  };

  await db.sql(`insert into auth.users (id, email) values ($1, 'a@demo.com'), ($2, 'b@demo.com')`, [
    A.userId,
    B.userId,
  ]);
  await db.sql(
    `insert into public.tenants (id, name, segment) values ($1, 'Tenant A', 'araci_kurum'), ($2, 'Tenant B', 'pys')`,
    [A.tenantId, B.tenantId],
  );
  await db.sql(
    `insert into public.profiles (id, tenant_id, role, full_name)
     values ($1, $2, 'admin', 'A Admin'), ($3, $4, 'admin', 'B Admin')`,
    [A.userId, A.tenantId, B.userId, B.tenantId],
  );

  // Ortak referans verisi: bir çerçeve + bir kontrol.
  const frameworkId = "f0000000-0000-0000-0000-000000000001";
  const controlId = "c0000000-0000-0000-0000-000000000001";
  await db.sql(
    `insert into public.frameworks (id, code, name, version) values ($1, 'VII-128.10', 'Test', 'v0')`,
    [frameworkId],
  );
  await db.sql(
    `insert into public.controls (id, framework_id, madde_ref, baslik, periyot, kritiklik)
     values ($1, $2, 'TODO-DOGRULA-01', 'Test kontrolü', 'yillik', 5)`,
    [controlId, frameworkId],
  );

  return { A, B, frameworkId, controlId };
}
