"use client";

import dynamic from "next/dynamic";

// localStorage'a bağlı oldukları için sunucuda render edilemezler; ssr:false
// ile yalnızca istemcide yüklenirler (bkz. src/lib/store.tsx, src/lib/auth.tsx).
export const ClientProviders = dynamic(
  () =>
    Promise.all([import("@/lib/store"), import("@/lib/auth")]).then(
      ([{ LocalStoreProvider }, { AuthProvider }]) =>
        function ClientProvidersInner({ children }: { children: React.ReactNode }) {
          return (
            <AuthProvider>
              <LocalStoreProvider>{children}</LocalStoreProvider>
            </AuthProvider>
          );
        },
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Yerel oturum yükleniyor...</p>
    ),
  },
);
