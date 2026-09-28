// Bosnia and Herzegovina - three separate payroll systems. Amounts in fening (1/100 KM),
// rates in basis points.

// Federation of BiH
//   Zakon o doprinosima, Službene novine FBiH 35/98 ... 33/25 (employer rates from 1.7.2025)
//   Zakon o porezu na dohodak, SN FBiH 10/08, 9/10, 44/11, 7/13, 65/13
//   Minimum wage for 2026, SN FBiH 100/25
//   Zakon o profesionalnoj rehabilitaciji ... osoba s invaliditetom, SN FBiH 9/10
export const FBIH_PARAMS = [
  {
    validFrom: '2026-01',
    validTo: '2026-12',
    currency: 'BAM',
    employee: { pension: 1700, health: 1250, unemployment: 150 },
    employer: { pension: 250, health: 200, unemployment: 50 },
    taxBp: 1000,
    allowanceUnit: 30000, // 300 KM x factor
    factorTenths: { base: 10, spouse: 5, children: [5, 7, 9], otherDependent: 3, disability: 3 },
    minimumNet: 102700,
    partTimeMinBasePercent: 50, // up to 4 hours a day
    specialSectorBase: 73900, // 0.30 x average wage Jan-Sep 2025 (mining, textile, leather, footwear, crafts)
    feesOnNetBp: { disasterProtection: 50, water: 50 },
    disabilityFundSmallBp: 50, // employers with up to 15 staff and no employee with a disability
    extendedServiceBp: { '12/14': 200, '12/15': 300, '12/16': 600 },
    workerAidCap: 30000, // non-taxable monthly aid, January-December 2026
  },
];

// Republika Srpska
//   Zakon o doprinosima, Službeni glasnik RS 114/17 ... 114/25
//   Zakon o porezu na dohodak, SG RS 60/15 ... 114/25
//   Odluka o najnižoj plati za 2026., SG RS 115/25
//   Zakon o Fondu solidarnosti za dijagnostiku i liječenje djece u inostranstvu, SG RS 100/17
//   Zakon o profesionalnoj rehabilitaciji ... invalida, SG RS 37/12, 82/15
export const RSBIH_PARAMS = [
  {
    validFrom: '2026-01',
    validTo: '2026-12',
    currency: 'BAM',
    contributionsBp: 3100,
    contributionSplit: { pension: 1850, health: 1020, unemployment: 60, childProtection: 170 },
    taxBp: 800,
    allowance: 100000,
    dependentAllowance: 15000,
    lifeInsuranceMonthlyCap: 10000, // 1200 KM a year
    voluntaryPensionMonthlyCap: 10000, // 1200 KM a year
    exemptPart: 5000, // ZPD čl. 8 st. 2 t. 13 - jobs requiring no or three-year secondary education
    exemptCategories: ['none', 'secondary3'],
    minimumGross: {
      none: 147623,
      secondary3: 155819,
      secondary4: 167213,
      higher: 208197,
      university: 224590,
    },
    solidarityBp: 25,
    disabilityFundBp: { private: 10, public: 20 },
    wageIncreaseRefund: { percent: 70, annualCap: 100000 }, // Zakon o podsticajima u privredi, SG RS 29/26
  },
];

// Brčko District
//   Zakon o porezu na dohodak BD, Službeni glasnik BD 60/10 ... 21/22, 45/22, 5/25
//   Odluka o osnovici i stopi doprinosa za zdravstveno osiguranje, SG BD 37/09
//   Odluka o doprinosu za slučaj nezaposlenosti, SG BD 7/24
//   Zakon o vodama BD, SG BD 19/2026; Zakon o ... osoba s invaliditetom, SG BD 32/25
const BD_2026 = {
  validFrom: '2026-01',
  validTo: '2026-12',
  currency: 'BAM',
  health: 1200,
  unemployment: 150,
  pensionByFund: { RS: 1850, FBIH: 1700 },
  employerPensionByFund: { RS: 0, FBIH: 250 },
  taxBp: 1000,
  allowance: 120000,
  factorTenths: { base: 10, spouse: 5, child: 5, per20PercentDisability: 1, permanentlyDisabledMember: 5 },
  waterFeeOnNetBp: 0,
  disabilityFundBp: 20,
  mealDailyCap: 1000,
};

export const BD_PARAMS = [BD_2026, { ...BD_2026, validFrom: '2026-07', waterFeeOnNetBp: 2 }];
