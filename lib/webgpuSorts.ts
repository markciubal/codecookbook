/*
 * Lazy loader + JS-side marshalling for WebGPU-resident sorts.
 *
 * Mirrors `lib/wasmSorts.ts` but the "runtime" here is the browser's GPU
 * driver, not a compiled .wasm artifact. Detection actually calls
 * `navigator.gpu.requestAdapter()` + `.requestDevice()` so we know we can
 * talk to a real GPU before exposing the engine option to the user.
 *
 * v1 ships one kernel: bitonic sort on int32. Bitonic is the canonical first
 * GPU sort because its compare-swap network is data-independent — every
 * index runs lockstep with no branch divergence. Worse asymptotic work than
 * an O(n log n) comparison sort, but the GPU's parallelism more than makes
 * up for it at the sizes the benchmark cares about.
 *
 * The kernel sorts int32 only. Floats and strings silently fall back to V8
 * via the dispatch check in BenchmarkVisualizer. Non-power-of-2 lengths get
 * padded internally with `i32.MAX_VALUE` (sentinels sort to the high end);
 * the wrapper trims them on the way out. Padding work IS counted in the
 * timing — same "honest 'JS calling Wasm/WebGPU' number" rule as the Wasm
 * marshalling buffers.
 *
 * To add another GPU sort:
 *   1. Author the WGSL + the JS wrapper that handles buffer marshalling,
 *      bind-group layout, and dispatch.
 *   2. Add its (algoId, wrapperFn) entry to the `byId` map in
 *      `buildKernels`.
 *   3. Add the algoId to `WEBGPU_SUPPORTED`.
 *   4. The dispatch branch in BenchmarkVisualizer already picks it up.
 */

// ── Narrow WebGPU types ─────────────────────────────────────────────────────
// Declared locally so the file doesn't need `@types/web-gpu` (Next 16 doesn't
// pull that in by default). Only the surface we actually touch is typed.
type GPUBufferUsage = number;
type GPUMapMode = number;

