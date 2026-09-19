export interface StoreRef<T> {
  current: T;
}

export interface IMiniStore<T> {
  unsub(callback: (t: T) => void): void;
  sub(callback: (t: T) => void): () => void;
  get(): T;
  set(t: T): void;
}

class MiniStore<T> implements IMiniStore<T> {
  private listeners = new Set<(t: T) => void>();
  private value: StoreRef<T>;

  constructor(initialValue: StoreRef<T>) {
    this.value = initialValue;
  }

  private notify() {
    [...this.listeners].forEach((cb) => cb(this.value.current));
  }

  public unsub = (callback: (t: T) => void): void => {
    this.listeners.delete(callback);
  };

  public sub = (callback: (t: T) => void): (() => void) => {
    this.listeners.add(callback);
    return () => this.unsub(callback);
  };

  public get = (): T => {
    return this.value.current;
  };

  public set = (t: T): void => {
    if (!Object.is(this.value.current, t)) {
      this.value.current = t;
      this.notify();
    }
  };
}

export const miniStore = {
  create<T>(initialValue: StoreRef<T>): IMiniStore<T> {
    return new MiniStore<T>(initialValue);
  },
};

export type StoreValue<S> = S extends IMiniStore<infer T> ? T : never;
export type StoreValues<Stores extends IMiniStore<unknown>[]> = {
  [K in keyof Stores]: StoreValue<Stores[K]>;
};
