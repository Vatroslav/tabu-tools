// Croatia - payroll parameters. Amounts in euro cents, rates in basis points.
// Sources:
//   Zakon o doprinosima (ZoD), NN 84/08 ... 114/23, 152/24
//   Zakon o porezu na dohodak (ZPD), NN 115/16 ... 114/23, 152/24
//   Naredba o iznosima osnovica za obračun doprinosa za 2026., NN 150/25
//   Minimum wage for 2026, NN 132/25
//   Zakon o stažu osiguranja s povećanim trajanjem, NN 115/18, 34/21

export const HR_PARAMS = [
  {
    validFrom: '2026-01',
    validTo: '2026-12',
    currency: 'EUR',
    pension1Bp: 1500, // ZoD čl. 13 - pillar I for members of pillar II
    pension1OnlyBp: 2000, // pillar I only
    pension2Bp: 500,
    healthBp: 1650, // ZoD čl. 14 - employer, no upper cap
    maxBase: 1195800, // pension contributions only (6.0 x 1993.00)
    minBase: 75734, // 0.38 x 1993.00, full-time
    boardMemberMinBase: 129545, // 0.65 x 1993.00, ZoD čl. 21 st. 2
    lowWageRelief: {
      // ZoD čl. 21.a - reduction of the pillar I base
      fullReliefUpTo: 70000,
      reliefEndsAt: 130000,
      fixedRelief: 30000,
    },
    personalAllowance: 60000, // ZPD čl. 14
    childCoefTenths: [5, 7, 10, 14, 19, 25, 32, 40, 49],
    dependentCoefTenths: 5,
    disabilityCoefTenths: { partial: 3, full: 10 },
    monthlyTaxThreshold: 500000, // ZPD čl. 24 st. 3
    annualTaxThreshold: 6000000, // ZPD čl. 19
    minimumWage: 105000,
    youth: { fullReliefMaxAge: 25, halfReliefMaxAge: 30 }, // ZPD čl. 46 st. 2
    // Additional pension contribution for extended insurance periods, paid by the employer:
    // [pillar I if also in pillar II, pillar II, pillar I only]
    extendedServiceBp: {
      '12/14': [361, 125, 486],
      '12/15': [583, 201, 784],
      '12/16': [839, 289, 1128],
      '12/18': [1307, 451, 1758],
    },
  },
];

// Local units in development group I (Odluka o razvrstavanju JLS, NN 3/24) plus
// the City of Vukovar (ZPD čl. 24 st. 5): income tax is halved for residents.
// Codes follow the Tax Administration's 2026 local income tax rate table.
export const HR_ASSISTED_AREA_CODES = new Set([
  35, 183, 3107, 299, 329, 493, 507, 515, 574, 582, 663, 680, 833, 841, 5681, 914, 922, 949,
  1023, 1058, 1104, 1139, 1244, 1279, 1317, 1368, 1414, 5100, 1490, 6092, 5991, 1686, 1830,
  1848, 1953, 2160, 2305, 5878, 2453, 5550, 6106, 2666, 6122, 2836, 2992, 3255, 3336, 3409,
  2712, 3468, 5894, 3972, 4073, 4120, 4235, 4243, 4260, 6149, 6289, 4561, 4618, 4642, 4693,
  4782, 4855, 4995, 5037, 5061, 5126, 5231, 5665, 5401,
  5185, // Vukovar
]);

// Average non-taxable receipts paid in a month, Državni zavod za statistiku,
// release RAD-2026-1-1/7 (22.9.2026), table 4. Shown as guidance only.
export const HR_DZS_NON_TAXABLE = {
  month: '2026-07',
  perRecipient: 26900, // per employee who received a non-taxable payment
  perEmployee: 18200, // per employee who received a salary
};
