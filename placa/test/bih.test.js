import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateFBIH, fbihMinimumGross } from '../engine/fbih.js';
import { calculateRSBIH } from '../engine/rsbih.js';
import { calculateBD } from '../engine/bd.js';
import { fromDecimal as km } from '../engine/money.js';
import { netToGross } from '../engine/index.js';

// ---------- Federation of BiH ----------

// Minimum wage 2026 (1027 KM net), Bloomberg Adria: gross 1605.47 for factor 1.0.
test('FBiH minimum wage, factor 1.0', () => {
  assert.equal(fbihMinimumGross(10), km(1605.47));
  const r = calculateFBIH({ gross: km(1605.47), disabilityFundSmall: true });
  assert.equal(r.items.pension, km(272.93));
  assert.equal(r.items.health, km(200.68));
  assert.equal(r.items.unemployment, km(24.08));
  assert.equal(r.items.tax, km(80.78));
  assert.equal(r.net, km(1027));
  // Published cost 1704.04 is computed without per-item rounding; per item it is 1704.06.
  assert.equal(r.employerCost, km(1704.06));
});

// prika.ba: gross 2000, factor 1.0.
test('FBiH gross 2000, factor 1.0', () => {
  const r = calculateFBIH({ gross: km(2000), disabilityFundSmall: true });
  assert.equal(r.items.tax, km(108));
  assert.equal(r.net, km(1272));
  assert.equal(r.employerCost, km(2122.72));
});

test('FBiH spouse and two children: factor 2.7', () => {
  const r = calculateFBIH({ gross: km(2000), spouse: true, children: 2 });
  assert.equal(r.items.factorTenths, 27);
  assert.equal(r.items.tax, km(57));
  assert.equal(r.net, km(1323));
});

// prika.ba publishes gross 2367.15 for net 1500; 2367.14 gives the same net and is the smallest.
test('FBiH net 1500 to gross', () => {
  assert.equal(calculateFBIH({ gross: km(2367.15) }).net, km(1500));
  assert.equal(netToGross('FBIH', {}, km(1500)).gross, km(2367.14));
});

test('FBiH without a tax card: no allowance', () => {
  const r = calculateFBIH({ gross: km(2000), taxCard: false });
  assert.equal(r.items.allowance, 0);
  assert.equal(r.items.tax, km(138));
});

test('FBiH part time up to 4 hours: minimum base is half the minimum gross', () => {
  const r = calculateFBIH({ gross: km(700), hoursPerDay: 4 });
  assert.equal(r.items.contributionBase, km(802.74));
});

// Derived: 31 % / 5 % of 739 KM, each contribution rounded separately.
test('FBiH special sector: contributions on the fixed base', () => {
  const r = calculateFBIH({ gross: km(1400), specialSector: true });
  assert.equal(r.items.pension + r.items.health + r.items.unemployment, km(229.1));
  assert.equal(r.items.employerPension + r.items.employerHealth + r.items.employerUnemployment, km(36.96));
});

// ---------- Republika Srpska ----------

// Poreska uprava RS notice of 10.2.2026: three-year secondary job, gross 1800.
test('RS gross 1800, three-year secondary job', () => {
  const r = calculateRSBIH({ gross: km(1800), jobCategory: 'secondary3' });
  assert.equal(r.items.exemptPart, km(50));
  assert.equal(r.items.contributionBase, km(1750));
  assert.equal(r.items.contributions, km(542.5));
  assert.equal(r.items.taxBase, km(750));
  assert.equal(r.items.tax, km(60));
  assert.equal(r.net, km(1197.5));
  assert.equal(r.employerCost, km(1800));
});

// Odluka o najnižoj plati za 2026. (SG RS 115/25): gross -> net pairs.
test('RS minimum wages 2026 by job category', () => {
  const cases = [
    ['none', 1476.23, 1000],
    ['secondary4', 1672.13, 1100],
    ['higher', 2081.97, 1350],
    ['university', 2245.9, 1450],
  ];
  for (const [jobCategory, gross, net] of cases) {
    assert.equal(calculateRSBIH({ gross: km(gross), jobCategory }).net, km(net), jobCategory);
  }
  // The published gross for three-year secondary jobs yields 1049.99, one fening short.
  assert.equal(calculateRSBIH({ gross: km(1558.19), jobCategory: 'secondary3' }).net, km(1049.99));
});

// 6yka.com, before 2026 (no exempt part, older minimum): gross 1344.26 -> net 900.
test('RS contribution split adds up to 31 %', () => {
  const noMinimum = { minimumGross: { secondary4: 0 } };
  const r = calculateRSBIH({ gross: km(1344.26), jobCategory: 'secondary4' }, noMinimum);
  assert.equal(r.items.pension, km(248.69));
  assert.equal(r.items.health, km(137.11));
  assert.equal(r.items.unemployment, km(8.07));
  assert.equal(r.items.childProtection, km(22.85));
  assert.equal(r.items.tax, km(27.54));
  assert.equal(r.net, km(900));
});

test('RS solidarity deduction reduces the payout, not the net', () => {
  const r = calculateRSBIH({ gross: km(1672.13), jobCategory: 'secondary4' });
  assert.equal(r.items.solidarity, km(2.75));
  assert.equal(r.payout, km(1097.25));
  const exempt = calculateRSBIH({ gross: km(1672.13), jobCategory: 'secondary4', solidarityExempt: true });
  assert.equal(exempt.payout, km(1100));
});

test('RS dependants reduce tax', () => {
  const r = calculateRSBIH({ gross: km(3000), dependents: 2 });
  assert.equal(r.items.tax, km(136));
  assert.equal(r.net, km(1934));
});

// ---------- Brčko District ----------

// unija.com (23.9.2025): gross 1800, basic allowance 1200.
test('Brčko, pension in the RS fund', () => {
  const r = calculateBD({ gross: km(1800), pensionFund: 'RS' });
  assert.equal(r.items.pension, km(333));
  assert.equal(r.items.health, km(216));
  assert.equal(r.items.unemployment, km(27));
  assert.equal(r.items.tax, km(2.4));
  assert.equal(r.net, km(1221.6));
  assert.equal(r.employerCost, km(1800));
});

test('Brčko, pension in the FBiH fund', () => {
  const r = calculateBD({ gross: km(1800), pensionFund: 'FBIH' });
  assert.equal(r.items.pension, km(306));
  assert.equal(r.items.tax, km(5.1));
  assert.equal(r.net, km(1245.9));
  assert.equal(r.employerCost, km(1845));
});

test('Brčko dependants and entity residents', () => {
  const r = calculateBD({ gross: km(4000), children: 1 });
  assert.equal(r.items.allowance, km(1800));
  assert.equal(r.net, km(2628));
  const resident = calculateBD({ gross: km(4000), children: 1, entityResident: true });
  assert.equal(resident.items.allowance, km(1200));
});

test('Brčko water fee applies from July 2026', () => {
  assert.equal(calculateBD({ gross: km(1800), period: '2026-06' }).items.waterFee, 0);
  assert.equal(calculateBD({ gross: km(1800), period: '2026-07' }).items.waterFee, km(0.24));
});
