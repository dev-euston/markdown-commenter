import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom in this project exposes a `localStorage` global that lacks working
// methods, and `Storage.prototype` methods rely on internal slots our tests
// can't populate. Install a simple, spy-able Storage-backed implementation so
// `localStorage.*` works and `vi.spyOn(Storage.prototype, ...)` intercepts it.
const store = new Map<string, string>();
Storage.prototype.getItem = function (key: string) {
  return store.has(String(key)) ? store.get(String(key))! : null;
};
Storage.prototype.setItem = function (key: string, value: string) {
  store.set(String(key), String(value));
};
Storage.prototype.removeItem = function (key: string) {
  store.delete(String(key));
};
Storage.prototype.clear = function () {
  store.clear();
};
const storage = Object.create(Storage.prototype) as Storage;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storage,
});

// Unmount React trees and clear jsdom between tests.
afterEach(() => {
  cleanup();
});
