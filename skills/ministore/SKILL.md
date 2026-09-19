---
name: ministore
description: Use @ministore/react — a tiny subscribable single-value store for React. Use when adding shared state to a React app via the provider pattern (context holds stable `$store` handles, components subscribe with `useMiniStore`), when creating a new provider, when reading/writing a `$`-prefixed IMiniStore handle, when a context value change is re-rendering too much, when deciding how to split state into stores, or when reviewing code that imports `miniStore` / `useMiniStore` / `IMiniStore`.
---

# @ministore/react

One value per store. A store wraps a `{ current }` ref that its owner (usually a provider)
holds; components subscribe through `useMiniStore`, which is `useSyncExternalStore` underneath.

```ts
import { miniStore, useMiniStore, type IMiniStore } from "@ministore/react";
```

## Names in this skill are placeholders

The package ships no providers, and the project may not have any yet. Every example uses one
generic vocabulary. Rename it to the project's domain, and don't assume these names exist:

| Placeholder | Stands for | Rename to, e.g. |
| --- | --- | --- |
| `Feature` in `FeatureProvider`, `FeatureContext`, `IFeatureContext`, `useFeatureContext` | The area of state one provider owns | `Theme`, `Session`, `Cart` |
| `IItem`, `$item` | An object value held in a store | `IUser` / `$user`, `ICart` / `$cart` |
| `$itemName` | One field split out of `$item` into its own store | `$userName`, `$cartCount` |
| `$isReady` | A second, independent value in the same provider | `$isLoggedIn`, `$isLoading` |
| `updateItem` | A provider action that writes the stores | `signIn`, `addToCart` |

If a matching provider already exists, add stores to it. Otherwise, create one from the template
in "The provider pattern" below.

## One store, one value: no selectors

You subscribe to a whole store, one store at a time. A component re-renders when that store's
value changes. You can't subscribe to part of a value, and that is on purpose: each store
stays simple, and it's clear from the `useMiniStore` call what a component depends on.

So `$item` and `$itemName` are different stores (for example, a user object and its user name).
Don't mix them together or try to derive one inside the other. If some components need only
the name, and they shouldn't re-render when other fields change, create a second store and
update both:

```ts
// inside the provider's useMemo
const $item = miniStore.create(itemRef);         // IItem
const $itemName = miniStore.create(itemNameRef); // string

const updateItem = (item: IItem) => {
  $item.set(item);
  $itemName.set(item.name); // same string as before: Object.is skips the notify
};
```

```tsx
const ItemName = () => {
  const { $itemName } = useFeatureContext();
  const [itemName] = useMiniStore($itemName); // not affected by other fields changing
  return <span>{itemName}</span>;
};
```

- Start with one store (`$item`). Add `$itemName` only when there's a real re-render cost.
- Update the paired stores in one provider action, such as `updateItem`. Don't set them
  separately from different call sites, or they drift apart.
- Don't add selectors, slices, or `useMiniStore($item, (i) => i.name)`-style helpers.
- Don't combine unrelated values into one object store to save a store. Give each its own.

## API: four methods and one hook

| Call | What it does |
| --- | --- |
| `miniStore.create<T>(ref)` | Wraps a `{ current: T }` ref and returns an `IMiniStore<T>` handle. The handle reads and writes **that ref**. |
| `$store.get()` | Current value. Does not subscribe, so it is safe in handlers and effects. |
| `$store.set(value)` | Writes `ref.current` and notifies subscribers, but **only if `!Object.is(old, new)`**. |
| `$store.sub(cb)` | Subscribes and returns an unsubscribe function. `cb` receives the new value. |
| `$store.unsub(cb)` | Removes `cb`. |
| `useMiniStore(...stores)` | Subscribes the component and returns a **tuple** of current values in argument order. |

All four methods are bound, so `const { set } = $store` works.

## Conventions

- Prefix handle names with `$`: `$item`, `$isReady`. A `$` name is a handle, and the name
  without `$` is its value: `const [item] = useMiniStore($item)`.
- **Always destructure** what `useMiniStore` returns, even for one store:
  `const [item] = useMiniStore($item)`. Writing `const item = useMiniStore($item)` gives you
  an array.
- Type context fields as `IMiniStore<T>`, not the concrete class, which is not exported.
- A provider exposes its stores plus the actions that write them (`updateItem`). Components
  read with `useMiniStore` and write through the actions.

## The provider pattern (the main use)

Context carries **stable handles**, never the values themselves. The context value never
changes, so reading the context doesn't re-render anything. Only components that call
`useMiniStore($x)` re-render, and only when `$x` changes.

Template. Copy it, then rename `Feature` and `Item` as described above:

```tsx
import React, { createContext, useContext, useMemo, useRef } from "react";
import { miniStore, type IMiniStore } from "@ministore/react";

export interface IItem {
  id: string;
  name: string;
}

export interface IFeatureContext {
  $item: IMiniStore<IItem>;
  $isReady: IMiniStore<boolean>;
  updateItem(item: IItem): void;
}

const DEFAULT_ITEM: IItem = { id: "", name: "" };

// used only when a component renders outside FeatureProvider
const FeatureContext = createContext<IFeatureContext>({
  $item: miniStore.create({ current: DEFAULT_ITEM }),
  $isReady: miniStore.create({ current: false }),
  updateItem() {},
});

export const FeatureProvider = ({
  value,
  children,
}: {
  value?: { item?: IItem };
  children: React.ReactNode;
}) => {
  const itemRef = useRef<IItem>(value?.item ?? DEFAULT_ITEM);
  const isReadyRef = useRef<boolean>(value?.item !== undefined);

  const ctx = useMemo<IFeatureContext>(() => {
    const $item = miniStore.create(itemRef);
    const $isReady = miniStore.create(isReadyRef);
    return {
      $item,
      $isReady,
      updateItem: (item) => {
        $item.set(item);
        $isReady.set(true);
      },
    };
  }, []);

  return <FeatureContext.Provider value={ctx}>{children}</FeatureContext.Provider>;
};

export const useFeatureContext = () => useContext(FeatureContext);
```

The optional `value` prop seeds the refs. Use it for SSR, tests and stories.

Consumers:

```tsx
const ItemLabel = () => {
  const { $item } = useFeatureContext();
  const [item] = useMiniStore($item);
  return <span>{item.name}</span>;
};

const RenameButton = () => {
  const { $item, updateItem } = useFeatureContext();
  return <button onClick={() => updateItem({ ...$item.get(), name: "renamed" })}>Rename</button>;
};
```

`RenameButton` reads with `.get()` inside the handler and never subscribes, so it doesn't
re-render when `$item` changes.

Several stores in one call:

```tsx
const { $item, $isReady } = useFeatureContext();
const [item, isReady] = useMiniStore($item, $isReady);
```

## Rules. Break these and you get bugs.

1. **Create the handle once.** Put `miniStore.create(ref)` inside `useMemo(() => …, [])`
   (or `useState(() => …)`). If you call `create` on every render, you get a new handle each
   time. Values survive because they live in the ref, but a callback that captured an old
   handle notifies that old handle's subscribers, not the current ones.
2. **The ref must outlive renders.** Use `useRef` in a component or a module-level
   `{ current }` for app-wide singletons. Don't create an inline `{ current: x }` during
   render.
3. **Immutable updates only.** `set` compares with `Object.is`, so mutating an object and
   calling `set` with the same reference does nothing:
   ```ts
   // wrong: same reference, no notify, no re-render
   const item = $item.get(); item.name = "x"; $item.set(item);
   // right
   $item.set({ ...$item.get(), name: "x" });
   ```
4. **Keep the number of arguments to `useMiniStore` fixed.** It calls one hook per store,
   so the rules of hooks apply. Don't write `useMiniStore(...(cond ? [$a, $b] : [$a]))`. Also
   don't call it inside a condition or a loop.
5. **Read in render with `useMiniStore`, and read in callbacks with `.get()`.** Calling
   `.get()` during render doesn't subscribe, so the component won't update.
6. **Write with `.set()` from anywhere**: event handlers, effects, async callbacks, or
   non-React code. It runs synchronously, and subscribed components re-render.
7. **Don't call `.set()` during render.** Do it in handlers or effects, as with any
   external store.

## Non-React / outside-component use

A handle is a plain observable, so you can use it anywhere:

```ts
const $online = miniStore.create({ current: navigator.onLine });
window.addEventListener("online", () => $online.set(true));
window.addEventListener("offline", () => $online.set(false));

const stop = $online.sub((online) => console.log("online:", online));
stop();
```

## SSR

`useMiniStore` passes `get` as the server snapshot, so `renderToString` renders the ref's
current value. To keep SSR and hydration in sync, seed the provider with the same `value` on
the server and the client (for example, data the server injects into the page).

## Testing

Seed the provider through its `value` prop. You don't need mocks:

```tsx
import { render, screen } from "@testing-library/react";

render(
  <FeatureProvider value={{ item: { id: "1", name: "first" } }}>
    <ItemLabel />
  </FeatureProvider>,
);
expect(screen.getByText("first")).toBeTruthy();
```

A store on its own:

```tsx
import { act, renderHook } from "@testing-library/react";

const $item = miniStore.create({ current: { id: "1", name: "first" } });
const { result } = renderHook(() => useMiniStore($item));
act(() => $item.set({ id: "1", name: "second" }));
expect(result.current[0].name).toBe("second");
```

## When NOT to use it

- You need selectors, derived state across stores, middleware or devtools: use a fuller
  library (Zustand, Jotai, Redux Toolkit). ministore leaves these out on purpose.
- State local to one component: use `useState`.
