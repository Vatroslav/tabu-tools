import { calculate, netToGross, costToGross } from './engine/index.js';
import { HR_LOCAL_UNITS } from './engine/data-hr-local-units.js';
import { HR_ASSISTED_AREA_CODES, HR_DZS_NON_TAXABLE } from './engine/params-hr.js';
import { fromDecimal } from './engine/money.js';
import { I18N } from './i18n.js';

const COUNTRIES = ['HR', 'SRB', 'FBIH', 'RSBIH', 'BD'];
const DIRECTIONS = ['g2n', 'n2g', 'c2g'];
const CURRENCY_LABEL = { HR: '€', SRB: 'RSD', FBIH: 'KM', RSBIH: 'KM', BD: 'KM' };
const DEFAULT_AMOUNT = { HR: 2000, SRB: 150000, FBIH: 2000, RSBIH: 2000, BD: 2000 };
const PERIOD_MIN = '2026-01';
const PERIOD_MAX = '2027-12';
const HR_UNITS = new Map(HR_LOCAL_UNITS.map((u) => [u[0], u]));

// Field schema per jurisdiction. type: money | int | check | select | text
const check = (id, group, def = false, extra = {}) => ({ id, type: 'check', group, def, ...extra });
const int = (id, group, def, min, max, extra = {}) => ({ id, type: 'int', group, def, min, max, ...extra });
const money = (id, group, extra = {}) => ({ id, type: 'money', group, def: '', ...extra });
const select = (id, group, def, options, extra = {}) => ({ id, type: 'select', group, def, options, ...extra });
const EXTENDED = ['', '12/14', '12/15', '12/16', '12/18'];
// Fields that toggle the visibility of others (showIf) or change hints.
const RERENDER_ON = new Set(['residence', 'employerIncentive']);

const FIELDS = {
  HR: [
    select('residence', 'basic', '1333', () => HR_LOCAL_UNITS.map((u) => [String(u[0]), u[1]]), { wide: true, span2: true, hint: 'rates' }),
    int('children', 'basic', 0, 0, 9),
    int('dependents', 'basic', 0, 0, 20),
    check('assistedArea', 'person', false, { showIf: (s) => HR_ASSISTED_AREA_CODES.has(Number(s.residence)) }),
    select('disability', 'person', 'none', ['none', 'partial', 'full'], { wide: true }),
    int('membersDisabledPartial', 'person', 0, 0, 29),
    int('membersDisabledFull', 'person', 0, 0, 29),
    int('childrenShare', 'person', 100, 0, 100, { affix: '%' }),
    int('dependentsShare', 'person', 100, 0, 100, { affix: '%' }),
    select('hrviPercent', 'person', '0', ['0', '20', '30', '40', '50', '60', '70', '80', '90', '100']),
    int('birthYear', 'person', '', 1940, 2012, { optional: true }),
    check('returnee', 'person'),
    int('weeklyHours', 'job', 40, 1, 40),
    int('allowanceShare', 'job', 100, 0, 100, { affix: '%' }),
    money('totalGross', 'job'),
    check('boardMember', 'job'),
    check('pillar1Only', 'job'),
    check('insuredAbroad', 'job'),
    check('firstEmployment', 'employer'),
    check('legacyYouthExemption', 'employer'),
    check('fallenDefenderChild', 'employer'),
    select('extendedService', 'employer', '', EXTENDED),
    money('nonTaxable', 'calc', { full: true }),
  ],
  SRB: [
    int('workShare', 'basic', 100, 1, 100, { affix: '%' }),
    check('multipleEmployers', 'basic'),
    select('newResident', 'person', '', ['', 'type1', 'type2'], { wide: true }),
    check('retiree', 'person'),
    check('disabledEnterprise', 'person'),
    money('voluntaryInsurance', 'person'),
    int('ageAtYearEnd', 'person', '', 15, 100, { optional: true }),
    int('annualDependents', 'person', 0, 0, 20),
    int('hoursWorked', 'job', '', 0, 400, { optional: true }),
    int('hoursFund', 'job', '', 1, 400, { optional: true }),
    check('insuredAbroad', 'job'),
    select('employerIncentive', 'employer', '', ['', 'startup', 'disabledEmployee', 'rnd', 'newHire'], { wide: true }),
    int('rndShare', 'employer', 100, 0, 100, { affix: '%', showIf: (s) => s.employerIncentive === 'rnd' }),
    select('newHireBand', 'employer', 'small', ['small', '1-9', '10-99', '100+'], {
      wide: true,
      showIf: (s) => s.employerIncentive === 'newHire',
    }),
    select('extendedService', 'employer', '', EXTENDED),
    money('nonTaxable', 'calc', { full: true }),
  ],
  FBIH: [
    check('taxCard', 'basic', true),
    check('spouse', 'basic'),
    int('children', 'basic', 0, 0, 20),
    int('otherDependents', 'basic', 0, 0, 20),
    int('disabilities', 'person', 0, 0, 20),
    int('hoursPerDay', 'job', 8, 1, 8),
    check('specialSector', 'job'),
    select('extendedService', 'employer', '', ['', '12/14', '12/15', '12/16']),
    check('disabilityFundSmall', 'employer'),
    money('workerAid', 'employer'),
    money('nonTaxable', 'calc', { full: true }),
  ],
  RSBIH: [
    select('jobCategory', 'basic', 'secondary4', ['none', 'secondary3', 'secondary4', 'higher', 'university'], { wide: true }),
    int('dependents', 'basic', 0, 0, 20),
    money('housingInterest', 'person'),
    money('lifeInsurance', 'person'),
    money('voluntaryPension', 'person'),
    check('solidarityExempt', 'person'),
    int('workShare', 'job', 100, 1, 100, { affix: '%' }),
    check('multipleEmployers', 'job'),
    check('taxCard', 'job', true),
    select('disabilityFund', 'employer', '', ['', 'private', 'public'], { wide: true }),
    money('previousGross', 'employer'),
    money('nonTaxable', 'calc', { full: true }),
  ],
  BD: [
    select('pensionFund', 'basic', 'RS', ['RS', 'FBIH'], { wide: true }),
    check('taxCard', 'basic', true),
    check('entityResident', 'basic'),
    check('spouse', 'basic'),
    int('childrenBD', 'basic', 0, 0, 20),
    { id: 'disabilityPercents', type: 'text', group: 'person', def: '' },
    int('permanentlyDisabledMembers', 'person', 0, 0, 20),
    check('businessEmployer', 'employer', true),
    check('disabilityFundBD', 'employer'),
    money('nonTaxable', 'calc', { full: true }),
  ],
};