interface GPUBufferLike {
  size: number;
  destroy(): void;
  mapAsync(mode: GPUMapMode, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
}

interface GPUBindGroupLayoutLike { readonly __brand?: "bgl" }
interface GPUPipelineLayoutLike  { readonly __brand?: "pl" }
interface GPUComputePipelineLike { getBindGroupLayout(index: number): GPUBindGroupLayoutLike }
interface GPUBindGroupLike       { readonly __brand?: "bg" }
interface GPUShaderModuleLike    { readonly __brand?: "sm" }

interface GPUCommandEncoderLike {
  beginComputePass(): {
    setPipeline(p: GPUComputePipelineLike): void;
    setBindGroup(index: number, bg: GPUBindGroupLike): void;
    dispatchWorkgroups(x: number, y?: number, z?: number): void;
    end(): void;
  };
  copyBufferToBuffer(src: GPUBufferLike, srcOff: number, dst: GPUBufferLike, dstOff: number, size: number): void;
  finish(): { readonly __brand?: "cb" };
}

interface GPUQueueLike {
  submit(buffers: { readonly __brand?: "cb" }[]): void;
  writeBuffer(buf: GPUBufferLike, offset: number, data: ArrayBufferView | ArrayBuffer, dataOffset?: number, size?: number): void;
  onSubmittedWorkDone(): Promise<void>;
}

interface GPUDeviceLike {
  readonly features?: ReadonlySetLike<string>;
  readonly limits?: { readonly maxComputeWorkgroupsPerDimension?: number };
  readonly queue: GPUQueueLike;
  createBuffer(desc: { size: number; usage: GPUBufferUsage; mappedAtCreation?: boolean }): GPUBufferLike;
  createShaderModule(desc: { code: string }): GPUShaderModuleLike;
  createBindGroupLayout(desc: { entries: { binding: number; visibility: number; buffer: { type: "storage" | "read-only-storage" | "uniform" } }[] }): GPUBindGroupLayoutLike;
  createPipelineLayout(desc: { bindGroupLayouts: GPUBindGroupLayoutLike[] }): GPUPipelineLayoutLike;
  createComputePipeline(desc: { layout: GPUPipelineLayoutLike; compute: { module: GPUShaderModuleLike; entryPoint: string } }): GPUComputePipelineLike;
  createBindGroup(desc: { layout: GPUBindGroupLayoutLike; entries: { binding: number; resource: { buffer: GPUBufferLike } }[] }): GPUBindGroupLike;
  createCommandEncoder(): GPUCommandEncoderLike;
}

interface ReadonlySetLike<T> {
  has(value: T): boolean;
  forEach(callback: (value: T) => void): void;
}

// WebGPU usage flags — declared as constants because the runtime enum may not
// be present in older `lib.dom` typings. Values are from the WebGPU spec.
const GPUBufferUsageFlags = {
  MAP_READ:  0x0001,
  COPY_SRC:  0x0004,
  COPY_DST:  0x0008,
  UNIFORM:   0x0040,
  STORAGE:   0x0080,
} as const;
const GPUShaderStage = { COMPUTE: 0x4 } as const;
const GPUMapModes    = { READ: 0x1 } as const;

/** The id strings here MUST match algorithm IDs in `SORT_FNS` — same contract
 *  as `WASM_SUPPORTED`. v1: bitonic only. */
export const WEBGPU_SUPPORTED: ReadonlySet<string> = new Set<string>(["bitonic"]);

export type WebGpuSortFn = (arr: number[]) => Promise<number[]>;

export interface WebGpuSortBundle {
  ready: true;
  /** Adapter/device handle is held but not exposed — kernels reach for it via
   *  the closure inside each wrapper. Stored here purely so the page-level
   *  hydration effect can read `info` for the status banner. */
  device: GPUDeviceLike;
  /** Best-effort adapter description (vendor / architecture / device name).
   *  May be empty depending on the browser's `requestAdapterInfo` support. */
  info: { vendor?: string; architecture?: string; device?: string; description?: string };
  /** Same shape as the Wasm bundle: a per-algo callable. The wrapper handles
   *  buffer marshalling so the benchmark loop doesn't need to know about
   *  GPUBuffer lifetimes. All GPU wrappers are async — the benchmark's
   *  timing path is set up to await Promise returns. */
  byId: Record<string, WebGpuSortFn>;
}

export interface WebGpuSortMissing {
  ready: false;
  /** Diagnostic string surfaced in the status banner so the user can tell
   *  "GPU unavailable in this browser" apart from "adapter request failed". */
  reason: string;
}

let bundlePromise: Promise<WebGpuSortBundle | WebGpuSortMissing> | null = null;

/** Probe `navigator.gpu` once per page and cache the result. The reason
 *  string is preserved across calls so the status banner is stable. */
export function getWebgpuSorts(): Promise<WebGpuSortBundle | WebGpuSortMissing> {
  if (bundlePromise) return bundlePromise;

  bundlePromise = (async () => {
    if (typeof navigator === "undefined") {
      return { ready: false, reason: "navigator unavailable (SSR)" } as const;
    }
    const nav = navigator as Navigator & { gpu?: { requestAdapter: (opts?: unknown) => Promise<unknown | null> } };
    if (!nav.gpu) {
      return { ready: false, reason: "navigator.gpu missing — browser lacks WebGPU support" } as const;
    }

    try {
      const adapter = (await nav.gpu.requestAdapter()) as {
        requestDevice: () => Promise<GPUDeviceLike>;
        requestAdapterInfo?: () => Promise<{ vendor?: string; architecture?: string; device?: string; description?: string }>;
      } | null;
      if (!adapter) {
        return { ready: false, reason: "no GPU adapter available — check chrome://gpu or driver status" } as const;
      }
      const device = await adapter.requestDevice();
      let info: WebGpuSortBundle["info"] = {};
      try {
        if (typeof adapter.requestAdapterInfo === "function") {
          info = await adapter.requestAdapterInfo();
        }
      } catch { /* not fatal — info is cosmetic */ }

      const byId = buildKernels(device);
      return { ready: true, device, info, byId } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ready: false, reason: `adapter/device request failed: ${msg}` } as const;
    }
  })();

  return bundlePromise;
}

// ── Kernels ──────────────────────────────────────────────────────────────────

function buildKernels(device: GPUDeviceLike): Record<string, WebGpuSortFn> {
  return {
    bitonic: buildBitonicSort(device),
  };
}

/* ── Bitonic Sort (int32) ───────────────────────────────────────────────────
 * Network of compare-swap passes, one workgroup-dispatch per (k, j) layer.
 * Each invocation handles one array index i; it compares with index i⊕j and
 * swaps if the pair is out of order for the layer's direction (i&k decides).
 *
 * Power-of-2 length is required by the algorithm. We pad with i32.MAX_VALUE
 * (2^31 - 1) which sorts to the high end; the wrapper trims after readback.
 *
 * Total dispatches: sum over k=2,4,...,p of log2(k) = log2(p) · (log2(p)+1) / 2
 * ≈ ½ log²(p). For n=1M (p=1M, log2=20), ~210 dispatches. Each dispatch is
 * cheap (just a uniform write + workgroup launch), but the total adds a few
 * ms of host-side overhead — that's part of the honest measurement.
 */
