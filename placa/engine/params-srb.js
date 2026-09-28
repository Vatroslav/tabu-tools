// Serbia - payroll parameters. Amounts in para (1/100 RSD), rates in basis points.
// Sources:
//   Zakon o porezu na dohodak građana (ZPDG), version in force 1.1.-31.12.2026 (Sl. glasnik RS 109/2025)
//   ZPDG amendments, Sl. glasnik RS 80/2026 (non-taxable amount for 2027)
//   Zakon o doprinosima za obavezno socijalno osiguranje (ZDOSO)
//   Contribution bases for 2026, Sl. glasnik RS 112/2025
//   New-resident salary thresholds for 2026, Sl. glasnik RS 115/2025
//   Dinar amounts adjusted from 1.2.2026, Sl. glasnik RS 6/2026

const BASE_2026 = {
  validFrom: '2026-01',
  validTo: '2026-12',
  currency: 'RSD',
  taxBp: 1000,
  untaxed: 3422100, // ZPDG čl. 15a
  minBase: 5129700,
  maxBase: 73282000,
  employee: { pension: 1400, health: 515, unemployment: 75 },
  employer: { pension: 1000, health: 515 },
  newResidentThreshold: { type1: 43969200, type2: 29312800 }, // ZPDG čl. 15v
  newResidentKeepPercent: 30,
  startupCap: 15000000, // ZPDG čl. 21e
  voluntaryInsuranceCap: null, // ZPDG čl. 21a, January 2026 value not published in sources used
  extendedServiceBp: { '12/14': 370, '12/15': 550, '12/16': 730, '12/18': 1100 }, // ZDOSO čl. 46
  newHireRefundPercent: { small: 75, '1-9': 65, '10-99': 70, '100+': 75 },
  rndTaxExemptPercent: 70, // ZPDG čl. 21i
  minimumHourlyNet: 37100,
};

export const SRB_PARAMS = [
  BASE_2026,
  { ...BASE_2026, validFrom: '2026-02', voluntaryInsuranceCap: 867700 },
  {
    // Only the non-taxable amount is published for 2027; the rest repeats 2026 values.
    ...BASE_2026,
    validFrom: '2027-01',
    validTo: '2027-12',
    provisional: true,
    untaxed: 3736900,
    voluntaryInsuranceCap: 867700,
    minimumHourlyNet: 40500,
  },
];

// Annual personal income tax (ZPDG čl. 87-89), parameters for 2025 income
// as published by the Tax Administration in April 2026.
export const SRB_ANNUAL_2025 = {
  incomeYear: 2025,
  averageAnnualWage: 181303200,
  threshold: 543909600, // 3 x average annual wage
  youthExtraDeduction: 543909600, // under 40 on 31 December
  personalDeduction: 72521300,
  dependentDeduction: 27195500,
  higherRateFrom: 1087819200, // 6 x average annual wage
  lowerBp: 1000,
  higherBp: 1500,
};
