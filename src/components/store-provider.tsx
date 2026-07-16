"use client";

import dynamic from "next/dynamic";

// localStorage'a bağlı olduğu için sunucuda render edilemez; ssr:false ile
// yalnızca istemcide yüklenir (bkz. src/lib/store.tsx).
export const ClientStoreProvider = dynamic(
  () => import("@/lib/store").then((m) => m.LocalStoreProvider),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Yerel oturum yükleniyor...</p>
    ),
  },
);
