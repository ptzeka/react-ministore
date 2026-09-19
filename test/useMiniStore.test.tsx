import React, { createContext, useContext, useMemo, useRef } from "react";
import { renderToString } from "react-dom/server";
import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it } from "vitest";
import { miniStore, useMiniStore, type IMiniStore } from "../src";

describe("useMiniStore", () => {
  it("returns a one-element tuple for a single store", () => {
    const $theme = miniStore.create({ current: "light" });
    const { result } = renderHook(() => useMiniStore($theme));
    expect(result.current).toEqual(["light"]);
  });

  it("returns values in argument order for several stores", () => {
    const $token = miniStore.create({ current: "abc" });
    const $ready = miniStore.create({ current: true });
    const { result } = renderHook(() => useMiniStore($token, $ready));
    expect(result.current).toEqual(["abc", true]);
  });

  it("infers a typed tuple", () => {
    const $token = miniStore.create({ current: "abc" });
    const $count = miniStore.create({ current: 1 });
    const { result } = renderHook(() => useMiniStore($token, $count));
    expectTypeOf(result.current).toEqualTypeOf<[string, number]>();
  });

  it("re-renders when a subscribed store is set", () => {
    const $count = miniStore.create({ current: 0 });
    const { result } = renderHook(() => useMiniStore($count));
    act(() => $count.set(3));
    expect(result.current).toEqual([3]);
  });

  it("does not re-render when set to the same value", () => {
    const $count = miniStore.create({ current: 0 });
    let renders = 0;
    renderHook(() => {
      renders++;
      return useMiniStore($count);
    });
    const rendersAfterMount = renders;
    act(() => $count.set(0));
    expect(renders).toBe(rendersAfterMount);
  });

  it("unsubscribes on unmount", () => {
    const $count = miniStore.create({ current: 0 });
    const { unmount } = renderHook(() => useMiniStore($count));
    unmount();
    expect(() => $count.set(1)).not.toThrow();
  });

  it("renders the current value on the server", () => {
    const $theme = miniStore.create({ current: "dark" });
    const Theme = () => {
      const [theme] = useMiniStore($theme);
      return <span>{theme}</span>;
    };
    expect(renderToString(<Theme />)).toBe("<span>dark</span>");
  });
});

describe("one value per store", () => {
  interface IUser {
    userName: string;
    email: string;
  }

  it("re-renders a $userName subscriber only when the name changes", () => {
    const userRef = { current: { userName: "ann", email: "a@x.io" } as IUser };
    const userNameRef = { current: userRef.current.userName };
    const $user = miniStore.create(userRef);
    const $userName = miniStore.create(userNameRef);
    const updateUser = (user: IUser) => {
      $user.set(user);
      $userName.set(user.userName);
    };

    let nameRenders = 0;
    const name = renderHook(() => {
      nameRenders++;
      return useMiniStore($userName);
    });
    const user = renderHook(() => useMiniStore($user));
    const rendersAfterMount = nameRenders;

    act(() => updateUser({ ...$user.get(), email: "b@x.io" }));
    expect(user.result.current[0].email).toBe("b@x.io");
    expect(nameRenders).toBe(rendersAfterMount);

    act(() => updateUser({ ...$user.get(), userName: "bob" }));
    expect(name.result.current).toEqual(["bob"]);
    expect(nameRenders).toBe(rendersAfterMount + 1);
  });
});

describe("provider pattern", () => {
  interface IThemeContext {
    $theme: IMiniStore<string>;
  }

  const ThemeContext = createContext<IThemeContext>({ $theme: miniStore.create({ current: "light" }) });

  const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const themeRef = useRef("light");
    const ctx = useMemo(() => ({ $theme: miniStore.create(themeRef) }), []);
    return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
  };

  it("lets a consumer read and a sibling write through the context handle", () => {
    const Label = () => {
      const { $theme } = useContext(ThemeContext);
      const [theme] = useMiniStore($theme);
      return <span data-testid="theme">{theme}</span>;
    };
    let handle: IMiniStore<string> | undefined;
    const Capture = () => {
      handle = useContext(ThemeContext).$theme;
      return null;
    };

    render(
      <ThemeProvider>
        <Label />
        <Capture />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("light");

    act(() => handle!.set("dark"));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
  });
});
