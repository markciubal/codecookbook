// Browser / build-time stub for logos-sort/lib/native.js.
//
// The upstream native.js requires `../build/Release/logos_sort_native.node`
// inside a try/catch — the intent is "load the C addon if present, otherwise
// fall through to the pure-JS engine." That try/catch works at runtime but
// webpack's static analysis still walks the require() call and fails when the
// .node file isn't present on the build host (Heroku, CI, etc.). We alias
// native.js to this stub in next.config.ts so the bundler never sees the
// .node path, and the pure-JS engine gets used everywhere (which is what we
// want on the client anyway — WASM/native bindings would need their own port).
module.exports = {
  available: false,
  loadError: null,
  sortFloat64Array: null,
  sortNumberArray: null,
  version: null,
};
