# wasm-sorts

A small AssemblyScript module that compiles a couple of sorts to WebAssembly so
the benchmark can compare V8-JIT'd JavaScript against a Wasm baseline.

## What's in here today

`assembly/index.ts` exports three sorts over **32-bit integers**, all operating
in place on the WebAssembly linear memory at a caller-provided byte offset:

- `insertionSortI32(offset, length)` — straight insertion sort. Comparison
  baseline; will get beaten by quicksort at any meaningful `n`.
- `quickSortI32(offset, length)` — Hoare-partition quicksort with median-of-3
  pivots, insertion-sort fallback under 16 elements, and tail-loop on the
  larger side (so recursion depth stays O(log n)).
- `logosSortI32(dataOffset, length, scratchOffset)` — int32 port of
  **LogosAdaptive v3.7.1**. Asc/desc fast paths · LSD radix int32 (n ≥ 64) ·
  Yaroslavskiy dual-pivot 3-way introsort with depth-limited heapsort
  fallback for the 25–63 sliver. Needs a scratch region: a `length × 4`-byte
  swap buffer followed by four 257-bucket i32 histograms (4112 bytes); the
  JS wrapper in `lib/wasmSorts.ts` sizes + grows linear memory for you.

Deliberately omitted from the Logos port:

- counting sort, flash sort, float64 LSD radix — float-only or need a
  JS-side allocator we don't have under `--runtime stub`;
- natural-runs merge with galloping — its main payoff is for non-radix,
  non-int32 data, and for our pure-i32 input the radix path preempts it at
  `n ≥ 64` while insertion sort handles `n ≤ 24`.

No allocator is involved — the module is compiled with `--runtime stub` and
the helpers use raw `load<i32>` / `store<i32>` on linear memory. The JS caller
(see `lib/wasmSorts.ts`) handles the marshalling: copy data into a
view of wasm memory, call the export, copy the sorted data back out.

## Build

```bash
# One-time: pick up the AssemblyScript devDependency
npm install

# Compile to public/wasm-sorts/sorts.wasm
npm run build:wasm
```

The `.wasm` lands in `public/wasm-sorts/` so Next serves it as a static asset
at `/wasm-sorts/sorts.wasm`. The loader in `lib/wasmSorts.ts` fetches it on
first use and caches the instantiation.

## How the benchmark uses it

Once the `.wasm` is present, the **Engine** toggle in the benchmark's Advanced
panel (`Measurement` group) becomes selectable. Choosing `Wasm` swaps the
**Insertion Sort** and **Quick Sort** rows to call the Wasm exports instead of
the V8 implementations — for **integer** data only. Other algorithms / data
types silently keep using V8 even when Wasm is selected.

If the `.wasm` isn't built yet the toggle is disabled and the benchmark runs
on V8 as before — there's no error, just a one-line note in the toggle that
points back to `npm run build:wasm`.

## Caveats

- **Marshalling is on the clock.** Each Wasm call includes the copy-in /
  copy-out cost. This is the honest number for "what your code would actually
  measure if it called Wasm." At small `n` the copy dominates; at large `n`
  the kernel dominates. Both regimes are interesting.
- **Integer-only.** Float and string ports are deferred — strings especially
  need UTF-8 encoding + a length-prefixed packing into linear memory.
- **No instrumented aux memory for the Wasm side.** `measureAllocBytes`
  patches JS allocators; it can't see Wasm `memory.grow`. The in-place verdict
  for Wasm rows uses the marshalling buffer (`length × 4` bytes) as a proxy.

## Expanding

To add another sort:

1. Write the kernel in `assembly/index.ts` as an `export function … (offset, length): void`.
2. Re-run `npm run build:wasm`.
3. Add the export name + ALGO id mapping in `lib/wasmSorts.ts`.
4. Whitelist the algo in the engine-dispatch check in `BenchmarkVisualizer.tsx`.