const m = (v) => (v === '' || v === null || v === undefined ? 0 : fromDecimal(v));
const n = (v, d = 0) => (v === '' || v === null || v === undefined ? d : Number(v));

// Maps UI state to engine input.
const TO_INPUT = {
  HR(s) {
    const unit = HR_UNITS.get(Number(s.residence)) || HR_UNITS.get(1333);
    const children = Array.from({ length: n(s.children) }, () => ({ share: n(s.childrenShare, 100) }));
    const dependents = Array.from({ length: n(s.dependents) }, () => ({ share: n(s.dependentsShare, 100) }));
    const members = [...children, ...dependents];
    let full = n(s.membersDisabledFull);
    let partial = n(s.membersDisabledPartial);
    for (const mem of members) {
      mem.disability = full-- > 0 ? 'full' : partial-- > 0 ? 'partial' : 'none';
    }
    return {
      rates: { lowerBp: unit[2], higherBp: unit[3] },
      pillar2: !s.pillar1Only,
      children,
      dependents,
      disability: s.disability,
      assistedArea: s.assistedArea && HR_ASSISTED_AREA_CODES.has(unit[0]),
      hrviPercent: n(s.hrviPercent),
      birthYear: s.birthYear ? n(s.birthYear) : null,
      returnee: s.returnee,
      weeklyHours: n(s.weeklyHours, 40),
      allowanceShare: n(s.allowanceShare, 100),
      totalGross: s.totalGross ? m(s.totalGross) : null,
      boardMember: s.boardMember,
      insuredAbroad: s.insuredAbroad,
      firstEmployment: s.firstEmployment,
      legacyYouthExemption: s.legacyYouthExemption,
      fallenDefenderChild: s.fallenDefenderChild,
      extendedService: s.extendedService || null,
      nonTaxable: m(s.nonTaxable),
    };
  },
  SRB(s) {
    const partMonth = s.hoursWorked && s.hoursFund ? { hoursWorked: n(s.hoursWorked), hoursFund: n(s.hoursFund) } : null;
    return {
      workShare: n(s.workShare, 100),
      multipleEmployers: s.multipleEmployers,
      partMonth,
      newResident: s.newResident || null,
      retiree: s.retiree,
      disabledEnterprise: s.disabledEnterprise,
      voluntaryInsurance: m(s.voluntaryInsurance),
      insuredAbroad: s.insuredAbroad,
      extendedService: s.extendedService || null,
      employerIncentive: s.employerIncentive || null,
      rndShare: n(s.rndShare, 100),
      newHireBand: s.newHireBand,
      nonTaxable: m(s.nonTaxable),
      ageAtYearEnd: s.ageAtYearEnd ? n(s.ageAtYearEnd) : null,
      dependents: n(s.annualDependents),
    };
  },
  FBIH(s) {
    return {
      taxCard: s.taxCard,
      spouse: s.spouse,
      children: n(s.children),
      otherDependents: n(s.otherDependents),
      disabilities: n(s.disabilities),
      hoursPerDay: n(s.hoursPerDay, 8),
      specialSector: s.specialSector,
      extendedService: s.extendedService || null,
      disabilityFundSmall: s.disabilityFundSmall,
      workerAid: m(s.workerAid),
      nonTaxable: m(s.nonTaxable),
    };
  },
  RSBIH(s) {
    return {
      jobCategory: s.jobCategory,
      dependents: n(s.dependents),
      housingInterest: m(s.housingInterest),
      lifeInsurance: m(s.lifeInsurance),
      voluntaryPension: m(s.voluntaryPension),
      solidarityExempt: s.solidarityExempt,
      workShare: n(s.workShare, 100),
      multipleEmployers: s.multipleEmployers,
      taxCard: s.taxCard,
      disabilityFund: s.disabilityFund || null,
      previousGross: s.previousGross ? m(s.previousGross) : null,
      nonTaxable: m(s.nonTaxable),
    };
  },
  BD(s) {
    const disabilityPercents = String(s.disabilityPercents || '')
      .split(/[,;\s]+/)
      .map(Number)
      .filter((x) => x > 0 && x <= 100);
    return {
      pensionFund: s.pensionFund,
      taxCard: s.taxCard,
      entityResident: s.entityResident,
      spouse: s.spouse,
      children: n(s.childrenBD),
      disabilityPercents,
      permanentlyDisabledMembers: n(s.permanentlyDisabledMembers),
      businessEmployer: s.businessEmployer,
      disabilityFund: s.disabilityFundBD,
      nonTaxable: m(s.nonTaxable),
    };
  },
};

