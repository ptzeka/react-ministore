# @ministore/react

A tiny subscribable single-value store for React, under 1 kB gzipped with no dependencies.
Providers own a `{ current }` ref and wrap it in a store handle. Components subscribe with
`useMiniStore`, which uses `useSyncExternalStore` underneath, so only components that read a
store re-render when it changes.

```sh
npm install @ministore/react
```

Requires React 18 or later.

## Quick start

```tsx
import { miniStore, useMiniStore } from "@ministore/react";

const $count = miniStore.create({ current: 0 });

function Counter() {
  const [count] = useMiniStore($count);
  return <button onClick={() => $count.set(count + 1)}>{count}</button>;
}
```

## API

### `miniStore.create<T>(ref: { current: T }): IMiniStore<T>`

Wraps an existing ref and returns a handle. The handle reads from and writes to that ref, so
the owner of the ref (for example, a provider's `useRef`) always holds the latest value.

### `IMiniStore<T>`

| Method | Description |
| --- | --- |
| `get(): T` | Returns the current value. Does not subscribe. |
| `set(value: T): void` | Writes the value and notifies subscribers. Skipped when `Object.is(old, value)`. |
| `sub(cb): () => void` | Subscribes and returns an unsubscribe function. |
| `unsub(cb): void` | Removes a subscriber. |

The methods are bound, so they are safe to destructure or pass around.

### `useMiniStore(...stores)`

Subscribes to one or more stores and returns a typed tuple of their current values. Always
destructure the result:

```ts
const [theme] = useMiniStore($theme);
const [token, config] = useMiniStore($accessToken, $config); // [string, IConfiguration]
```

Pass the same number of stores on every render, because the hook is called once per store.

## One value per store

You subscribe to a whole store, one store at a time. There are no selectors, so you can't
subscribe to part of a value. `$user` and `$userName` are separate stores. If you want the user
name tracked separately for performance, create a second store and update both in one place:

```ts
const updateUser = (user: IUser) => {
  $user.set(user);
  $userName.set(user.userName); // unchanged name: no notify, no re-render
};
```

Components that call `useMiniStore($userName)` then re-render only when the name changes.
Start with one store, and split only when there's a real re-render cost.

## The provider pattern

Put stable handles in context, not values. The context value never changes, so providing it
re-renders nothing. Each consumer subscribes only to the stores it reads.

```tsx
import React, { createContext, useContext, useMemo, useRef } from "react";
import { miniStore, useMiniStore, type IMiniStore } from "@ministore/react";

interface IThemeContext {
  $theme: IMiniStore<"light" | "dark">;
}

const ThemeContext = createContext<IThemeContext>({
  $theme: miniStore.create<"light" | "dark">({ current: "light" }),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeRef = useRef<"light" | "dark">("light");
  const ctx = useMemo(() => ({ $theme: miniStore.create(themeRef) }), []); // create once
  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
}

function ThemeToggle() {
  const { $theme } = useContext(ThemeContext);
  const [theme] = useMiniStore($theme);
  return <button onClick={() => $theme.set(theme === "light" ? "dark" : "light")}>{theme}</button>;
}
```

## Gotchas

- **Update immutably.** `set` compares by reference, so a mutated object passed back to `set`
  does not notify. Use `$user.set({ ...$user.get(), name })`.
- **Create handles once.** Wrap `miniStore.create` in `useMemo`/`useState` inside components.
- **Reading in render needs `useMiniStore`.** Calling `get()` in render does not subscribe.
- **SSR:** `get` is also the server snapshot, so seed the ref with the same value on the server
  and the client.

## AI agent skill

The package ships a Claude Code / agent skill at `skills/ministore/SKILL.md`. It covers usage
conventions, the provider pattern, and the rules that prevent the common bugs. To make it
available to an agent in your project:

```sh
mkdir -p .claude/skills
cp -r node_modules/@ministore/react/skills/ministore .claude/skills/
```

## License

MIT
