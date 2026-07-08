// Safe entry into logos-sort that skips the package's index.js barrel.
//
// The upstream index.js unconditionally requires ./lib/native.js, which does
// a try/catch require of `../build/Release/logos_sort_native.node`. Webpack's
// static analysis walks the require chain and fails when the .node file
// isn't present at build time (Heroku, CI, browser bundle). Turbopack fails
// with "non-ecmascript placeable asset" for the same reason.
//
// The pure-JS engine modules — sort.js and sort-inplace.js — have zero
// external requires (each is a single self-contained IIFE). Importing them
// directly bypasses native.js entirely, so no bundler configuration is
// needed. This module owns the (loosely-typed) contract so the rest of the
// codebase can consume a plain typed API.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sortImpl        = require("logos-sort/lib/sort.js")         as (arr: (number | string)[]) => (number | string)[];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sortInplaceImpl = require("logos-sort/lib/sort-inplace.js") as (arr: (number | string)[]) => (number | string)[];

/** Adaptive-engine sort. Auxiliary buffers; fastest path on most workloads. */
export function sort<T extends number | string>(arr: T[]): T[] {
  return sortImpl(arr as (number | string)[]) as T[];
}

/** Minimal-memory sort. ~3KB scratch, slightly slower, in-place. */
export function sortInplace<T extends number | string>(arr: T[]): T[] {
  return sortInplaceImpl(arr as (number | string)[]) as T[];
}