// Breakdown rows: [label key, getter, kind]. kind: base | minus | plus | info | sub | total
const g = (k) => (r) => r.items[k];
const EMPLOYEE_ROWS = {
  HR: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_lowWageRelief', g('lowWageRelief'), 'info'],
    ['l_pension1', g('pension1'), 'minus'],
    ['l_pension2', g('pension2'), 'minus'],
    ['l_income', g('income'), 'sub'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_taxLower', g('taxLower'), 'info'],
    ['l_taxHigher', g('taxHigher'), 'info'],
    ['l_hrviRelief', g('hrviRelief'), 'info'],
    ['l_areaRelief', g('areaRelief'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
  SRB: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_contributionBase', g('contributionBase'), 'info'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_untaxed', g('untaxed'), 'info'],
    ['l_taxBase', g('taxable'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
  FBIH: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_contributionBase', g('contributionBase'), 'info'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_income', g('income'), 'sub'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
  RSBIH: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_exemptPart', g('exemptPart'), 'info'],
    ['l_contributionBase', g('contributionBase'), 'info'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_childProtection', g('childProtection'), 'minus'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
    ['l_solidarity', g('solidarity'), 'minus'],
  ],
  BD: [
    ['l_gross', (r) => r.gross, 'base'],
    ['l_pension', g('pension'), 'minus'],
    ['l_health', g('health'), 'minus'],
    ['l_unemployment', g('unemployment'), 'minus'],
    ['l_income', g('income'), 'sub'],
    ['l_allowance', g('allowance'), 'info'],
    ['l_taxBase', g('taxBase'), 'info'],
    ['l_tax', g('tax'), 'minus'],
    ['l_net', (r) => r.net, 'total'],
  ],
};
const EMPLOYER_ROWS = {
  HR: [
    ['l_healthEmployer', g('health'), 'plus'],
    ['l_extendedService', g('extendedService'), 'plus'],
  ],
  SRB: [
    ['l_pensionEmployer', g('employerPension'), 'plus'],
    ['l_healthEmployer', g('employerHealth'), 'plus'],
    ['l_extendedService', g('extendedService'), 'plus'],
  ],
  FBIH: [
    ['l_pensionEmployer', g('employerPension'), 'plus'],
    ['l_healthEmployer', g('employerHealth'), 'plus'],
    ['l_unemploymentEmployer', g('employerUnemployment'), 'plus'],
    ['l_extendedService', g('extendedService'), 'plus'],
    ['l_disasterProtectionFee', g('disasterProtectionFee'), 'plus'],
    ['l_waterFee', g('waterFee'), 'plus'],
    ['l_disabilityFund', g('disabilityFund'), 'plus'],
  ],
  RSBIH: [['l_disabilityFund', g('disabilityFund'), 'plus']],
  BD: [
    ['l_pensionEmployer', g('employerPension'), 'plus'],
    ['l_waterFee', g('waterFee'), 'plus'],
    ['l_disabilityFund', g('disabilityFund'), 'plus'],
  ],
};

// ---------------- state ----------------

function currentMonth() {
  const d = new Date();
  const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return p < PERIOD_MIN ? PERIOD_MIN : p > PERIOD_MAX ? PERIOD_MAX : p;
}

function defaultsFor(country) {
  const s = {};
  for (const f of FIELDS[country]) s[f.id] = f.def;
  return s;
}

function initialLang(params) {
  const p = params.get('lang');
  if (p === 'hr' || p === 'en') return p;
  const parts = (navigator.language || '').toLowerCase().split('-');
  return ['hr', 'sr', 'bs', 'sh'].includes(parts[0]) && !parts.includes('me') ? 'hr' : 'en';
}

const params = new URLSearchParams(location.search);
let lang = initialLang(params);
const state = {
  country: COUNTRIES.includes(params.get('c')) ? params.get('c') : 'HR',
  dir: DIRECTIONS.includes(params.get('d')) ? params.get('d') : 'g2n',
  period: /^\d{4}-\d{2}$/.test(params.get('m') || '') ? params.get('m') : currentMonth(),
  amount: {},
  fields: {},
};
for (const c of COUNTRIES) {
  state.amount[c] = DEFAULT_AMOUNT[c];
  state.fields[c] = defaultsFor(c);
}
if (params.has('a') && !Number.isNaN(Number(params.get('a')))) state.amount[state.country] = Number(params.get('a'));
// Links created before the pillar field was inverted carry pillar2=0.
if (params.get('pillar2') === '0') state.fields.HR.pillar1Only = true;
for (const f of FIELDS[state.country]) {
  if (!params.has(f.id)) continue;
  const raw = params.get(f.id);
  state.fields[state.country][f.id] = f.type === 'check' ? raw === '1' : raw;
}

function syncUrl() {
  const u = new URL(location.href);
  const keep = u.searchParams.get('lang');
  u.search = '';
  if (keep) u.searchParams.set('lang', keep);
  u.searchParams.set('c', state.country);
  u.searchParams.set('d', state.dir);
  u.searchParams.set('a', String(state.amount[state.country]));
  u.searchParams.set('m', state.period);
  const s = state.fields[state.country];
  for (const f of FIELDS[state.country]) {
    if (s[f.id] === f.def) continue;
    u.searchParams.set(f.id, f.type === 'check' ? (s[f.id] ? '1' : '0') : String(s[f.id]));
  }
  history.replaceState(null, '', u);
}

// ---------------- rendering ----------------

const $ = (id) => document.getElementById(id);
const t = (key) => I18N[lang][key] ?? key;

function fmt(minor) {
  const locale = lang === 'hr' ? 'hr-HR' : 'en-GB';
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  return `${num} ${CURRENCY_LABEL[state.country]}`;
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined) e.append(c);
  return e;
}

function seg(items, active, onPick, labelFor) {
  return el(
    'div',
    { class: 'seg', role: 'group' },
    ...items.map((x) =>
      el('button', { type: 'button', class: x === active ? 'active' : '', onclick: () => onPick(x) }, labelFor(x)),
    ),
  );
}

function optionLabel(f, v) {
  if (f.id === 'extendedService' && state.country === 'FBIH' && v === '12/16') return t('extendedService_FBIH_12_16');
  if (f.id === 'hrviPercent') return v === '0' ? t('hrviPercent_0') : `${v} %`;
  return t(`${f.id}_${v}`);
}

function fieldControl(f, s) {
  const onChange = (value) => {
    s[f.id] = value;
    if (RERENDER_ON.has(f.id)) renderInputs();
    update();
  };
  if (f.type === 'check') {
    return el('input', { type: 'checkbox', id: `f-${f.id}`, checked: s[f.id], onchange: (e) => onChange(e.target.checked) });
  }
  if (f.type === 'select') {
    const opts = typeof f.options === 'function' ? f.options() : f.options.map((v) => [v, optionLabel(f, v)]);
    const sel = el(
      'select',
      { id: `f-${f.id}`, onchange: (e) => onChange(e.target.value) },
      ...opts.map(([v, label]) => el('option', { value: v, selected: String(s[f.id]) === String(v) }, label)),
    );
    return sel;
  }
  const attrs = {
    id: `f-${f.id}`,
    type: f.type === 'text' ? 'text' : 'number',
    value: s[f.id],
    inputmode: f.type === 'money' ? 'decimal' : 'numeric',
    oninput: (e) => onChange(e.target.value),
  };
  if (f.type === 'money') Object.assign(attrs, { min: 0, step: '0.01', placeholder: '0' });
  if (f.type === 'int') Object.assign(attrs, { min: f.min, max: f.max, step: 1 });
  const input = el('input', attrs);
  const affix = f.type === 'money' ? CURRENCY_LABEL[state.country] : f.affix;
  if (affix) input.classList.add('affixed');
  return el('div', { class: 'input-shell' }, input, affix ? el('span', { class: 'affix' }, affix) : null);
}

function fieldRow(f, s) {
  const labelKey = f.id;
  let sub = I18N[lang][`${labelKey}_sub`];
  if (f.id === 'nonTaxable' && state.country === 'HR') sub = dzsNonTaxableHint();
  let hint = null;
  if (f.hint === 'rates') {
    const u = HR_UNITS.get(Number(s.residence));
    if (u) hint = t('rates_hint').replace('{lower}', fmtRate(u[2])).replace('{higher}', fmtRate(u[3]));
  }
  const label = el('label', { for: `f-${f.id}` }, t(labelKey), sub || hint ? el('span', { class: 'sub' }, sub || hint) : null);
  const cls = `field${f.wide ? ' wide' : ''}${f.span2 ? ' span2' : ''}${f.full ? ' full' : ''}${f.type === 'check' ? ' check' : ''}`;
  return el('div', { class: cls }, label, fieldControl(f, s));
}

function dzsNonTaxableHint() {
  const d = HR_DZS_NON_TAXABLE;
  const [y, mo] = d.month.split('-').map(Number);
  const whole = (minor) => `${new Intl.NumberFormat(lang === 'hr' ? 'hr-HR' : 'en-GB').format(Math.round(minor / 100))} €`;
  return t('nonTaxable_sub_HR')
    .replace('{month}', `${t('months')[mo - 1]} ${y}${lang === 'hr' ? '.' : ''}`)
    .replace('{perEmployee}', whole(d.perEmployee));
}

function fmtRate(bp) {
  return new Intl.NumberFormat(lang === 'hr' ? 'hr-HR' : 'en-GB', { maximumFractionDigits: 2 }).format(bp / 100);
}

let advancedOpen = false;

function renderCountryTabs() {
  const root = $('country-tabs');
  root.textContent = '';
  root.append(seg(COUNTRIES, state.country, (c) => { state.country = c; renderInputs(); update(); }, (c) => t(`country_${c}`)));
}

function renderInputs() {
  renderCountryTabs();
  const root = $('inputs');
  root.textContent = '';
  const s = state.fields[state.country];
  const country = state.country;

  const amountInput = el('input', {
    id: 'f-amount',
    type: 'number',
    min: 0,
    step: '0.01',
    inputmode: 'decimal',
    class: 'affixed big',
    value: state.amount[country],
    oninput: (e) => {
      state.amount[country] = e.target.value === '' ? '' : Number(e.target.value);
      update();
    },
  });
  const periodInput = el('input', {
    id: 'f-period',
    type: 'month',
    min: PERIOD_MIN,
    max: PERIOD_MAX,
    value: state.period,
    onchange: (e) => {
      if (e.target.value) state.period = e.target.value;
      update();
    },
  });

  root.append(
    el(
      'div',
      { class: 'card' },
      el('h2', {}, t('g_calc')),
      seg(DIRECTIONS, state.dir, (d) => { state.dir = d; renderInputs(); update(); }, (d) => t(`dir_${d}`)),
      el(
        'div',
        { class: 'fields' },
        el(
          'div',
          { class: 'field wide' },
          el('label', { for: 'f-amount' }, t(`amount_${state.dir}`), country === 'SRB' ? el('span', { class: 'sub' }, t('amount_hint_SRB')) : null),
          el('div', { class: 'input-shell' }, amountInput, el('span', { class: 'affix' }, CURRENCY_LABEL[country])),
        ),
        el(
          'div',
          { class: 'field wide' },
          el('label', { for: 'f-period' }, t('period'), el('span', { class: 'sub' }, t('period_hint'))),
          periodInput,
        ),
        ...FIELDS[country].filter((f) => f.group === 'calc').map((f) => fieldRow(f, s)),
      ),
    ),
  );

  const visible = FIELDS[country].filter((f) => !f.showIf || f.showIf(s));
  const basic = visible.filter((f) => f.group === 'basic');
  root.append(el('div', { class: 'card' }, el('h2', {}, t('g_basic')), el('div', { class: 'fields' }, ...basic.map((f) => fieldRow(f, s)))));

  const details = el('details', { class: 'card advanced', open: advancedOpen, ontoggle: (e) => { advancedOpen = e.target.open; } });
  details.append(el('summary', {}, t('advanced')));
  for (const group of ['person', 'job', 'employer']) {
    const fs = visible.filter((f) => f.group === group);
    if (!fs.length) continue;
    details.append(el('h3', {}, t(`g_${group}`)), el('div', { class: 'fields' }, ...fs.map((f) => fieldRow(f, s))));
  }
  const infoKey = country === 'HR' ? 'info_HR' : country === 'SRB' ? 'info_SRB' : 'info_BIH';
  details.append(el('ul', { class: 'info' }, ...I18N[lang][infoKey].map((x) => el('li', {}, x))));
  root.append(details);
}

function breakdownRows(rows, r) {
  return rows
    .map(([key, get, kind]) => [key, get(r), kind])
    .filter(([key, v, kind]) => kind === 'base' || kind === 'total' || kind === 'sub' || v)
    .map(([key, v, kind]) =>
      el('div', { class: `row ${kind}` }, el('span', {}, t(key)), el('span', { class: 'v' }, (kind === 'minus' ? '− ' : kind === 'plus' ? '+ ' : '') + fmt(v))),
    );
}

function renderResult(r, solved) {
  const out = $('results');
  out.textContent = '';
  const primaryKey = state.dir === 'g2n' ? 'r_net' : 'r_gross';
  const primaryValue = state.dir === 'g2n' ? r.net : r.gross;
  out.append(el('div', { class: 'res-block res-primary' }, el('div', { class: 'res-label' }, t(primaryKey)), el('div', { class: 'res-value' }, fmt(primaryValue))));

  const secondary = [];
  if (state.dir !== 'g2n') secondary.push(['r_net', r.net]);
  if (state.dir === 'g2n') secondary.push(['r_gross', r.gross]);
  if (r.payout !== r.net) secondary.push(['r_payout', r.payout]);
  secondary.push(['r_cost', r.employerCost]);
  if (r.effectiveEmployerCost !== r.employerCost) {
    const refund = r.items.employerReliefTiming === 'refund';
    secondary.push([refund ? 'r_effective_refund' : 'r_effective', r.effectiveEmployerCost]);
  }
  for (const [key, v] of secondary) {
    out.append(el('div', { class: 'res-block res-secondary' }, el('div', { class: 'res-label' }, t(key)), el('div', { class: 'res-value' }, fmt(v))));
  }

  const country = state.country;
  out.append(el('div', { class: 'res-section-title' }, t('r_employee')), ...breakdownRows(EMPLOYEE_ROWS[country], r));
  if (r.payout !== r.net) out.append(el('div', { class: 'row total' }, el('span', {}, t('l_payout')), el('span', { class: 'v' }, fmt(r.payout))));
  const employerRows = [
    ['l_gross', (x) => x.gross, 'base'],
    ...EMPLOYER_ROWS[country],
    ['l_nonTaxable', (x) => x.employerCost - x.gross - EMPLOYER_ROWS[country].reduce((a, [, get]) => a + (get(x) || 0), 0), 'plus'],
    ['l_cost', (x) => x.employerCost, 'total'],
    ['l_employerRelief', (x) => x.employerCost - x.effectiveEmployerCost, 'minus'],
  ];
  out.append(el('div', { class: 'res-section-title' }, t('r_employer')), ...breakdownRows(employerRows, r));

  if (r.annual) {
    const a = r.annual;
    const block = el('div', { class: 'annual' }, el('div', { class: 'res-section-title' }, t('r_annual')));
    if (!a.available) {
      block.append(el('p', { class: 'note' }, t(`a_unavailable_${a.reason}`)));
    } else if (a.kind === 'youth' || a.kind === 'returnee') {
      const label = a.kind === 'youth' ? t('a_youth').replace('{pct}', a.youthPercent) : t('a_returnee');
      block.append(el('div', { class: 'row total' }, el('span', {}, label), el('span', { class: 'v' }, fmt(a.refund))), el('p', { class: 'note' }, t('a_assumption')));
    } else if (a.kind === 'annualTax') {
      block.append(
        el('div', { class: 'row total' }, el('span', {}, t('a_annualTax')), el('span', { class: 'v' }, fmt(a.tax))),
        el('p', { class: 'note' }, `${t('a_annualTax_note').replace('{year}', a.incomeYear)} ${t('a_assumption')}`),
      );
    } else if (a.kind === 'wageIncrease') {
      block.append(el('div', { class: 'row total' }, el('span', {}, t('a_wageIncrease')), el('span', { class: 'v' }, fmt(a.refund))));
    }
    out.append(block);
  }

  const notes = [...r.notes];
  if (r.provisional) notes.unshift('provisional');
  if (solved && !solved.exact) notes.push('notExact');
  if (r.items.employerReliefTiming === 'refund') notes.push('refundLater');
  if (notes.length) {
    out.append(el('div', { class: 'res-section-title' }, t('r_notes')), el('ul', { class: 'notes' }, ...notes.map((k) => el('li', {}, t(`n_${k}`)))));
  }

  out.append(
    el(
      'details',
      { class: 'sources' },
      el('summary', {}, t('r_sources')),
      el('ul', {}, ...I18N[lang].sources[country].map((x) => el('li', {}, x))),
      el('div', { class: 'res-section-title' }, t('r_not_modelled')),
      el('ul', {}, ...I18N[lang][`not_modelled_${country}`].map((x) => el('li', {}, x))),
      el('p', { class: 'note' }, t('r_verified')),
    ),
  );
}

function update() {
  syncUrl();
  const country = state.country;
  const input = { ...TO_INPUT[country](state.fields[country]), period: state.period };
  const amount = fromDecimal(state.amount[country] || 0);
  try {
    let r;
    let solved = null;
    if (state.dir === 'g2n') {
      r = calculate(country, { ...input, gross: amount });
    } else {
      solved = state.dir === 'n2g' ? netToGross(country, input, amount) : costToGross(country, input, amount);
      if (!solved) throw new RangeError('unsolvable');
      r = calculate(country, { ...input, gross: solved.gross });
    }
    renderResult(r, solved);
  } catch (err) {
    $('results').textContent = t('r_error');
    console.error(err);
  }
}

function applyLang() {
  const tr = I18N[lang];
  document.documentElement.lang = lang;
  document.title = tr.doc_title;
  document.querySelectorAll('[data-i18n]').forEach((e) => {
    const v = tr[e.dataset.i18n];
    if (typeof v === 'string') e.textContent = v;
  });
  $('lang-hr').classList.toggle('active', lang === 'hr');
  $('lang-en').classList.toggle('active', lang === 'en');
  renderInputs();
  update();
}

document.querySelectorAll('.lang-toggle button').forEach((b) => {
  b.addEventListener('click', () => {
    lang = b.dataset.lang;
    const u = new URL(location.href);
    u.searchParams.set('lang', lang);
    history.replaceState(null, '', u);
    applyLang();
  });
});

$('reset').addEventListener('click', () => {
  state.fields[state.country] = defaultsFor(state.country);
  state.amount[state.country] = DEFAULT_AMOUNT[state.country];
  state.dir = 'g2n';
  renderInputs();
  update();
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $('copy').textContent = t('copied');
    setTimeout(() => { $('copy').textContent = t('copy_link'); }, 1800);
  } catch {
    /* clipboard unavailable: the URL bar already holds the link */
  }
});

applyLang();
