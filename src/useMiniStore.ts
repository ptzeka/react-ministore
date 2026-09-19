import { useSyncExternalStore } from "react";
import type { IMiniStore, StoreValues } from "./miniStore";

export const useMiniStore = function <Stores extends IMiniStore<unknown>[]>(
  ...stores: [...Stores]
): StoreValues<Stores> {
  const results = stores.map((store) => useSyncExternalStore(store.sub, store.get, store.get));
  return results as StoreValues<Stores>;
};
