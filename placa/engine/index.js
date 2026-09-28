// Entry point: forward calculation per jurisdiction plus generic inverse helpers.
import { calculateHR } from './hr.js';
import { calculateSRB } from './srb.js';
import { calculateFBIH } from './fbih.js';
import { calculateRSBIH } from './rsbih.js';
import { calculateBD } from './bd.js';
import { solveSmallest } from './solve.js';

export const ENGINES = {
  HR: calculateHR,
  SRB: calculateSRB,
  FBIH: calculateFBIH,
  RSBIH: calculateRSBIH,
  BD: calculateBD,
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
