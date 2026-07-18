"use client";

// Hydration-güvenli "istemcide miyiz" hook'u.
//
// NEDEN: cookie/localStorage SSR'da yok. Mount-effect'te setState çağırmak
// React 19 lint kuralına (set-state-in-effect: kademeli render) takılır;
// doğrudan lazy-init ise sunucu/istemci çıktısını ayrıştırıp hydration
// uyuşmazlığı üretir. useSyncExternalStore tam bu iş için: sunucu snapshot'ı
// false, istemci snapshot'ı true — React geçişi uyarısız ve tek render'da
// yönetir. Tüketen bileşen tarayıcı değerini RENDER SIRASINDA türetir
// (effect'e gerek kalmaz).
import { useSyncExternalStore } from "react";

const bosAbonelik = () => () => {};

export function useIstemcideMi(): boolean {
  return useSyncExternalStore(
    bosAbonelik,
    () => true,
    () => false,
  );
}
