// Node 25 ships an experimental global `localStorage` that has no methods
// unless Node is started with --localstorage-file, and it shadows jsdom's
// working one. In jsdom test files, put jsdom's storage back.
const dom = (globalThis as { jsdom?: { window?: { localStorage?: Storage } } }).jsdom;
if (dom?.window?.localStorage) {
  Object.defineProperty(globalThis, "localStorage", { value: dom.window.localStorage, configurable: true });
}
