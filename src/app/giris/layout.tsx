// Giriş ekranı sürüm ve güvenlik metni değişikliklerini anında göstermelidir.
// Statik prerender, Hostinger CDN'inde uzun ömürlü eski HTML bırakıyor.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function GirisLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
