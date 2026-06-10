/** Round to the nearest cent, half-up — applied only at T4127-specified steps. */
export function roundCent(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}
