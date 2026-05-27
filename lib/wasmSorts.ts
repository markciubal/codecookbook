/*
 * Lazy loader + JS-side marshalling for the AssemblyScript-compiled Wasm sorts.
 *
 * The Wasm module sorts in place on its linear memory; the JS side is responsible
 * for copying its array into the wasm view, calling the export, and copying the
 * sorted result back. That copy IS measured by the benchmark — Wasm rows are
 * comparing the same `fn(arr) => arr` contract as the JS rows, and the marshal
 * cost is part of what calling Wasm from JS actually costs in practice.
 *
 * If `/wasm-sorts/sorts.wasm` hasn't been compiled yet (fresh clone, before
 * `npm run build:wasm`), the loader resolves to `null` and the benchmark's
 * engine selector grays out the Wasm choice — no error, no broken runs.
 */

interface WasmExports {
  memory: WebAssembly.Memory;
  insertionSortI32: (offset: number, length: number) => void;
  quickSortI32:     (offset: number, length: number) => void;
  /** LogosAdaptive v3.7.1 — int32-only port. Needs a scratch region (one
   *  swap-buffer of `length × 4` bytes followed by four 257-bucket i32
   *  histograms, 4112 bytes total). The JS wrapper handles the sizing. */
  logosSortI32:     (dataOffset: number, length: number, scratchOffset: number) => void;
}

/** Set of algorithm ids this Wasm module can currently sort. Used by the
 *  dispatch check in BenchmarkVisualizer to decide whether to route a given
 *  (id, dataType) to Wasm or fall back to V8. */
export const WASM_SUPPORTED: ReadonlySet<string> = new Set(["insertion", "quick", "logos"]);

// 4 × 257-bucket i32 histograms = 4112 bytes. Caller appends after the
// (length * 4)-byte swap buffer in the scratch region.
const LOGOS_HIST_BYTES = 4 * 257 * 4;

const WASM_URL = "/wasm-sorts/sorts.wasm";
// Skip the first 1 KiB of linear memory to stay out of the way of the stub
// runtime's bookkeeping; everything from DATA_OFFSET upward is ours to use.
const DATA_OFFSET = 1024;
const PAGE = 65536;

let modulePromise: Promise<WasmExports | null> | null = null;

/** Fetch + instantiate the .wasm exactly once per page. Subsequent calls
 *  return the cached promise. Returns `null` (and warns once) if the asset
 *  isn't present — caller is expected to fall back to V8. */
function loadWasm(): Promise<WasmExports | null> {
  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        if (typeof fetch === "undefined" || typeof WebAssembly === "undefined") return null;
        const resp = await fetch(WASM_URL);
        if (!resp.ok) return null;
        const bytes = await resp.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, {
          env: {
            // The stub runtime calls `abort` for unrecoverable errors. Surface
            // it as a real JS Error so it's visible in the benchmark loop's
            // try/catch instead of silently corrupting memory.
            abort(_msg: number, _file: number, _line: number, _col: number) {
              throw new Error("Wasm sort aborted");
            },
          },
        });
        return instance.exports as unknown as WasmExports;
      } catch (e) {
        console.warn("[wasmSorts] could not load " + WASM_URL + " — Wasm engine disabled. Run `npm run build:wasm` to enable.", e);
        return null;
      }
    })();
  }
  return modulePromise;
}

/** Ensure linear memory is at least `bytesNeeded` bytes; grow in 64 KiB pages
 *  if not. Growth detaches previous typed-array views, so callers must
 *  re-create their view AFTER calling this. */
function ensureMemory(mem: WebAssembly.Memory, bytesNeeded: number): void {
  const have = mem.buffer.byteLength;
  if (bytesNeeded <= have) return;
  const pages = Math.ceil((bytesNeeded - have) / PAGE);
  mem.grow(pages);
}

export type WasmSortFn = (arr: number[]) => number[];

export interface WasmSortBundle {
  ready: true;
  byId: Record<string, WasmSortFn>;
}
export interface WasmSortMissing { ready: false }

/** Resolve to either the ready bundle (with a `byId` map of supported sorts)
 *  or `{ ready: false }` when the .wasm isn't present. Cached per page. */
export async function getWasmSorts(): Promise<WasmSortBundle | WasmSortMissing> {
  const m = await loadWasm();
  if (!m) return { ready: false };

  const wrap = (call: (off: number, len: number) => void): WasmSortFn => (arr) => {
    const n = arr.length;
    if (n <= 1) return arr;
    const bytesNeeded = DATA_OFFSET + n * 4;
    ensureMemory(m.memory, bytesNeeded);
    // Re-create the view AFTER any potential grow above.
    const view = new Int32Array(m.memory.buffer, DATA_OFFSET, n);
    // Marshal in. `| 0` truncates each value to a safe 32-bit signed int so a
    // stray float doesn't silently corrupt the comparison; out-of-range values
    // wrap, which is on the caller — these sorts are i32 only.
    for (let i = 0; i < n; i++) view[i] = arr[i] | 0;
    // Sort in place inside Wasm memory.
    call(DATA_OFFSET, n);
    // Marshal out. Write back into the same array reference so callers that
    // rely on mutation (the benchmark proof capture does) see the result.
    for (let i = 0; i < n; i++) arr[i] = view[i];
    return arr;
  };

  // Logos needs more space than insertion/quick because the radix path uses a
  // swap buffer + four 257-bucket histograms. We pre-allocate the full layout
  // (data + scratch + histograms) before the first byte goes in.
  const wrapLogos = (): WasmSortFn => (arr) => {
    const n = arr.length;
    if (n <= 1) return arr;
    const scratchOffset = DATA_OFFSET + n * 4;
    const bytesNeeded = scratchOffset + n * 4 + LOGOS_HIST_BYTES;
    ensureMemory(m.memory, bytesNeeded);
    const view = new Int32Array(m.memory.buffer, DATA_OFFSET, n);
    for (let i = 0; i < n; i++) view[i] = arr[i] | 0;
    m.logosSortI32(DATA_OFFSET, n, scratchOffset);
    for (let i = 0; i < n; i++) arr[i] = view[i];
    return arr;
  };

  return {
    ready: true,
    byId: {
      insertion: wrap(m.insertionSortI32),
      quick:     wrap(m.quickSortI32),
      logos:     wrapLogos(),
    },
  };
}
