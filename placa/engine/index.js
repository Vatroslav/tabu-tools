// Entry point: forward calculation per jurisdiction plus generic inverse helpers.
import { calculateHR } from './hr.js';
import { solveSmallest } from './solve.js';

export const ENGINES = {
  HR: calculateHR,
};

export function calculate(country, input) {
  const engine = ENGINES[country];
  if (!engine) throw new RangeError(`Unknown jurisdiction ${country}`);
  return engine(input);
}

export function netToGross(country, input, targetNet) {
  return solveSmallest((gross) => calculate(country, { ...input, gross }).net, targetNet);
}

export function costToGross(country, input, targetCost) {
  return solveSmallest((gross) => calculate(country, { ...input, gross }).employerCost, targetCost);
}

export const netToGrossHR = (input, targetNet) => netToGross('HR', input, targetNet);
