import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Pano" },
  { href: "/controls", label: "Kontrol Kütüphanesi" },
  { href: "/findings", label: "Bulgular" },
  { href: "/paylasim", label: "Paylaşım" },
];

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">KALKAN-OS</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            Yerel mod — canlı Supabase bağlı değil
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </>
  );
}