function buildBitonicSort(device: GPUDeviceLike): WebGpuSortFn {
  const WGSL = /* wgsl */ `
    struct Params { k: u32, j: u32 };

    @group(0) @binding(0) var<storage, read_write> data: array<i32>;
    @group(0) @binding(1) var<uniform>             params: Params;

    @compute @workgroup_size(64)
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let i = gid.x;
      let n = arrayLength(&data);
      if (i >= n) { return; }
      let l = i ^ params.j;
      // Each pair handles itself once: the smaller-index invocation does the
      // compare-swap, the larger-index one bails. Also skip out-of-range pairs
      // (l >= n) so the padding-tail doesn't read past the buffer.
      if (l <= i || l >= n) { return; }
      let ascending = (i & params.k) == 0u;
      let a = data[i];
      let b = data[l];
      if (ascending) {
        if (a > b) { data[i] = b; data[l] = a; }
      } else {
        if (a < b) { data[i] = b; data[l] = a; }
      }
    }
  `;

  // Pipeline + bind-group layout are static across calls; compile them once.
  const module = device.createShaderModule({ code: WGSL });
  const bgLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bgLayout] });
  const pipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module, entryPoint: "main" },
  });

  // Per-size buffer cache. The benchmark hits ~3 sizes per run repeatedly, so
  // recycling buffers across calls of the same padded-size avoids the worst
  // of the allocation overhead. Keyed by padded length (always power-of-2).
  const cache = new Map<number, {
    data: GPUBufferLike;        // storage buffer holding the sort payload
    uniform: GPUBufferLike;     // 8-byte (k, j) uniform
    readback: GPUBufferLike;    // map-read buffer for the final copy-out
    bindGroup: GPUBindGroupLike;
  }>();

  return async function bitonicGpu(arr: number[]): Promise<number[]> {
    const n = arr.length;
    if (n <= 1) return arr.slice();

    // Round up to next power-of-2 — bitonic's hard requirement.
    let p = 1;
    while (p < n) p *= 2;

    // Build / fetch cached GPU buffers for this padded size.
    let cached = cache.get(p);
    if (!cached) {
      const data = device.createBuffer({
        size: p * 4,
        usage: GPUBufferUsageFlags.STORAGE | GPUBufferUsageFlags.COPY_SRC | GPUBufferUsageFlags.COPY_DST,
      });
      const uniform = device.createBuffer({
        size: 16, // round up to 16-byte alignment — WebGPU requires it for uniform buffers even if we only use 8 bytes
        usage: GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
      });
      const readback = device.createBuffer({
        size: p * 4,
        usage: GPUBufferUsageFlags.MAP_READ | GPUBufferUsageFlags.COPY_DST,
      });
      const bindGroup = device.createBindGroup({
        layout: bgLayout,
        entries: [
          { binding: 0, resource: { buffer: data } },
          { binding: 1, resource: { buffer: uniform } },
        ],
      });
      cached = { data, uniform, readback, bindGroup };
      cache.set(p, cached);
    }

    // Marshal the input into a typed-array view and upload. The padding tail
    // gets i32.MAX_VALUE so it sorts to the top and we can trim it off after.
    const host = new Int32Array(p);
    for (let i = 0; i < n; i++) host[i] = arr[i] | 0;
    if (p > n) host.fill(0x7fffffff, n, p);
    device.queue.writeBuffer(cached.data, 0, host.buffer, host.byteOffset, host.byteLength);

    // Workgroup grid: ceil(p / 64) groups of 64 invocations.
    const groups = Math.ceil(p / 64);
    // Reusable Uint32Array used to push (k, j) into the uniform buffer.
    const uniformScratch = new Uint32Array(4);

    // Encode the entire bitonic network in one command buffer. The outer-k /
    // inner-j loops live on the CPU side — we issue one dispatch per layer.
    // We rebuild the encoder each call because WebGPU forbids reusing one
    // after submit, but the pipeline + bind group are reused so the cost is
    // bounded to the encoder + dispatches themselves.
    const enc = device.createCommandEncoder();
    for (let k = 2; k <= p; k <<= 1) {
      for (let j = k >> 1; j > 0; j >>= 1) {
        uniformScratch[0] = k;
        uniformScratch[1] = j;
        device.queue.writeBuffer(cached.uniform, 0, uniformScratch.buffer, 0, 8);
        const pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, cached.bindGroup);
        pass.dispatchWorkgroups(groups);
        pass.end();
      }
    }
    // Copy storage → readback so the JS side can map it.
    enc.copyBufferToBuffer(cached.data, 0, cached.readback, 0, p * 4);
    device.queue.submit([enc.finish()]);

    // Block on readback — this is the unavoidable async point for any
    // GPU-resident result. The benchmark's timing loop awaits Promise returns
    // from `fn`, so this latency is correctly attributed to the algorithm.
    await cached.readback.mapAsync(GPUMapModes.READ, 0, p * 4);
    const mapped = cached.readback.getMappedRange(0, p * 4);
    const out = new Int32Array(mapped.slice(0)); // copy out of the mapped range BEFORE unmapping
    cached.readback.unmap();

    // Trim padding + materialize as number[] (the benchmark expects a plain
    // array, and the proof capture mutates it in place).
    const result: number[] = new Array(n);
    for (let i = 0; i < n; i++) result[i] = out[i];
    return result;
  };
}
