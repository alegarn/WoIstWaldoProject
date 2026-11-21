export const VIABILITY_FILTER_CHUNK_SIZE = 200;

/**
 * Macrotask yield so synchronous MMKV reads can't stall the JS thread
 * during big-deck sweeps.
 */
export function yieldToThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
