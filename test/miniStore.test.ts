import { describe, expect, it, vi } from "vitest";
import { miniStore } from "../src";

describe("miniStore", () => {
  it("reads the seeded ref value", () => {
    const $count = miniStore.create({ current: 1 });
    expect($count.get()).toBe(1);
  });

  it("writes through to the ref it was created with", () => {
    const ref = { current: "light" };
    const $theme = miniStore.create(ref);
    $theme.set("dark");
    expect(ref.current).toBe("dark");
    expect($theme.get()).toBe("dark");
  });

  it("shares state between handles created over the same ref", () => {
    const ref = { current: 0 };
    const first = miniStore.create(ref);
    const second = miniStore.create(ref);
    first.set(5);
    expect(second.get()).toBe(5);
  });

  it("notifies subscribers with the new value", () => {
    const $count = miniStore.create({ current: 0 });
    const listener = vi.fn();
    $count.sub(listener);
    $count.set(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(1);
  });

  it("skips the notify when the value is Object.is-equal", () => {
    const user = { name: "a" };
    const $user = miniStore.create({ current: user });
    const $nan = miniStore.create({ current: NaN });
    const listener = vi.fn();
    $user.sub(listener);
    $nan.sub(listener);

    user.name = "b";
    $user.set(user);
    $nan.set(NaN);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after the returned unsubscribe runs", () => {
    const $count = miniStore.create({ current: 0 });
    const listener = vi.fn();
    const unsubscribe = $count.sub(listener);
    unsubscribe();
    $count.set(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsub(callback)", () => {
    const $count = miniStore.create({ current: 0 });
    const listener = vi.fn();
    $count.sub(listener);
    $count.unsub(listener);
    $count.set(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it("still notifies every listener when one unsubscribes mid-notify", () => {
    const $count = miniStore.create({ current: 0 });
    const second = vi.fn();
    const first = vi.fn(() => $count.unsub(second));
    $count.sub(first);
    $count.sub(second);
    $count.set(1);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("keeps methods bound when destructured", () => {
    const { get, set, sub } = miniStore.create({ current: 0 });
    const listener = vi.fn();
    sub(listener);
    set(2);
    expect(get()).toBe(2);
    expect(listener).toHaveBeenCalledWith(2);
  });
});
