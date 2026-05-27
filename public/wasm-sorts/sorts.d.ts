declare namespace __AdaptedExports {
  /** Exported memory */
  export const memory: WebAssembly.Memory;
  /**
   * wasm-sorts/assembly/index/insertionSortI32
   * @param offset `i32`
   * @param length `i32`
   */
  export function insertionSortI32(offset: number, length: number): void;
  /**
   * wasm-sorts/assembly/index/quickSortI32
   * @param offset `i32`
   * @param length `i32`
   */
  export function quickSortI32(offset: number, length: number): void;
  /**
   * wasm-sorts/assembly/index/logosSortI32
   * @param dataOffset `i32`
   * @param length `i32`
   * @param scratchOffset `i32`
   */
  export function logosSortI32(dataOffset: number, length: number, scratchOffset: number): void;
}
/** Instantiates the compiled WebAssembly module with the given imports. */
export declare function instantiate(module: WebAssembly.Module, imports: {
}): Promise<typeof __AdaptedExports>;
