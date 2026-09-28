// Inverse calculation (net -> gross, employer cost -> gross).
// fn maps gross (minor units) to the target quantity and must be non-decreasing
// apart from rounding noise of a few minor units. Several gross amounts can map
// to the same net; the smallest one is returned.

const NOISE_WINDOW = 10;
const SEARCH_LIMIT = 1e12;

export function solveSmallest(fn, target) {
  let lo = 0;
  let hi = Math.max(100, target * 2);
  while (fn(hi) < target) {
    hi *= 2;
    if (hi > SEARCH_LIMIT) return null;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fn(mid) >= target) hi = mid;
    else lo = mid + 1;
  }
  for (let x = Math.max(0, lo - NOISE_WINDOW); x <= lo + NOISE_WINDOW; x++) {
    if (fn(x) === target) return { gross: x, exact: true };
  }
  return { gross: lo, exact: false };
}
